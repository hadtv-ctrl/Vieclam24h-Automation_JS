// master-process-disable-size-check: Legacy module, queued for modular decomposition
/**
 * dashboard/public/js/views/qa/markdownView.js
 * Dựng Markdown thành DOM — KHÔNG dùng innerHTML ở bất kỳ đâu.
 *
 * Tài liệu requirement/test-case do chính dự án viết, và hoàn toàn có thể chứa thẻ HTML
 * (dán từ Confluence, từ trình soạn thảo, hoặc cố ý). Gán innerHTML là biến trang QA thành
 * cửa ngõ chạy script với toàn quyền của dashboard — mà dashboard có endpoint ghi file.
 * Vì vậy mọi nút đều qua createElement + textContent; văn bản không bao giờ được diễn giải
 * thành đánh dấu.
 *
 * Bộ dựng này cố tình KHÔNG đầy đủ CommonMark. Nó phủ đúng những gì tài liệu QA dùng thật:
 * tiêu đề, đoạn văn, danh sách, bảng, khối mã, trích dẫn, đường kẻ. Thứ không nhận ra được
 * hiển thị nguyên văn — sai theo hướng "hiện thừa" chứ không bao giờ nuốt mất nội dung.
 */

const HEADING = /^(#{1,6})\s+(.*)$/;
const FENCE = /^```(.*)$/;
const HR = /^(?:-{3,}|\*{3,}|_{3,})\s*$/;
const UL_ITEM = /^(\s*)[-*+]\s+(.*)$/;
const OL_ITEM = /^(\s*)(\d+)[.)]\s+(.*)$/;
const QUOTE = /^>\s?(.*)$/;
const TABLE_SEP = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;

// Mã nghiệp vụ của chính hệ thống này — tô lên để mắt bắt được ngay trong đoạn văn dài.
const TRACE_ID = /\b(?:REQ|AC|TC)-\d+\b/;

const INLINE = new RegExp(
  [
    '(`[^`]+`)', // mã nội dòng
    '(\\*\\*[^*]+\\*\\*)', // đậm
    '(__[^_]+__)', // đậm
    '(\\*[^*]+\\*)', // nghiêng
    '(\\[[^\\]]*\\]\\([^)\\s]+\\))', // liên kết
    `(${TRACE_ID.source})`, // mã truy vết
  ].join('|'),
  'g',
);

const el = (tag, text, className) => {
  const node = document.createElement(tag);
  if (text !== undefined && text !== null) node.textContent = text;
  if (className) node.className = className;
  return node;
};

/**
 * Chỉ nhận liên kết an toàn. `javascript:`, `data:` và mọi scheme lạ bị trả về null để
 * chỗ gọi hiển thị thành văn bản thường thay vì thẻ <a>.
 */
