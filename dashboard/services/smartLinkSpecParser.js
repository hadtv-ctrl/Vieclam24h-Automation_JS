'use strict';

/**
 * dashboard/services/smartLinkSpecParser.js
 * Bóc tách cấu trúc kịch bản kiểm thử Playwright (.spec.js, .spec.ts),
 * tính specHash và thẩm định tính an toàn của đường dẫn spec.
 * Ngân sách dòng: <= 200 dòng.
 */

const crypto = require('node:crypto');
const path = require('node:path');
const { httpError } = require('./qaBatchSessionStore');

const RE_REQ_TAG = /@REQ-(\d{3})\b/g;
const RE_VALID_REQ_ID = /^REQ-\d{3}$/;

/** Thẩm định specPath an toàn: bắt buộc nằm trong tests/ và có đuôi .spec.js|.spec.ts */
function assertSpecPath(root, specPath) {
  if (typeof specPath !== 'string' || !specPath.trim()) {
    throw httpError(400, 'INVALID_PARAMS', 'specPath không được rỗng.');
  }
  const base = path.resolve(root);
  const testsDir = path.resolve(base, 'tests');
  const abs = path.resolve(base, specPath.trim());
  if (abs !== testsDir && !abs.startsWith(testsDir + path.sep)) {
    throw httpError(403, 'PATH_REJECTED', `Đường dẫn spec phải nằm trong thư mục tests/: ${specPath}`);
  }
  if (!/\.spec\.(js|ts)$/i.test(abs)) {
    throw httpError(400, 'INVALID_PARAMS', `specPath phải có phần mở rộng .spec.js hoặc .spec.ts: ${specPath}`);
  }
  return abs;
}

/** Chuẩn hoá EOL về \n và tính SHA-256 hex */
function computeSpecHash(content) {
  const normalized = String(content || '').replace(/\r\n/g, '\n');
  return crypto.createHash('sha256').update(normalized, 'utf8').digest('hex');
}

/** Bóc tách từ khoá định danh và danh sách test từ chuỗi spec */
function parseSpecContent(content) {
  const normalized = String(content || '').replace(/\r\n/g, '\n');

  // 1. Tìm các tag @REQ-xxx
  const existingReqTags = [];
  const reqMatches = normalized.matchAll(RE_REQ_TAG);
  for (const match of reqMatches) {
    const fullTag = `REQ-${match[1]}`;
    if (!existingReqTags.includes(fullTag)) {
      existingReqTags.push(fullTag);
    }
  }

  // 2. Tìm danh sách describe
  const describeTitles = [];
  const describeRegex = /test\.describe(?:\.(?:parallel|serial|only|skip|fixme))?\s*\(\s*(['"`])((?:\\.|(?!\1).)*)\1/g;
  let dMatch;
  while ((dMatch = describeRegex.exec(normalized)) !== null) {
    const dt = dMatch[2].trim();
    if (dt && !describeTitles.includes(dt)) describeTitles.push(dt);
  }
  const describeTitle = describeTitles.join(' — ');

  // 3. Tìm danh sách test()
  const tests = [];
  const testRegex = /test(?:\.(?:only|skip|fixme))?\s*\(\s*(['"`])((?:\\.|(?!\1).)*)\1[\s\S]*?(?=(?:(?:\r?\n)\s*(?:test|it)(?:\.(?:only|skip|fixme))?\s*\(\s*['"`])|$)/g;
  let testMatch;
  while ((testMatch = testRegex.exec(normalized)) !== null) {
    const title = (testMatch[2] || '').trim();
    const body = testMatch[0];
    const steps = [];
    const stepRegex = /test\.step\s*\(\s*(['"`])((?:\\.|(?!\1).)*)\1/g;
    let stepMatch;
    while ((stepMatch = stepRegex.exec(body)) !== null) {
      steps.push(stepMatch[2].trim());
    }

    // Trích xuất assertion khi không có test.step()
    const assertions = [];
    const expectLines = body.split(/\r?\n/).filter((l) => l.includes('expect('));
    for (const elLine of expectLines) {
      const trimmed = elLine.trim().replace(/^await\s+/, '').replace(/;$/, '');
      if (trimmed) assertions.push(trimmed);
    }

    // Bóc tách tag trong tiêu đề test (@smoke, @regression,...)
    const tags = (title.match(/@[a-zA-Z0-9_\-]+/g) || []).map((t) => t.trim());
    tests.push({ title, steps, tags, assertions });
  }

  // 4. Bóc tách tên Page Object được import/new
  const pageObjects = [];
  const poRegex = /(?:class|new|require\(['"].*?pages\/.*?['"]\)|import.*?from\s+['"].*?pages\/.*?['"])/g;
  const poMatches = normalized.matchAll(/(?:new\s+([A-Z][a-zA-Z0-9]*Page)|class\s+([A-Z][a-zA-Z0-9]*Page))/g);
  for (const m of poMatches) {
    const name = m[1] || m[2];
    if (name && !pageObjects.includes(name)) pageObjects.push(name);
  }

  // 5. Bóc tách URL target
  const urls = [];
  const urlMatches = normalized.matchAll(/https?:\/\/[^\s'")`]+/g);
  for (const u of urlMatches) {
    if (!urls.includes(u[0])) urls.push(u[0]);
  }

  return {
    describeTitle,
    describeTitles,
    existingReqTags,
    hasExistingReq: existingReqTags.length > 0,
    tests,
    pageObjects,
    urls,
  };
}

module.exports = {
  RE_VALID_REQ_ID,
  assertSpecPath,
  computeSpecHash,
  parseSpecContent,
};
