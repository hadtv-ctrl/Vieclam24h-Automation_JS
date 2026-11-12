'use strict';

/** Đọc tĩnh các file spec: tag @REQ ở describe, mã TC/AC ở title và dấu hiệu assertion trong thân test. */

const fs = require('fs');
const path = require('path');
const { RE_REQ, RE_AC, RE_TC, listFiles, uniqueMatches } = require('./qaTraceShared');

function parseSpecs(root, dir) {
  const files = listFiles(root, dir, (n) => n.endsWith('.spec.js') || n.endsWith('.spec.ts'));
  const specs = [];

  for (const file of files) {
    const text = fs.readFileSync(path.join(root, file), 'utf8');
    const describeTitles = [...text.matchAll(/\btest\.describe\s*\(\s*(['"`])([\s\S]*?)\1/g)].map((m) => m[2]);

    // Cắt từng khối test để soi được THÂN hàm, không chỉ title: một test tuyên bố phủ AC-001
    // nhưng bên trong không có assertion nào thì nó không kiểm chứng gì cả.
    const testMatches = [...text.matchAll(/(?<!\.)\btest\s*\(\s*(['"`])([\s\S]*?)\1/g)];
    const blocks = testMatches.map((m, i) => {
      const start = m.index;
      const end = i + 1 < testMatches.length ? testMatches[i + 1].index : text.length;
      const body = text.slice(start, end);
      return {
        title: m[2],
        tcs: uniqueMatches(m[2], RE_TC),
        acs: uniqueMatches(m[2], RE_AC),
        // Repo theo POM: assertion thường nằm trong helper/Page Object đặt tên expectXxx/verifyXxx/assertXxx.
        hasAssertion: /\bexpect\s*\(|\bassert[.(]|\b(?:expect|verify|assert)[A-Z]\w*\s*\(/.test(body),
      };
    });

    const testTitles = blocks.map((b) => b.title);
    const reqs = [...new Set(describeTitles.concat(testTitles).flatMap((t) => uniqueMatches(t, RE_REQ)))];
    const tcs = [...new Set(blocks.flatMap((b) => b.tcs))];
    const acs = [...new Set(blocks.flatMap((b) => b.acs))];

    specs.push({ file, reqs, tcs, acs, blocks, testCount: blocks.length });
  }
  return { files, specs };
}

module.exports = { parseSpecs };
