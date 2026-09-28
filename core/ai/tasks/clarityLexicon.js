/**
 * core/ai/tasks/clarityLexicon.js
 * Vague-term lexicon for requirement clarity checks, grouped after the
 * ISO/IEC/IEEE 29148 ambiguity indicators. Each group shares a reason and a rewrite hint;
 * `hints` overrides the hint for individual phrases. Strict ceiling <= 150 lines.
 */
const CLARITY_LEXICON = [
  {
    group: 'performance',
    reason: 'Thiếu mốc thời gian SLA cụ thể, không đo lường được',
    suggestion: 'Nêu ngưỡng đo được, ví dụ phản hồi dưới 2000 ms ở 95% yêu cầu',
    hints: { 'mượt mà': 'Tốc độ khung hình >= 60 fps, không giật khi cuộn' },
    phrases: ['nhanh chóng', 'nhanh', 'kịp thời', 'sớm', 'tức thì', 'mượt mà', 'hiệu quả', 'fast', 'quick', 'quickly', 'promptly', 'responsive', 'efficient']
  },
  {
    group: 'subjective',
    reason: 'Cảm tính, mỗi người hiểu một kiểu nên không kiểm thử được',
    suggestion: 'Thay bằng tiêu chí quan sát được (số bước thao tác, chuẩn thiết kế, WCAG)',
    hints: {
      'dễ dàng': 'Hoàn tất trong tối đa 3 lần bấm',
      'đẹp mắt': 'Tuân thủ Design Tokens của Figma và chuẩn tương phản WCAG AA',
      'tiện lợi': 'Nêu cụ thể tiện ích, ví dụ tự điền dữ liệu từ phiên trước'
    },
    phrases: ['dễ dàng', 'dễ dùng', 'dễ sử dụng', 'thân thiện', 'tiện lợi', 'trực quan', 'đẹp mắt', 'hiện đại', 'chuyên nghiệp', 'user-friendly', 'easy', 'intuitive', 'nice']
  },
  {
    group: 'loophole',
    reason: 'Điều kiện rẽ nhánh không rõ: ai quyết định khi nào "cần"',
    suggestion: 'Nêu rõ điều kiện kích hoạt, tiền điều kiện và vai trò được phép',
    phrases: ['nếu cần', 'nếu có thể', 'khi cần thiết', 'khi thích hợp', 'tùy trường hợp', 'tùy ý', 'as needed', 'if possible', 'if necessary', 'as appropriate', 'where applicable']
  },
  {
    group: 'quantity',
    reason: 'Số lượng mơ hồ, không xác định được giá trị biên',
    suggestion: 'Nêu con số hoặc khoảng cụ thể (tối thiểu / tối đa)',
    phrases: ['một số', 'vài', 'đa số', 'phần lớn', 'hầu hết', 'xấp xỉ', 'some', 'several', 'many', 'most', 'approximately']
  },
  {
    group: 'qualifier',
    reason: 'Tính từ đánh giá không có chuẩn đối chiếu',
    suggestion: 'Nêu giá trị hoặc quy tắc cụ thể được coi là đạt',
    phrases: ['thích hợp', 'phù hợp', 'hợp lý', 'vừa phải', 'đầy đủ', 'ổn định', 'appropriate', 'suitable', 'reasonable', 'adequate', 'sufficient', 'stable']
  },
  {
    group: 'superlative',
    reason: 'Mục tiêu tuyệt đối/tối ưu không có điểm dừng để nghiệm thu',
    suggestion: 'Đặt ngưỡng chấp nhận cụ thể thay cho "tối ưu"/"tốt nhất"',
    phrases: ['tối ưu', 'tốt nhất', 'hoàn hảo', 'tối đa hóa', 'tối thiểu hóa', 'optimal', 'best', 'perfect', 'maximize', 'minimize']
  },
  {
    group: 'comparative',
    reason: 'So sánh không có mốc gốc để đối chiếu',
    suggestion: 'Nêu giá trị hiện tại và giá trị mục tiêu, ví dụ từ 5 s xuống 2 s',
    phrases: ['cải thiện', 'nâng cao', 'tốt hơn', 'nhanh hơn', 'better', 'faster', 'improved', 'enhanced']
  },
  {
    group: 'open-ended',
    reason: 'Danh sách mở, không biết phạm vi kiểm thử dừng ở đâu',
    suggestion: 'Liệt kê đầy đủ các phần tử thuộc phạm vi',
    phrases: ['v.v.', 'vv.', 'etc.', 'and so on', 'bao gồm nhưng không giới hạn', 'including but not limited to']
  }
];

// Longer fixed expressions that contain a lexicon phrase but are not vague.
const CLARITY_EXCLUSIONS = ['một số điện thoại', 'một số tiền'];

module.exports = { CLARITY_LEXICON, CLARITY_EXCLUSIONS };
