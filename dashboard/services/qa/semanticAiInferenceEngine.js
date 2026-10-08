'use strict';

/**
 * dashboard/services/qa/semanticAiInferenceEngine.js
 * Giao tiếp AI Gateway, prompt engineering và phân tích JSON từ mô hình ngôn ngữ lớn (LLM).
 */

const { callAi } = require('../../../core/ai/gateway/index');
const { getNextTcId } = require('./markdownRequirementParser');

async function inferWithAi({ reqId, reqContent: _reqContent, decidedQuestions, existingTcIds, existingTcTitles, acs, clientConfig, root, signal = null }) {
  const nextTcId = getNextTcId(existingTcIds);
  const acListStr = acs.map((a) => `- ${a.id}: ${a.title}`).join('\n') || '- AC-001: Yêu cầu chung';
  const existingTcStr = existingTcTitles.map((t) => `- ${t}`).join('\n') || '(Chưa có test case nào)';
  const decidedStr = decidedQuestions.map((q) => `[${q.id}] Câu hỏi: ${q.question}\n=> Đã chốt: ${q.decision}`).join('\n\n');

  const systemPrompt = `Bạn là Senior QA Automation Lead với hơn 10 năm kinh nghiệm trong kiểm thử phần mềm, Boundary Value Analysis (BVA), và Test Matrix Traceability.
Nhiệm vụ: Phân tích các câu hỏi vừa được chốt (Đã chốt) của Requirement ${reqId}, đối chiếu với các Acceptance Criteria (AC) và Test Cases (TC) đã có, từ đó suy luận và đề xuất các Test Case MỚI còn thiếu (ưu tiên các ca biên BVA, Negative tests, luồng rẽ nhánh, edge cases).

RÀNG BUỘC NGHIÊM NGẶT:
1. TUYỆT ĐỐI KHÔNG lặp lại các Test Case đã có trong danh sách.
2. Bắt đầu đánh số mã Test Case tiếp theo từ "${nextTcId}".
3. Gán đúng mã AC liên quan (từ danh sách AC đã có).
4. Độ ưu tiên phải là một trong: P0, P1, P2, P3. Trường "automation" luôn là "candidate".
5. Đầu ra PHẢI là một chuỗi JSON hợp lệ thuần túy, KHÔNG chứa chữ giải thích bên ngoài JSON. Schema yêu cầu:
{
  "testCases": [
    {
      "suggestedId": "TC-xxx",
      "acId": "AC-xxx",
      "title": "Tiêu đề ca kiểm thử rõ ràng, súc tích",
      "priority": "P1",
      "automation": "candidate",
      "rationale": "Lý do sinh test case từ quyết định chốt",
      "precondition": "Tiền điều kiện cụ thể",
      "testData": "Dữ liệu kiểm thử mẫu",
      "steps": [
        { "step": 1, "action": "Hành động thao tác", "expected": "Kết quả mong đợi chi tiết" }
      ]
    }
  ]
}`;

  const userPrompt = `DƯỚI ĐÂY LÀ THÔNG TIN NGHIỆP VỤ CẦN PHÂN TÍCH:

=== 1. DANH SÁCH CÂU HỎI VỪA CHỐT (QUYẾT ĐỊNH MỚI) ===
${decidedStr}

=== 2. DANH SÁCH ACCEPTANCE CRITERIA ĐÃ CÓ ===
${acListStr}

=== 3. DANH SÁCH TEST CASE HIỆN TẠI (ĐỂ TRÁNH TRÙNG LẶP) ===
${existingTcStr}

Hãy đề xuất các Test Case còn thiếu dựa trên các quyết định mới trên. Trả về đúng JSON schema quy định.`;

  const messages = [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }];
  const res = await callAi({
    task: 'inferTestCases',
    messages,
    schema: { type: 'object', properties: { testCases: { type: 'array' } } },
    clientConfig,
    root: root || process.cwd(),
    signal,
    tier: 'deep',
    timeoutMs: 60000,
  });

  if (!res.ok) {
    throw new Error(res.message || 'Lỗi khi gọi AI');
  }

  const list = Array.isArray(res.data?.testCases) ? res.data.testCases : [];
  return list.map((tc, idx) => ({
    suggestedId: tc.suggestedId || getNextTcId(existingTcIds, idx),
    acId: tc.acId || (acs[0] && acs[0].id) || 'AC-001',
    title: String(tc.title || '').trim(),
    priority: ['P0', 'P1', 'P2', 'P3'].includes(tc.priority) ? tc.priority : 'P2',
    automation: 'candidate',
    rationale: String(tc.rationale || ''),
    precondition: String(tc.precondition || 'Môi trường sẵn sàng'),
    testData: String(tc.testData || ''),
    steps: Array.isArray(tc.steps) ? tc.steps : [
      { step: 1, action: 'Thực hiện thao tác kiểm thử', expected: 'Kết quả như mong đợi' },
    ],
  }));
}

