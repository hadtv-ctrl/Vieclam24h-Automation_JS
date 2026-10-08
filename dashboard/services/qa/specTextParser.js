'use strict';

/**
 * dashboard/services/qa/specTextParser.js
 * Bóc tách và trích xuất cấu trúc kịch bản từ Spec Text / User Story thô.
 */

const { slugify } = require('./markdownRequirementParser');

function extractHeuristicFromSpecText(rawContent, reqId, domain) {
  const lines = rawContent.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  let title = '';
  for (const line of lines) {
    const titleMatch = line.match(/^(?:#+\s*|Tính năng\s*[:\-—]\s*|Feature\s*[:\-—]\s*|Tên tính năng\s*[:\-—]\s*)(.*)$/i);
    if (titleMatch && titleMatch[1].trim()) {
      title = titleMatch[1].replace(/REQ-\d{3}\s*[-–:]*\s*/gi, '').trim();
      break;
    }
  }
  if (!title && lines.length > 0) {
    title = lines[0].replace(/^#+\s*/, '').replace(/REQ-\d{3}\s*[-–:]*\s*/gi, '').trim();
  }
  if (!title) title = `Tính năng ${reqId}`;

  const slug = slugify(title);
  const acs = [];
  const acRegex = /(?:AC-?(\d+)|Tiêu chí (\d+)|Criterion (\d+))\s*[:\-—]?\s*(.*)/i;

  for (const line of lines) {
    const m = line.match(acRegex);
    if (m) {
      const acNum = m[1] || m[2] || m[3];
      const acId = `AC-${String(acNum).padStart(3, '0')}`;
      const acDesc = (m[4] || '').trim();
      if (!acs.some((a) => a.id === acId)) {
        acs.push({
          id: acId,
          title: acDesc || `Tiêu chí ${acNum}`,
          given: `Người dùng truy cập vào chức năng ${title}`,
          when: `Thực hiện thao tác: ${acDesc || acId}`,
          then: 'Hệ thống xử lý hợp lệ và phản hồi đúng quy chuẩn',
        });
      }
    }
  }

  if (acs.length === 0) {
    const bulletLines = lines.filter((l) => /^[-*+]\s+/.test(l) || /^\d+[.)]\s+/.test(l));
    const targetBullets = bulletLines.length > 0 ? bulletLines.slice(0, 6) : lines.slice(1, 4);

    targetBullets.forEach((bullet, idx) => {
      const acId = `AC-${String(idx + 1).padStart(3, '0')}`;
      const cleanBullet = bullet.replace(/^[-*+\d.)\s]+/, '').trim();
      acs.push({
        id: acId,
        title: cleanBullet.slice(0, 90) || `Tiêu chí chấp nhận ${idx + 1}`,
        given: `Người dùng đã đăng nhập hoặc truy cập tính năng ${title}`,
        when: `Thực hiện kiểm thử: ${cleanBullet}`,
        then: 'Hệ thống phản hồi chính xác và cập nhật dữ liệu tương ứng',
      });
    });
  }

  if (acs.length === 0) {
    acs.push({
      id: 'AC-001',
      title: `Quy tắc xử lý chính của ${title}`,
      given: 'Hệ thống sẵn sàng',
      when: 'Người dùng thực hiện thao tác trên giao diện',
      then: 'Xử lý thành công và hiển thị thông báo hợp lệ',
    });
  }

  const testCases = [];
  acs.forEach((ac, idx) => {
    const p1Num = String(idx * 2 + 1).padStart(3, '0');
    const p2Num = String(idx * 2 + 2).padStart(3, '0');

    testCases.push({
      id: `TC-${p1Num}`,
      acId: ac.id,
      title: `Kiểm tra thành công theo ${ac.id}: ${ac.title}`,
      priority: 'P1',
      automation: 'Candidate',
      precondition: ac.given || 'Môi trường sẵn sàng',
      steps: [
        { step: 1, action: 'Truy cập màn hình tính năng', expected: 'Giao diện hiển thị đầy đủ' },
        { step: 2, action: `Thực hiện thao tác: ${ac.when || ac.title}`, expected: ac.then || 'Thao tác thành công' },
      ],
    });

    testCases.push({
      id: `TC-${p2Num}`,
      acId: ac.id,
      title: `Kiểm tra thất bại / xử lý biên cho ${ac.id}`,
      priority: 'P2',
      automation: 'Candidate',
      precondition: ac.given || 'Môi trường sẵn sàng',
      steps: [
        { step: 1, action: 'Truy cập màn hình tính năng', expected: 'Giao diện hiển thị đầy đủ' },
        { step: 2, action: 'Nhập dữ liệu không hợp lệ hoặc vượt biên', expected: 'Hiển thị thông báo lỗi rõ ràng' },
      ],
    });
  });

  return {
    title,
    slug,
    domain: domain || 'general',
    businessGoal: `Mô tả mục tiêu nghiệp vụ cho ${title}. Đảm bảo các quy trình vận hành chính xác và thân thiện với người dùng.`,
    acs,
    testCases,
  };
}

module.exports = {
  extractHeuristicFromSpecText,
};