function safeHref(raw) {
  const url = String(raw || '').trim();
  if (!url) return null;
  if (url.startsWith('#')) return url;
  if (/^https?:\/\//i.test(url)) return url;
  // Đường dẫn tương đối trong repo: không có scheme, không bắt đầu bằng "//".
  if (!/^[a-z][a-z0-9+.-]*:/i.test(url) && !url.startsWith('//')) return null;
  return null;
}

/** Cắt một dòng thành các nút nội dòng. Trả về mảng Node. */
function inlineNodes(text) {
  const out = [];
  const source = String(text == null ? '' : text);
  let last = 0;
  INLINE.lastIndex = 0;

  let match = INLINE.exec(source);
  while (match) {
    if (match.index > last) out.push(document.createTextNode(source.slice(last, match.index)));
    const token = match[0];

    if (token.startsWith('`')) {
      out.push(el('code', token.slice(1, -1), 'qa-md-code'));
    } else if (token.startsWith('**') || token.startsWith('__')) {
      out.push(el('strong', token.slice(2, -2)));
    } else if (token.startsWith('*')) {
      out.push(el('em', token.slice(1, -1)));
    } else if (token.startsWith('[')) {
      const split = token.indexOf('](');
      const label = token.slice(1, split);
      const href = safeHref(token.slice(split + 2, -1));
      if (href) {
        const a = el('a', label || href, 'qa-md-link');
        a.href = href;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        out.push(a);
      } else {
        // Liên kết không an toàn hoặc trỏ vào file trong repo: giữ nguyên văn bản gốc để
        // người đọc vẫn thấy đích, nhưng không tạo thứ bấm được.
        out.push(document.createTextNode(token));
      }
    } else {
      out.push(el('span', token, 'qa-md-trace'));
    }

    last = match.index + token.length;
    match = INLINE.exec(source);
  }

  if (last < source.length) out.push(document.createTextNode(source.slice(last)));
  return out;
}

const appendInline = (node, text) => {
  for (const child of inlineNodes(text)) node.appendChild(child);
  return node;
};

const splitRow = (line) => line.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map((c) => c.trim());

function buildTable(lines, start) {
  const header = splitRow(lines[start]);
  const rows = [];
  let i = start + 2;
  while (i < lines.length && lines[i].includes('|') && lines[i].trim()) {
    rows.push(splitRow(lines[i]));
    i += 1;
  }

  const wrap = el('div', null, 'qa-md-table-wrap');
  const table = el('table', null, 'qa-md-table');
  const thead = el('thead');
  const hr = el('tr');
  for (const cell of header) hr.appendChild(appendInline(el('th'), cell));
  thead.appendChild(hr);
  table.appendChild(thead);

  const tbody = el('tbody');
  for (const row of rows) {
    const tr = el('tr');
    for (let c = 0; c < header.length; c += 1) {
      tr.appendChild(appendInline(el('td'), row[c] === undefined ? '' : row[c]));
    }
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  wrap.appendChild(table);
  return { node: wrap, next: i };
}

function buildList(lines, start, ordered) {
  const pattern = ordered ? OL_ITEM : UL_ITEM;
  const baseIndent = (lines[start].match(pattern) || [, ''])[1].length;
  const list = el(ordered ? 'ol' : 'ul', null, 'qa-md-list');
  let i = start;
  let lastItem = null;

  while (i < lines.length) {
    const m = lines[i].match(pattern);
    const other = lines[i].match(ordered ? UL_ITEM : OL_ITEM);
    if (!m) {
      // Dòng tiếp nối của mục trước (thụt vào, không phải mục mới).
      if (lastItem && lines[i].trim() && /^\s{2,}/.test(lines[i]) && !other) {
        lastItem.appendChild(document.createTextNode(' '));
        appendInline(lastItem, lines[i].trim());
        i += 1;
        continue;
      }
      break;
    }
    const indent = m[1].length;
    if (indent < baseIndent) break;
    if (indent > baseIndent) {
      const nested = buildList(lines, i, ordered ? /^\s*\d+[.)]\s/.test(lines[i]) : false);
      if (lastItem) lastItem.appendChild(nested.node);
      else list.appendChild(nested.node);
      i = nested.next;
      continue;
    }
    lastItem = el('li');
    appendInline(lastItem, ordered ? m[3] : m[2]);
    list.appendChild(lastItem);
    i += 1;
  }

  return { node: list, next: i };
}

/**
 * Tách YAML frontmatter ở đầu file.
 *
 * Tài liệu QA thật thường mở đầu bằng khối `---` chứa id / title / status / risk / owner.
 * Nếu để nguyên cho bộ dựng Markdown, `---` thành đường kẻ và phần còn lại thành một đoạn
 * văn dính liền — vừa xấu vừa chôn mất đúng phần siêu dữ liệu người đọc cần nhất.
 *
 * Cố tình chỉ đọc `key: value` một cấp. YAML lồng nhau không phải thứ tài liệu này dùng,
 * và viết một bộ phân tích YAML đầy đủ ở đây là rước thêm bề mặt lỗi.
 *
 * @returns {{meta: Array<[string, string]>, body: string}}
 */
export function parseFrontMatter(markdown) {
  const text = String(markdown == null ? '' : markdown);
  const lines = text.split(/\r?\n/);
  if (lines[0] !== '---') return { meta: [], body: text };

  const close = lines.indexOf('---', 1);
  if (close === -1) return { meta: [], body: text };

  const meta = [];
  for (const line of lines.slice(1, close)) {
    const at = line.indexOf(':');
    if (at <= 0) continue;
    const key = line.slice(0, at).trim();
    const value = line.slice(at + 1).trim().replace(/^["']|["']$/g, '');
    if (key) meta.push([key, value]);
  }
  return { meta, body: lines.slice(close + 1).join('\n') };
}

/**
 * @param {string} markdown Nội dung thô của file .md
 * @returns {DocumentFragment} Cây DOM đã dựng sẵn, chưa gắn vào đâu.
 */
export function renderMarkdown(markdown) {
  const frag = document.createDocumentFragment();
  const lines = String(markdown == null ? '' : markdown).split(/\r?\n/);
  let i = 0;
  let paragraph = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    const p = el('p', null, 'qa-md-p');
    appendInline(p, paragraph.join(' '));
    frag.appendChild(p);
    paragraph = [];
  };

  while (i < lines.length) {
    const line = lines[i];

    const fence = line.match(FENCE);
    if (fence) {
      flushParagraph();
      const body = [];
      i += 1;
      while (i < lines.length && !FENCE.test(lines[i])) {
        body.push(lines[i]);
        i += 1;
      }
      i += 1; // bỏ qua dòng đóng
      const pre = el('pre', null, 'qa-md-pre');
      pre.appendChild(el('code', body.join('\n')));
      if (fence[1].trim()) pre.dataset.lang = fence[1].trim();
      frag.appendChild(pre);
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      i += 1;
      continue;
    }

    if (HR.test(line)) {
      flushParagraph();
      frag.appendChild(el('hr', null, 'qa-md-hr'));
      i += 1;
      continue;
    }

    const heading = line.match(HEADING);
    if (heading) {
      flushParagraph();
      const level = Math.min(heading[1].length + 1, 6); // h1 của trang đã là tiêu đề view
      frag.appendChild(appendInline(el(`h${level}`, null, `qa-md-h qa-md-h${heading[1].length}`), heading[2]));
      i += 1;
      continue;
    }

    if (line.includes('|') && i + 1 < lines.length && TABLE_SEP.test(lines[i + 1])) {
      flushParagraph();
      const table = buildTable(lines, i);
      frag.appendChild(table.node);
      i = table.next;
      continue;
    }

    if (UL_ITEM.test(line) || OL_ITEM.test(line)) {
      flushParagraph();
      const list = buildList(lines, i, OL_ITEM.test(line));
      frag.appendChild(list.node);
      i = list.next;
      continue;
    }

    const quote = line.match(QUOTE);
    if (quote) {
      flushParagraph();
      const block = el('blockquote', null, 'qa-md-quote');
      const body = [quote[1]];
      i += 1;
      while (i < lines.length && QUOTE.test(lines[i])) {
        body.push(lines[i].match(QUOTE)[1]);
        i += 1;
      }
      appendInline(block, body.join(' '));
      frag.appendChild(block);
      continue;
    }

    paragraph.push(line.trim());
    i += 1;
  }

  flushParagraph();
  return frag;
}

/** Mục lục rút từ các tiêu đề, để nhảy nhanh trong tài liệu dài. */
export function outlineOf(markdown) {
  const out = [];
  let inFence = false;
  for (const line of String(markdown || '').split(/\r?\n/)) {
    if (FENCE.test(line)) { inFence = !inFence; continue; }
    if (inFence) continue;
    const m = line.match(HEADING);
    if (m) out.push({ level: m[1].length, text: m[2].replace(/[*`_]/g, '').trim() });
  }
  return out;
}

export default { renderMarkdown, outlineOf, parseFrontMatter };
