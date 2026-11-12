'use strict';

/** Đọc requirements/ và test-cases/ thành map định danh (REQ -> AC, TC -> AC/priority/automation). */

const fs = require('fs');
const path = require('path');
const {
  RE_REQ, RE_AC, RE_TC, RE_PRIORITY,
  findMalformedIds, readAutomationColumn, listFiles, uniqueMatches, stripCodeBlocks,
} = require('./qaTraceShared');

function parseRequirements(root, dir) {
  const files = listFiles(root, dir, (n) => n.endsWith('.md') && n.toUpperCase() !== 'README.MD');
  const requirements = new Map();

  const unreadable = [];
  const malformed = [];
  const withoutAc = [];

  for (const file of files) {
    const text = stripCodeBlocks(fs.readFileSync(path.join(root, file), 'utf8'));
    const bad = findMalformedIds(text);
    if (bad.length) malformed.push({ file, ids: bad });

    const reqIds = uniqueMatches(text, RE_REQ);
    if (!reqIds.length) {
      unreadable.push(file);
      continue;
    }
    const primary = reqIds[0];
    const acs = uniqueMatches(text, RE_AC);
    if (!acs.length) withoutAc.push({ file, req: primary });

    const existing = requirements.get(primary) || { id: primary, files: [], acs: [] };
    existing.files.push(file);
    existing.acs = [...new Set([...existing.acs, ...acs])];
    requirements.set(primary, existing);
  }
  return { files, requirements, unreadable, malformed, withoutAc };
}

function parseTestCases(root, dir) {
  const files = listFiles(root, dir, (n) => n.endsWith('.md') && n.toUpperCase() !== 'README.MD');
  const testCases = new Map();
  const unreadable = [];
  const malformed = [];

  for (const file of files) {
    const raw = fs.readFileSync(path.join(root, file), 'utf8');
    const text = stripCodeBlocks(raw);
    const fileReq = uniqueMatches(text, RE_REQ)[0] || null;

    const bad = findMalformedIds(text);
    if (bad.length) malformed.push({ file, ids: bad });
    if (!uniqueMatches(text, RE_TC).length) unreadable.push(file);

    // Mỗi dòng chứa TC-xxx được coi là một khai báo test case; AC và priority lấy trên cùng dòng.
    for (const line of text.split(/\r?\n/)) {
      const tcIds = uniqueMatches(line, RE_TC);
      if (!tcIds.length) continue;
      const acOnLine = uniqueMatches(line, RE_AC);
      const priorityMatch = RE_PRIORITY.exec(line);
      for (const tc of tcIds) {
        // Một TC thường xuất hiện ở nhiều nơi: bảng traceability (có AC + priority),
        // automation plan, phần mô tả chi tiết. GỘP chứ không để bản gặp trước thắng —
        // nếu không, thứ tự đọc thư mục sẽ quyết định dữ liệu nào bị mất.
        const existing = testCases.get(tc) || {
          id: tc, req: null, acs: [], priority: null, automation: null, file, files: [], title: '',
        };
        existing.automation = existing.automation || readAutomationColumn(line);
        existing.req = existing.req || uniqueMatches(line, RE_REQ)[0] || fileReq;
        existing.acs = [...new Set([...existing.acs, ...acOnLine])];
        existing.priority = existing.priority || (priorityMatch ? `P${priorityMatch[1]}` : null);
        if (!existing.files.includes(file)) existing.files.push(file);
        // Ưu tiên giữ dòng có AC làm title, vì đó là dòng khai báo chính thức.
        if (!existing.title || (acOnLine.length && !RE_AC.test(existing.title))) {
          existing.title = line.trim().slice(0, 160);
          existing.file = file;
        }
        RE_AC.lastIndex = 0;
        testCases.set(tc, existing);
      }
    }
  }
  return { files, testCases, unreadable, malformed };
}

module.exports = { parseRequirements, parseTestCases };
