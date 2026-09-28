/**
 * core/ai/tasks/heuristicTestCases.js
 * Rule-based test case design shared by the requirement analyzer (heuristic mode) and QA-1
 * test case generation: boundary values for the first numeric range, mandatory-field negatives,
 * and the generic create/update flows. 0 token, no AI call. Strict ceiling <= 150 lines.
 */
function buildHeuristicTestCases(rawText = '', { includeGenericFlows = true, startNumber = 1 } = {}) {
  const testCases = [];
  let tcIdCounter = startNumber;
  const nextId = () => `TC-${String(tcIdCounter++).padStart(3, '0')}`;

  // 1. Phân tích Boundary Value Analysis (BVA) & Con số
  const rangeMatch = rawText.match(/(?:từ\s*)?(\d+)\s*(?:đến|-)\s*(\d+)\s*(?:k[ýí]\s*tự|char|phường|xã|quận|huyện|mục|ảnh|item)?/i);
  const maxMatch = rawText.match(/tối\s*đa\s*(\d+)\s*(?:k[ýí]\s*tự|char|phường|xã|quận|huyện|mục|ảnh|item)?/i);
  const minMatch = rawText.match(/tối\s*thiểu\s*(\d+)\s*(?:k[ýí]\s*tự|char|phường|xã|quận|huyện|mục|ảnh|item)?/i);

  if (rangeMatch) {
    const min = parseInt(rangeMatch[1], 10);
    const max = parseInt(rangeMatch[2], 10);
    testCases.push({
      suggestedId: nextId(),
      title: `Kiểm tra giá trị hợp lệ trong khoảng chuẩn (${min} đến ${max})`,
      type: 'Positive',
      priority: 'P1',
      precondition: 'Người dùng ở màn hình nhập liệu',
      testData: `Số lượng/Độ dài: ${min}`,
      steps: [
        { step: 1, action: `Nhập giá trị hợp lệ (${min})`, expected: 'Hệ thống chấp nhận dữ liệu thành công' },
        { step: 2, action: 'Bấm Lưu / Submit', expected: 'Lưu thành công, không báo lỗi' },
      ],
    });
    if (min > 0) {
      testCases.push({
        suggestedId: nextId(),
        title: `Kiểm tra biên dưới: Thất bại khi dữ liệu < ${min} (vi phạm tối thiểu)`,
        type: 'Boundary',
        priority: 'P1',
        precondition: 'Người dùng ở màn hình nhập liệu',
        testData: `Số lượng/Độ dài: ${min - 1}`,
        steps: [
          { step: 1, action: `Nhập dữ liệu có độ dài/số lượng = ${min - 1}`, expected: `Hệ thống hiển thị cảnh báo yêu cầu tối thiểu ${min}` },
          { step: 2, action: 'Bấm Lưu', expected: 'Hệ thống chặn lưu thành công' },
        ],
      });
    }
    testCases.push({
      suggestedId: nextId(),
      title: `Kiểm tra biên trên: Chặn khi dữ liệu > ${max} (vượt quá giới hạn tối đa)`,
      type: 'Boundary',
      priority: 'P1',
      precondition: 'Người dùng ở màn hình nhập liệu',
      testData: `Số lượng/Độ dài: ${max + 1}`,
      steps: [
        { step: 1, action: `Nhập/chọn vượt quá giới hạn (${max + 1})`, expected: `Hệ thống chặn chọn hoặc báo lỗi tối đa ${max}` },
      ],
    });
  } else if (maxMatch) {
    const max = parseInt(maxMatch[1], 10);
    testCases.push({
      suggestedId: nextId(),
      title: `Kiểm tra lưu thành công khi đạt ngưỡng tối đa ${max}`,
      type: 'Positive',
      priority: 'P1',
      precondition: 'Màn hình có trường giới hạn tối đa',
      testData: `Đúng ${max} mục`,
      steps: [
        { step: 1, action: `Chọn/nhập đủ ${max} phần tử`, expected: `Hiển thị đủ ${max} phần tử, hệ thống cho phép lưu` },
      ],
    });
    testCases.push({
      suggestedId: nextId(),
      title: `Kiểm tra chặn phần tử thứ ${max + 1} vượt ngưỡng tối đa`,
      type: 'Boundary',
      priority: 'P1',
      precondition: 'Đã chọn đủ số lượng tối đa',
      testData: `Phần tử thứ ${max + 1}`,
      steps: [
        { step: 1, action: `Cố gắng chọn hoặc thêm phần tử thứ ${max + 1}`, expected: 'Hệ thống vô hiệu hóa nút thêm hoặc chặn chọn, thông báo đạt tối đa' },
      ],
    });
  }

  // 2. Phân tích trường bắt buộc (Mandatory)
  const isRequired = /bắt\s*buộc|chặn\s*lưu|không\s*được\s*để\s*trống/i.test(rawText);
  if (isRequired) {
    testCases.push({
      suggestedId: nextId(),
      title: 'Kiểm tra thất bại khi bỏ trống trường thông tin bắt buộc',
      type: 'Negative',
      priority: 'P0',
      precondition: 'Màn hình nhập thông tin',
      testData: 'Bỏ trống trường bắt buộc',
      steps: [
        { step: 1, action: 'Để trống trường bắt buộc và nhấn Lưu / Submit', expected: 'Hệ thống chặn lưu và hiển thị thông báo lỗi/toast validation' },
      ],
    });
  }

  if (includeGenericFlows) {
    // 3. Phân tích luồng tạo mới & chỉnh sửa
    testCases.push({
      suggestedId: nextId(),
      title: 'Kiểm tra luồng tạo mới thành công với đầy đủ dữ liệu hợp lệ',
      type: 'Positive',
      priority: 'P0',
      precondition: 'Tài khoản có quyền thao tác',
      testData: 'Dữ liệu hợp lệ chuẩn',
      steps: [
        { step: 1, action: 'Điền đầy đủ thông tin hợp lệ', expected: 'Không có lỗi validate' },
        { step: 2, action: 'Nhấn Lưu', expected: 'Dữ liệu được lưu và hiển thị đúng sau khi tải lại' },
      ],
    });

    testCases.push({
      suggestedId: nextId(),
      title: 'Kiểm tra cập nhật dữ liệu và kiểm tra tính toàn vẹn (Data Persistence)',
      type: 'Positive',
      priority: 'P1',
      precondition: 'Bản ghi đã tồn tại',
      testData: 'Giá trị cập nhật mới',
      steps: [
        { step: 1, action: 'Sửa giá trị trường dữ liệu và nhấn Lưu', expected: 'Hệ thống cập nhật thành công' },
        { step: 2, action: 'Reload lại trang / mở lại form', expected: 'Dữ liệu hiển thị đúng giá trị vừa cập nhật, không bị xoá trắng' },
      ],
    });
  }

  return { testCases, isRequired };
}

module.exports = { buildHeuristicTestCases };
