'use strict';

/**
 * dashboard/services/qaFixTitle.js
 * Định vị và sửa title của `test(...)` / `test.describe(...)` trên một dòng (PLAN-18).
 * Chỉ xử lý title là chuỗi literal nằm cùng dòng với lời gọi; dạng khác trả `error` là
 * reasonCode để bộ sửa bỏ qua có lý do thay vì đoán.
 */

const { indentOf } = require('./qaFixText');

// `(?<![\w.$])` để không khớp `obj.test(`, `mytest(`; không có nhánh `.describe`/`.step`.
const TEST_CALL = /(?<![\w.$])test(?:\.(?:only|skip|fixme))?\s*\(\s*/;
const DESCRIBE_CALL = /(?<![\w.$])test\.describe(?:\.(?:only|skip|fixme|serial|parallel))*\s*\(\s*/;
const COMMENT_LINE = /^\s*(?:\/\/|\/\*|\*)/;
const RE_REQ_TAG = /^@REQ-\d{3}$/;

function readStringLiteral(line, start) {
  const quote = line[start];
  if (quote !== "'" && quote !== '"' && quote !== '`') return { error: 'TITLE_NOT_ON_LINE' };
  for (let i = start + 1; i < line.length; i++) {
    if (line[i] === '\\') {
      i++;
      continue;
    }
    if (line[i] === quote) {
      const value = line.slice(start + 1, i);
      if (quote === '`' && value.includes('${')) return { error: 'TEMPLATE_TITLE' };
      return { quote, value, start, end: i };
    }
  }
  return { error: 'TITLE_NOT_ON_LINE' };
}

/** { value, start, end } với start/end là vị trí dấu nháy mở/đóng; hoặc { error }. */
function locateTitle(line, { describe = false } = {}) {
  const match = (describe ? DESCRIBE_CALL : TEST_CALL).exec(String(line));
  if (!match) return { error: 'TITLE_NOT_ON_LINE' };
  return readStringLiteral(String(line), match.index + match[0].length);
}

/** Tag Playwright trong title: mọi token bắt đầu bằng `@`. */
function titleTags(title) {
  return String(title).split(/\s+/).filter((token) => token.startsWith('@'));
}

/** Thêm tag vào cuối title. Tag đã có -> ALREADY_FIXED. */
function appendTitleTag(line, tag, { describe = false } = {}) {
  const loc = locateTitle(line, { describe });
  if (loc.error) return loc;
  if (titleTags(loc.value).includes(tag)) return { error: 'ALREADY_FIXED' };
  const raw = loc.value.replace(/\s+$/, '');
  const insert = raw.length ? ` ${tag}` : tag;
  return { line: `${line.slice(0, loc.start + 1)}${raw}${insert}${line.slice(loc.end)}` };
}

/** `test.skip('…'` / `test.fixme('…'` -> `test('…'`. Dạng khác (vd. skip có điều kiện) -> CONDITIONAL_SKIP. */
function unskipDeclaration(line) {
  if (!/^(\s*)test\.(?:skip|fixme)\s*\(\s*['"`]/.test(line)) return { error: 'CONDITIONAL_SKIP' };
  return { line: line.replace(/^(\s*)test\.(?:skip|fixme)(?=\s*\()/, '$1test') };
}

/**
 * Tìm `test.describe` bao quanh dòng `index` theo thụt lề: dòng khác trống gần nhất phía trên
 * có thụt lề nhỏ hơn phải là describe. Kết quả:
 *  - { line, end }: chỉ số dòng describe và dòng đóng describe (0-based);
 *  - { none: true }: test ở cấp cao nhất, không có describe;
 *  - { error: 'DESCRIBE_NOT_RESOLVED' }: khối bao quanh không phải describe (vd. vòng for).
 */
function locateEnclosingDescribe(lines, index) {
  const own = indentOf(lines[index]);
  for (let i = index - 1; i >= 0; i--) {
    if (!lines[i].trim() || COMMENT_LINE.test(lines[i])) continue;
    const indent = indentOf(lines[i]);
    if (indent >= own) continue;
    if (!DESCRIBE_CALL.test(lines[i])) return { error: 'DESCRIBE_NOT_RESOLVED' };
    let end = lines.length - 1;
    for (let j = index + 1; j < lines.length; j++) {
      if (lines[j].trim() && indentOf(lines[j]) <= indent) {
        end = j;
        break;
      }
    }
    return { line: i, end };
  }
  return { none: true };
}

/**
 * Gắn tag REQ lên title của describe bao quanh test ở dòng `index` (AI_PROMPTS.md 3.3); test
 * không nằm trong describe thì gắn lên title test. Trả { edits, target } hoặc { skip }.
 */
function placeReqTag(lines, index, tag) {
  const describe = locateEnclosingDescribe(lines, index);
  if (describe.error) return { skip: describe.error };
  if (describe.none) {
    const res = appendTitleTag(lines[index], tag);
    if (res.error) return { skip: res.error };
    return { edits: [{ index, text: res.line }], target: { tag, tagLine: index + 1, tagOnDescribe: false } };
  }
  const others = [...reqTagsInRange(lines, describe.line, describe.end)].filter((t) => t !== tag);
  if (others.length) return { skip: 'DESCRIBE_MIXED_REQ' };
  const res = appendTitleTag(lines[describe.line], tag, { describe: true });
  if (res.error) return { skip: res.error === 'TITLE_NOT_ON_LINE' ? 'DESCRIBE_NOT_RESOLVED' : res.error };
  return { edits: [{ index: describe.line, text: res.line }], target: { tag, tagLine: describe.line + 1, tagOnDescribe: true } };
}

/** Các tag @REQ-xxx trong title của mọi test/describe từ dòng `from` tới `to` (0-based, gồm cả hai đầu). */
function reqTagsInRange(lines, from, to) {
  const tags = new Set();
  for (let i = from; i <= to && i < lines.length; i++) {
    for (const describe of [true, false]) {
      const loc = locateTitle(lines[i], { describe });
      if (!loc.error) titleTags(loc.value).filter((t) => RE_REQ_TAG.test(t)).forEach((t) => tags.add(t));
    }
  }
  return tags;
}

module.exports = {
  locateTitle,
  titleTags,
  appendTitleTag,
  unskipDeclaration,
  locateEnclosingDescribe,
  placeReqTag,
  reqTagsInRange,
};
