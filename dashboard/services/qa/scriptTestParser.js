'use strict';

/**
 * dashboard/services/qa/scriptTestParser.js
 * Bóc tách và trích xuất cấu trúc kịch bản từ Playwright Test Script.
 */

const { slugify } = require('./markdownRequirementParser');

function detectIsTestScript(text) {
  if (!text || typeof text !== 'string') return false;
  const patterns = [
    /\btest\s*\(/,
    /\btest\.describe\s*\(/,
    /\btest\.(?:skip|fixme|only)\s*\(/,
    /\bexpect\s*\(/,
    /\bpage\.(?:goto|fill|click|locator|waitForSelector|waitForURL)\b/,
    /from\s+['"][^'"]*playwright[^'"]*['"]/,
    /require\(['"][^'"]*baseTest['"]\)/,
    /async\s*\(\s*\{[^}]*page[^}]*\}\s*\)/,
  ];
  let matches = 0;
  for (const p of patterns) {
    if (p.test(text)) matches += 1;
  }
  return matches >= 2 || (matches >= 1 && (/\btest\s*\(/.test(text) || /\btest\.describe\s*\(/.test(text)));
}

function parseTestBlocksFromScript(content) {
  const blocks = [];
  const regex = /test(?:\.(?:skip|fixme|only))?\(\s*['"`]([^'"`]+)['"`]/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const rawTitle = match[1];
    const startIndex = match.index;
    const arrowIndex = content.indexOf('=>', startIndex);
    if (arrowIndex === -1) continue;
    const openBrace = content.indexOf('{', arrowIndex);
    if (openBrace === -1) continue;
    let depth = 1;
    let i = openBrace + 1;
    while (i < content.length && depth > 0) {
      if (content[i] === '{') depth += 1;
      else if (content[i] === '}') depth -= 1;
      i += 1;
    }
    const body = content.slice(openBrace + 1, i - 1);
    blocks.push({ rawTitle, body: body.trim() });
  }
  return blocks;
}

function extractHeuristicFromTestScript(rawContent, reqId, domain) {
  const describeMatch = rawContent.match(/test\.describe\(\s*['"`]([^'"`]+)['"`]/i);
  let title = 'Tính năng ' + reqId;
  if (describeMatch) {
    title = describeMatch[1]
      .replace(/^Feature:\s*/i, '')
      .replace(/@\S+/g, '')
      .replace(/REQ-\d{3}\s*[-–:]*\s*/gi, '')
      .trim();
  }

  const blocks = parseTestBlocksFromScript(rawContent);
  if (!describeMatch && blocks.length > 0) {
    title = blocks[0].rawTitle
      .replace(/TC-\d{3}\s*[-–:]*\s*/gi, '')
      .replace(/AC-\d{3}\s*[-–:]*\s*/gi, '')
      .replace(/@\S+/g, '')
      .trim();
  }

  const slug = slugify(title);
  const acMap = new Map();
  const testCases = [];

  blocks.forEach((block, idx) => {
    const num = idx + 1;
    const tcIdMatch = block.rawTitle.match(/\bTC-(\d{3})\b/i);
    const acIdMatch = block.rawTitle.match(/\bAC-(\d{3})\b/i);

    const tcId = tcIdMatch ? tcIdMatch[0].toUpperCase() : `TC-${String(num).padStart(3, '0')}`;
    const acId = acIdMatch ? acIdMatch[0].toUpperCase() : `AC-${String(Math.min(num, 10)).padStart(3, '0')}`;

    const cleanTitle = block.rawTitle
      .replace(/\bTC-\d{3}\s*[-–:]*\s*/gi, '')
      .replace(/\bAC-\d{3}\s*[-–:]*\s*/gi, '')
      .replace(/@\S+/g, '')
      .trim() || `Kiểm thử kịch bản ${num}`;

    if (!acMap.has(acId)) {
      acMap.set(acId, {
        id: acId,
        title: cleanTitle,
        given: 'Người dùng truy cập vào hệ thống và mở giao diện tính năng ' + title,
        when: 'Thực hiện thao tác: ' + cleanTitle,
        then: 'Hệ thống thực hiện xử lý hợp lệ và trả về kết quả mong đợi',
      });
    }

    const priority = /lỗi|sai|boundary|biên|invalid|fail|thiếu/i.test(cleanTitle) ? 'P2' : 'P1';
    const stepMatches = [...block.body.matchAll(/test\.step\(\s*['"`]([^'"`]+)['"`]/g)];
    const steps = stepMatches.length > 0
      ? stepMatches.map((m, sIdx) => ({
        step: sIdx + 1,
        action: m[1].replace(/^(?:Given|When|Then|Bước\s*\d+:?)\s*/i, '').trim(),
        expected: 'Hệ thống thực hiện thành công bước kiểm thử',
      }))
      : [
        { step: 1, action: 'Truy cập màn hình tính năng', expected: 'Trang hiển thị đầy đủ giao diện' },
        { step: 2, action: `Thực hiện kịch bản: ${cleanTitle}`, expected: 'Khớp kết quả mong đợi theo nghiệp vụ' },
      ];

    testCases.push({
      id: tcId,
      acId,
      title: cleanTitle,
      priority,
      automation: 'Yes',
      precondition: 'Môi trường sẵn sàng, dữ liệu kiểm thử đã được chuẩn bị',
      body: block.body,
      steps,
    });
  });

  const acs = Array.from(acMap.values());
  if (acs.length === 0) {
    acs.push({
      id: 'AC-001',
      title,
      given: 'Người dùng truy cập vào chức năng ' + title,
      when: 'Thực hiện các thao tác kiểm thử chính',
      then: 'Hệ thống xử lý chính xác và phản hồi kết quả hợp lệ',
    });
    testCases.push({
      id: 'TC-001',
      acId: 'AC-001',
      title,
      priority: 'P1',
      automation: 'Yes',
      precondition: 'Môi trường sẵn sàng',
      body: rawContent,
      steps: [
        { step: 1, action: 'Thực hiện kịch bản kiểm thử', expected: 'Các assertions thành công' },
      ],
    });
  }

  return {
    title,
    slug,
    domain: domain || 'general',
    businessGoal: `Mô tả mục tiêu nghiệp vụ của tính năng ${title} (được suy luận từ automation test script).`,
    acs,
    testCases,
  };
}

module.exports = {
  detectIsTestScript,
  parseTestBlocksFromScript,
  extractHeuristicFromTestScript,
};