async function extractWithAi(root, rawContent, inputType, reqId, domain, payload = {}) {
  const systemPrompt = `Bạn là Senior QA Lead & Playwright Automation Architect.
Nhiệm vụ của bạn là phân tích nội dung do người dùng cung cấp (có thể là văn bản nghiệp vụ Spec/Requirement hoặc mã nguồn Playwright test script) để trích xuất thành cấu trúc tài liệu truy vết QA chuẩn 100%.

BẮT BUỘC trả về DUY NHẤT 1 chuỗi JSON hợp lệ (không kèm markdown \`\`\`json hay ghi chú bên ngoài), định dạng đúng schema sau:
{
  "title": "Tên tính năng ngắn gọn, chuẩn nghiệp vụ",
  "slug": "slug-dinh-danh-khong-dau",
  "domain": "${domain || 'auth'}",
  "businessGoal": "Mục tiêu nghiệp vụ chính của tính năng",
  "acs": [
    {
      "id": "AC-001",
      "title": "Tên tiêu chí chấp nhận",
      "given": "Tiền điều kiện Given",
      "when": "Thao tác người dùng When",
      "then": "Kết quả mong đợi Then"
    }
  ],
  "rules": [
    {
      "field": "Tên trường / Quy tắc",
      "valid": "Giá trị hợp lệ",
      "invalid": "Giá trị không hợp lệ",
      "boundary": "Giá trị biên",
      "expected": "Kết quả xử lý",
      "tcId": "TC-001"
    }
  ],
  "testCases": [
    {
      "id": "TC-001",
      "acId": "AC-001",
      "title": "Tên kịch bản kiểm thử chi tiết",
      "priority": "P1",
      "automation": "Yes",
      "precondition": "Tiền điều kiện",
      "steps": [
        { "step": 1, "action": "Thao tác bước 1", "expected": "Kết quả kỳ vọng bước 1" }
      ]
    }
  ],
  "specCode": "// Mã test Playwright hoàn chỉnh tương thích CommonJS hoặc ES module"
}`;

  const userPrompt = `Dữ liệu đầu vào (${inputType === 'test_script' ? 'Mã test script Playwright' : 'Văn bản Spec / User story thô'}):\n\n${rawContent.slice(0, 8000)}\n\nMã REQ ID dự kiến: ${reqId}\nDomain đề xuất: ${domain}`;

  const messages = [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }];
  const res = await callAi({
    task: 'extractScaffold',
    messages,
    schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        acs: { type: 'array' },
      },
    },
    clientConfig: payload,
    root: root || process.cwd(),
    signal: payload.signal || null,
    tier: 'deep',
    timeoutMs: 60000,
  });

  if (res.ok && res.data && res.data.title && Array.isArray(res.data.acs) && res.data.acs.length > 0) {
    return res.data;
  }
  return null;
}

module.exports = {
  inferWithAi,
  extractWithAi,
};
