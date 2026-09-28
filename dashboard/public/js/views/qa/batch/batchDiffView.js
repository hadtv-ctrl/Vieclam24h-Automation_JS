/**
 * dashboard/public/js/views/qa/batch/batchDiffView.js
 * Hiển thị một hunk của bản vá (PLAN-18): số dòng, dòng ngữ cảnh, dòng cũ (−) và mới (+).
 * Dựng bằng textContent — nội dung đến từ file của repo, không bao giờ đi qua innerHTML.
 */

function diffRow(lineNo, sign, text, modifier) {
  const row = document.createElement('div');
  row.className = `qa-diff-row${modifier ? ` ${modifier}` : ''}`;
  const no = document.createElement('span');
  no.className = 'qa-diff-no';
  no.textContent = String(lineNo);
  const mark = document.createElement('span');
  mark.className = 'qa-diff-sign';
  mark.textContent = sign;
  mark.setAttribute('aria-hidden', 'true');
  const code = document.createElement('code');
  code.className = 'qa-diff-code';
  code.textContent = text;
  if (modifier === 'is-del') code.setAttribute('aria-label', `Dòng cũ ${lineNo}: ${text}`);
  if (modifier === 'is-add') code.setAttribute('aria-label', `Dòng mới ${lineNo}: ${text}`);
  row.append(no, mark, code);
  return row;
}

/** hunk = { startLine, changedLines, insertedLines?, before, after } — hunk chèn dòng thì before rỗng. */
export function renderHunk(hunk) {
  const box = document.createElement('div');
  box.className = 'qa-diff';
  const inserted = new Set(hunk.insertedLines || []);
  if (inserted.size) {
    (hunk.after || []).forEach((line, i) => {
      const lineNo = hunk.startLine + i;
      box.append(inserted.has(lineNo) ? diffRow(lineNo, '+', line, 'is-add') : diffRow(lineNo, ' ', line, ''));
    });
    return box;
  }
  const changed = new Set(hunk.changedLines || []);
  (hunk.before || []).forEach((line, i) => {
    const lineNo = hunk.startLine + i;
    if (changed.has(lineNo)) {
      box.append(diffRow(lineNo, '−', line, 'is-del'), diffRow(lineNo, '+', hunk.after[i], 'is-add'));
    } else {
      box.append(diffRow(lineNo, ' ', line, ''));
    }
  });
  return box;
}

/** Đoạn mã chỉ đọc cho modal chi tiết: đánh dấu dòng lỗi. */
export function renderExcerpt({ startLine, lines, line }) {
  const box = document.createElement('div');
  box.className = 'qa-diff qa-diff-excerpt';
  lines.forEach((text, i) => {
    const lineNo = startLine + i;
    box.append(diffRow(lineNo, lineNo === line ? '›' : ' ', text, lineNo === line ? 'is-focus' : ''));
  });
  return box;
}
