/**
 * dashboard/public/js/views/qa/openQuestions.js
 * Đọc và trả lời mục "Open questions" trong tài liệu requirement.
 *
 * Toàn bộ là hàm thuần trên chuỗi: nhận Markdown, trả Markdown. Không đụng DOM, không gọi
 * mạng — nhờ vậy phép biến đổi nguy hiểm nhất của tính năng này (ghi đè tài liệu nghiệp vụ)
 * kiểm được bằng unit test, không phải bằng mắt.
 *
 * Nguyên tắc: CHỈ sửa đúng dòng câu hỏi được trả lời. Mọi dòng khác của tài liệu — kể cả
 * khoảng trắng và thứ tự — giữ nguyên byte. Một công cụ "viết lại cho trơn tru" mà tiện tay
 * sắp xếp lại tài liệu của người khác là công cụ không ai dám bấm lần thứ hai.
 */

const HEADING_ANY = /^#{1,6}\s+(.*)$/;
const OPEN_QUESTIONS_HEADING = /^#{1,6}\s+open\s+questions\b/i;
const NUMBERED_ITEM = /^(\s*)(\d+)([.)])\s+(.*)$/;
const BULLET_ITEM = /^(\s*)([-*+])\s+(.*)$/;

// Đuôi "— cần PO xác nhận" / "- cần QA Lead xác nhận": dấu hiệu câu hỏi còn treo.
const PENDING_SUFFIX = /\s*[—–-]\s*c[ầa]n\s+[^—–-]*?x[áa]c\s+nh[ậa]n\s*$/i;
const ANSWERED_MARK = /\*\*Đã chốt\b/;

/** Chỉ số dòng mở đầu và kết thúc của mục Open questions, hoặc null nếu không có. */
function locateSection(lines) {
  const start = lines.findIndex((l) => OPEN_QUESTIONS_HEADING.test(l));
  if (start === -1) return null;

  const level = (lines[start].match(/^(#+)/) || [, '#'])[1].length;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    const m = lines[i].match(HEADING_ANY);
    if (!m) continue;
    const thisLevel = (lines[i].match(/^(#+)/) || [, '#'])[1].length;
    if (thisLevel <= level) { end = i; break; }
  }
  return { start, end };
}

/**
 * @param {string} markdown
 * @returns {{found: boolean, questions: Array<{line: number, id: string, text: string, answered: boolean}>}}
 */
export function parseOpenQuestions(markdown) {
  const lines = String(markdown == null ? '' : markdown).split(/\r?\n/);
  const section = locateSection(lines);
  if (!section) return { found: false, questions: [] };

  const questions = [];
  for (let i = section.start + 1; i < section.end; i += 1) {
    const line = lines[i];
    const numbered = line.match(NUMBERED_ITEM);
    const bullet = numbered ? null : line.match(BULLET_ITEM);
    if (!numbered && !bullet) continue;

    const text = (numbered ? numbered[4] : bullet[3]).trim();
    if (!text) continue;
    questions.push({
      line: i,
      id: numbered ? `Q-${numbered[2]}` : `Q-${questions.length + 1}`,
      text,
      answered: ANSWERED_MARK.test(text),
    });
  }
  return { found: true, questions };
}

/**
 * Ghi câu trả lời vào đúng dòng câu hỏi.
 *
 * Đuôi "— cần PO xác nhận" bị THAY THẾ bằng kết luận, chứ không phải nối thêm phía sau.
 * Nếu chỉ nối thêm, tài liệu sẽ mang cả câu hỏi treo lẫn câu trả lời và người đọc sau
 * không biết tin bên nào.
 *
 * @param {string} markdown
 * @param {Array<{line: number, answer: string}>} answers
 * @param {{author: string, date: string}} meta `date` truyền vào để hàm luôn thuần.
 * @returns {{content: string, applied: number}}
 */
export function applyAnswers(markdown, answers, meta = {}) {
  const lines = String(markdown == null ? '' : markdown).split(/\r?\n/);
  const author = String(meta.author || '').trim();
  const date = String(meta.date || '').trim();
  let applied = 0;

  for (const entry of answers || []) {
    const index = Number(entry && entry.line);
    const answer = String((entry && entry.answer) || '').trim();
    if (!answer || !Number.isInteger(index) || index < 0 || index >= lines.length) continue;

    const line = lines[index];
    const numbered = line.match(NUMBERED_ITEM);
    const bullet = numbered ? null : line.match(BULLET_ITEM);
    if (!numbered && !bullet) continue;

    const indent = numbered ? numbered[1] : bullet[1];
    const marker = numbered ? `${numbered[2]}${numbered[3]}` : bullet[2];
    const question = (numbered ? numbered[4] : bullet[3]).replace(PENDING_SUFFIX, '').trim();

    const stamp = [author, date].filter(Boolean).join(', ');
    const decided = stamp ? `**Đã chốt (${stamp}):**` : '**Đã chốt:**';
    lines[index] = `${indent}${marker} ${question} — ${decided} ${answer}`;
    applied += 1;
  }

  return { content: lines.join('\n'), applied };
}

export default { parseOpenQuestions, applyAnswers };
