'use strict';

/**
 * dashboard/services/qa/heuristicInferenceEngine.js
 * Động cơ Heuristic: Phân tích cú pháp quy chuẩn BVA & Phân vùng tương đương (Offline, Zero-token).
 */

const { getNextTcId } = require('./markdownRequirementParser');

function inferWithHeuristic({ reqId: _reqId, decidedQuestions, existingTcIds, existingTcTitles, acs }) {
  const results = [];
  const assignedTcIds = new Set(existingTcIds);

  const allocateId = () => {
    let offset = 0;
    while (true) {
      const candidate = getNextTcId(assignedTcIds, offset);
      if (!assignedTcIds.has(candidate)) {
        assignedTcIds.add(candidate);
        return candidate;
      }
      offset += 1;
    }
  };

  const defaultAcId = acs.length ? acs[0].id : 'AC-001';

  for (const item of decidedQuestions) {
    const text = `${item.question} ${item.decision}`;

    const rangeMatch = text.match(/(?:từ\s*)?(\d+)\s*(?:đến|-)\s*(\d+)\s*(?:k[ýí]\s*tự|char|chữ)?/i);
    const minMatch = text.match(/tối\s*thiểu\s*(\d+)\s*(?:k[ýí]\s*tự|char|chữ)?/i);
    const maxMatch = text.match(/tối\s*đa\s*(\d+)\s*(?:k[ýí]\s*tự|char|chữ)?/i);

    let min = null;
    let max = null;
    if (rangeMatch) {
      min = parseInt(rangeMatch[1], 10);
      max = parseInt(rangeMatch[2], 10);
    } else {
      if (minMatch) min = parseInt(minMatch[1], 10);
      if (maxMatch) max = parseInt(maxMatch[1], 10);
    }

    let fieldName = 'trường dữ liệu';
    if (/mật\s*khẩu|password/i.test(text)) fieldName = 'mật khẩu';
    else if (/họ\s*tên|name/i.test(text)) fieldName = 'họ tên';
    else if (/số\s*điện\s*thoại|phone|sđt/i.test(text)) fieldName = 'số điện thoại';
    else if (/email/i.test(text)) fieldName = 'email';

    if (min !== null && min > 0) {
      const belowTitle = `Kiểm tra thất bại khi ${fieldName} có ${min - 1} ký tự (dưới biên tối thiểu ${min})`;
      if (!existingTcTitles.some((t) => t.includes(`${min - 1} ký tự`))) {
        results.push({
          suggestedId: allocateId(),
          acId: defaultAcId,
          title: belowTitle,
          priority: 'P1',
          automation: 'candidate',
          rationale: `Phân tích biên dưới từ quyết định ${item.id}: yêu cầu tối thiểu ${min} ký tự.`,
          precondition: 'Người dùng đang ở màn hình nhập liệu',
          testData: `${fieldName}: chuỗi ${min - 1} ký tự`,
          steps: [
            { step: 1, action: 'Nhập các trường thông tin hợp lệ khác', expected: 'Không có lỗi trên các trường hợp lệ' },
            { step: 2, action: `Nhập ${fieldName} có đúng ${min - 1} ký tự`, expected: `Hệ thống hiển thị thông báo lỗi yêu cầu tối thiểu ${min} ký tự` },
            { step: 3, action: 'Thử bấm xác nhận / submit', expected: 'Hệ thống chặn gửi form thành công' },
          ],
        });
      }
    }

    if (max !== null && max > 0) {
      const aboveTitle = `Kiểm tra thất bại khi ${fieldName} có ${max + 1} ký tự (vượt biên tối đa ${max})`;
      if (!existingTcTitles.some((t) => t.includes(`${max + 1} ký tự`))) {
        results.push({
          suggestedId: allocateId(),
          acId: defaultAcId,
          title: aboveTitle,
          priority: 'P2',
          automation: 'candidate',
          rationale: `Phân tích biên trên từ quyết định ${item.id}: giới hạn tối đa ${max} ký tự.`,
          precondition: 'Người dùng đang ở màn hình nhập liệu',
          testData: `${fieldName}: chuỗi ${max + 1} ký tự`,
          steps: [
            { step: 1, action: 'Nhập các trường thông tin hợp lệ', expected: 'Không có cảnh báo lỗi' },
            { step: 2, action: `Nhập ${fieldName} có ${max + 1} ký tự`, expected: `Hệ thống báo lỗi hoặc giới hạn không cho nhập quá ${max} ký tự` },
          ],
        });
      }

      if (min !== null && !existingTcTitles.some((t) => t.includes(`đúng ${min} và ${max}`))) {
        results.push({
          suggestedId: allocateId(),
          acId: defaultAcId,
          title: `Xác nhận thành công khi ${fieldName} đạt đúng biên ${min} và ${max} ký tự`,
          priority: 'P2',
          automation: 'candidate',
          rationale: `Kiểm tra biên hợp lệ (Valid Boundary) theo quyết định ${item.id}.`,
          precondition: 'Người dùng đang ở màn hình nhập liệu',
          testData: `${fieldName}: chuỗi đúng ${min} ký tự và chuỗi đúng ${max} ký tự`,
          steps: [
            { step: 1, action: `Nhập ${fieldName} có độ dài đúng ${min} ký tự và hoàn tất form`, expected: 'Hệ thống chấp nhận thông tin hợp lệ' },
            { step: 2, action: `Thử lại với ${fieldName} có độ dài đúng ${max} ký tự`, expected: 'Hệ thống chấp nhận thông tin hợp lệ' },
          ],
        });
      }
    }

    if (/(?:chữ\s*cái|chữ).*và.*(?:chữ\s*)?số/i.test(text) || /ít\s*nhất\s*1\s*chữ/i.test(text)) {
      if (!existingTcTitles.some((t) => t.includes('chỉ chứa chữ') || t.includes('thiếu số'))) {
        results.push({
          suggestedId: allocateId(),
          acId: defaultAcId,
          title: `Kiểm tra thất bại khi ${fieldName} chỉ chứa chữ cái (thiếu chữ số)`,
          priority: 'P1',
          automation: 'candidate',
          rationale: `Quy tắc độ phức tạp từ ${item.id}: bắt buộc chứa cả chữ và số.`,
          precondition: 'Người dùng đang ở màn hình nhập liệu',
          testData: `${fieldName}: 'Abcdefgh'`,
          steps: [
            { step: 1, action: `Nhập ${fieldName} chỉ gồm chữ cái hợp lệ nhưng không có số`, expected: 'Hệ thống báo lỗi yêu cầu phải chứa ít nhất 1 chữ số' },
          ],
        });
      }

      if (!existingTcTitles.some((t) => t.includes('chỉ chứa số') || t.includes('thiếu chữ'))) {
        results.push({
          suggestedId: allocateId(),
          acId: defaultAcId,
          title: `Kiểm tra thất bại khi ${fieldName} chỉ chứa chữ số (thiếu chữ cái)`,
          priority: 'P1',
          automation: 'candidate',
          rationale: `Quy tắc độ phức tạp từ ${item.id}: bắt buộc chứa cả chữ và số.`,
          precondition: 'Người dùng đang ở màn hình nhập liệu',
          testData: `${fieldName}: '12345678'`,
          steps: [
            { step: 1, action: `Nhập ${fieldName} chỉ gồm chữ số nhưng không có chữ cái`, expected: 'Hệ thống báo lỗi yêu cầu phải chứa ít nhất 1 chữ cái' },
          ],
        });
      }
    }

    if (/không\s*bắt\s*buộc/i.test(text) || /tùy\s*chọn/i.test(text) || /optional/i.test(text)) {
      let optField = 'trường tùy chọn';
      if (/số\s*điện\s*thoại|phone|sđt/i.test(text)) optField = 'số điện thoại';
      else if (/email/i.test(text)) optField = 'email';

      const optTitle = `Xác nhận thành công khi bỏ trống ${optField} (trường tùy chọn theo quyết định)`;
      if (!existingTcTitles.some((t) => t.includes(`bỏ trống ${optField}`))) {
        results.push({
          suggestedId: allocateId(),
          acId: defaultAcId,
          title: optTitle,
          priority: 'P1',
          automation: 'candidate',
          rationale: `Kiểm thử luồng rẽ nhánh từ quyết định ${item.id}: ${optField} không bắt buộc.`,
          precondition: 'Người dùng đang ở màn hình đăng ký / nhập liệu',
          testData: `Bỏ trống trường ${optField}`,
          steps: [
            { step: 1, action: 'Nhập đầy đủ các trường thông tin bắt buộc khác', expected: 'Các trường bắt buộc hợp lệ' },
            { step: 2, action: `Để trống trường ${optField} và bấm gửi form`, expected: `Hệ thống xử lý thành công, không báo lỗi thiếu ${optField}` },
          ],
        });
      }
    }

    if (results.length === 0 && item.decision) {
      const qTitle = `Kiểm thử hành vi theo quyết định: ${item.question.slice(0, 70)}`;
      const cleanQ = item.question.trim().replace(/\?+$/, '');
      const isDuplicate = existingTcTitles.some((t) => t.includes(cleanQ) || t.includes(qTitle) || t.includes(item.question.slice(0, 40)));
      if (!isDuplicate) {
        results.push({
          suggestedId: allocateId(),
          acId: defaultAcId,
          title: qTitle,
          priority: 'P2',
          automation: 'candidate',
          rationale: `Quyết định chốt từ ${item.id}: ${item.decision}`,
          precondition: 'Môi trường sẵn sàng cho kịch bản',
          testData: 'Dữ liệu theo nghiệp vụ đã chốt',
          steps: [
            { step: 1, action: `Thực hiện thao tác với điều kiện: ${item.decision.slice(0, 100)}`, expected: 'Hệ thống phản hồi đúng theo quyết định đã chốt' },
          ],
        });
      }
    }
  }

  return results;
}

module.exports = {
  inferWithHeuristic,
};
