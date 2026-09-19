# Project Agent Guidelines & Master Process Reference

> **Hiến Pháp Dự Án**: Dự án này tuân thủ nghiêm ngặt Quy trình Phát triển Phần mềm Chuẩn & Hệ thống Trí tuệ Tự học (Project Intelligence Layer) được định nghĩa tại **Master Process Hub**.

---

## 1. Tham Chiếu Quy Trình Chuẩn (Master Process References)

Mọi yêu cầu phát triển phần mềm, thay đổi UI/UX hoặc cải tiến kỹ thuật trong toàn bộ dự án BẮT BUỘC phải tuân thủ tài liệu quy trình chuẩn tại **Master Hub** (tra cứu qua liên kết cục bộ [.master_process/](file:///.master_process/) hoặc trực tiếp tại [D:\_Master_Process](file:///D:/_Master_Process)):

* 📘 **Quy trình tổng thể & 4 Quality Gates:**  
  [.master_process/00_CORE_PROCESS_GUIDE.md](file:///.master_process/00_CORE_PROCESS_GUIDE.md) (hoặc [D:\_Master_Process\00_CORE_PROCESS_GUIDE.md](file:///D:/_Master_Process/00_CORE_PROCESS_GUIDE.md))
* 📜 **Quy trình chi tiết 5 giai đoạn (A -> E):**  
  [.master_process/SOFTWARE_DELIVERY_PROCESS_MASTER.md](file:///.master_process/SOFTWARE_DELIVERY_PROCESS_MASTER.md) (hoặc [D:\_Master_Process\SOFTWARE_DELIVERY_PROCESS_MASTER.md](file:///D:/_Master_Process/SOFTWARE_DELIVERY_PROCESS_MASTER.md))
* 🛡️ **Hệ thống Kiểm soát Cổng Nghiệm thu (Acceptance Gates v1.0):**  
  [.master_process/03_ACCEPTANCE_GATES.md](file:///.master_process/03_ACCEPTANCE_GATES.md) (hoặc [D:\_Master_Process\03_ACCEPTANCE_GATES.md](file:///D:/_Master_Process/03_ACCEPTANCE_GATES.md))
* ⚡ **Kiến trúc Kiểm soát Quota & Tối ưu Token v1.0:**  
  [.master_process/01_TOKEN_OPTIMIZATION_AND_KNOWLEDGE_SCALING.md](file:///.master_process/01_TOKEN_OPTIMIZATION_AND_KNOWLEDGE_SCALING.md) (hoặc [D:\_Master_Process\01_TOKEN_OPTIMIZATION_AND_KNOWLEDGE_SCALING.md](file:///D:/_Master_Process/01_TOKEN_OPTIMIZATION_AND_KNOWLEDGE_SCALING.md))
* 🧠 **Nguyên lý Tự học & Quản trị Tri thức (Gate 0.5):**  
  [.master_process/project_intelligence_layer_10_of_10.md](file:///.master_process/project_intelligence_layer_10_of_10.md) (hoặc [D:\_Master_Process\project_intelligence_layer_10_of_10.md](file:///D:/_Master_Process/project_intelligence_layer_10_of_10.md))
* 🎯 **Kho Master Prompts cho từng Role:**  
  [.master_process/prompts/](file:///.master_process/prompts/) (hoặc [D:\_Master_Process\prompts](file:///D:/_Master_Process/prompts))

| Nhiệm Vụ | Tài Liệu & Prompt Tham Chiếu |
|---|---|
| Thực thi Plan | [Execute Plan prompt](.master_process/prompts/12_Execute_Implementation_Plan.prompt.md) |
| Code / Dev | Prompt B ([05_B_Dev_Implementation](.master_process/prompts/05_B_Dev_Implementation.prompt.md)) & [Modular Guide](.master_process/02_MODULAR_ARCHITECTURE_AND_EXTENSIBILITY_GUIDE.md) |
| Code Review | Prompt C ([06_C_Code_Review_Gate3](.master_process/prompts/06_C_Code_Review_Gate3.prompt.md)) |
| QA Verification | Prompt D ([07_D_QA_Verification_Gate4](.master_process/prompts/07_D_QA_Verification_Gate4.prompt.md)) |
| **Đóng phase / nghiệm thu** | [Acceptance Gates](.master_process/03_ACCEPTANCE_GATES.md): contract AC/TC, ma trận scenarios, receipts JUnit và review độc lập |
| Curate knowledge | Prompt [11_Knowledge_Curator_Gate0_5](.master_process/prompts/11_Knowledge_Curator_Gate0_5.prompt.md) & [Knowledge Guide](.master_process/01_TOKEN_OPTIMIZATION_AND_KNOWLEDGE_SCALING.md) |

### Tối Ưu Tốc Độ & Tiết Kiệm Token (Speed & Token-Saving Policy)
- **Tra cứu JIT 2 tầng (Tiered JIT):** Luôn tra cứu Bản đồ tri thức nhanh [.ai/knowledge/manifest.json](file:///.ai/knowledge/manifest.json) (< 400 tokens) trước, CHỈ NẠP đúng 1-2 file `.md` liên quan trực tiếp đến task.
- **Tác vụ nhỏ/vừa (L1/L2):** Dùng ngay file gộp siêu tốc [.master_process/prompts/00_Fast_Track_L1_L2.prompt.md](file:///.master_process/prompts/00_Fast_Track_L1_L2.prompt.md) để giải quyết trọn vẹn cả 5 vai trò trong 1 lượt prompt duy nhất, tiết kiệm 80% token.
- **Tác vụ lớn (L3/L4):** Thực hiện tuần tự qua các file prompt con tương ứng (A1 -> A2 -> A3 -> B -> C -> D -> E).
- **Nguyên tắc phản hồi:** Trả lời trực diện, súc tích, đi thẳng vào bảng ma trận, code diff và checklist kiểm thử; KHÔNG chào hỏi xã giao, KHÔNG lặp lại toàn bộ đề bài, KHÔNG giải thích triết lý lan man.

---

## 2. Hệ Thống Trí Nhớ & Tri Thức Riêng Của Dự Án (.ai/)

Mọi tri thức tự học, quyết định kỹ thuật, quy tắc bất biến của riêng dự án này được lưu trữ và tra cứu tại thư mục `.ai/` cục bộ:

### A. Tri thức Kỹ thuật & Kiểm thử (Engineering & QA)
* Bản đồ tri thức nhanh (L0 Manifest Router): [.ai/knowledge/manifest.json](file:///.ai/knowledge/manifest.json)
* Hồ sơ kỹ thuật & Lệnh chạy: [.ai/knowledge/engineering/project-profile.md](file:///.ai/knowledge/engineering/project-profile.md)
* Tiêu chuẩn viết code & Rào chắn: [.ai/knowledge/engineering/coding-conventions.md](file:///.ai/knowledge/engineering/coding-conventions.md)
* Quy chuẩn kịch bản kiểm thử: [.ai/knowledge/qa/test-conventions.md](file:///.ai/knowledge/qa/test-conventions.md)
* Điểm nóng hồi quy & Cạm bẫy: [.ai/knowledge/qa/regression-hotspots.md](file:///.ai/knowledge/qa/regression-hotspots.md)

### B. Vùng Tự Học & Quản Trị Tri Thức (Self-Learning & Archiving Loop)
* Sau mỗi feature, bugfix hoặc review, mọi quan sát và bài học mới phải được trích xuất vào:  
  👉 [.ai/learning/candidates.md](file:///.ai/learning/candidates.md) (Giới hạn trần < 50 dòng)
* Định kỳ chạy **Knowledge Curator (Gate 0.5)** qua [.master_process/prompts/11_Knowledge_Curator_Gate0_5.prompt.md](file:///.master_process/prompts/11_Knowledge_Curator_Gate0_5.prompt.md) để thăng cấp candidate thành tiêu chuẩn dự án.
* Công cụ tự động hóa đo lường & lưu trữ lạnh: `powershell -ExecutionPolicy Bypass -File ".master_process/scripts/optimize-knowledge.ps1"`
* Kho lưu trữ lạnh (L2 Cold Archive): [.ai/learning/archive/](file:///.ai/learning/archive/) (0 token trong context hàng ngày)

---

## 3. Chỉ Dẫn Chuyên Sâu Từng Module (Subsystem Guidelines)

### A. Playwright Automation
Khi làm việc với các file Playwright test, Page Objects, fixtures:
- Đọc và tuân thủ tuyệt đối [ai/shared/AI_PROMPTS.md](file:///ai/shared/AI_PROMPTS.md) và [ai/shared/TEST_AUTOMATION_LESSONS.md](file:///ai/shared/TEST_AUTOMATION_LESSONS.md).
- Không load tài liệu Dashboard trừ khi task có chỉnh sửa `dashboard/`.
- Chạy kiểm tra quy chuẩn kiến trúc tự động: `npm run check:framework`.

### B. Dashboard Web Studio
Khi làm việc với Dashboard (`dashboard/`):
- Đọc và tuân thủ [ai/dashboard/DASHBOARD_AI_PROMPT.md](file:///ai/dashboard/DASHBOARD_AI_PROMPT.md) và [ai/dashboard/AI_LESSONS.md](file:///ai/dashboard/AI_LESSONS.md).
- Nếu hỗ trợ skill cục bộ, dùng `.agents/skills/dashboard-maintainer/SKILL.md`.
- Giữ nguyên kiến trúc Vanilla HTML/CSS/JS, tái sử dụng các primitives, layout tokens, panels và code editor có sẵn.

---

## 4. Senior QA Verification Gate (Gate 4 Bắt Buộc & Acceptance Gates)

Sau mỗi lần hiện thực hóa mã nguồn, đóng vai trò **Senior QA Engineer với hơn 10 năm kinh nghiệm** trước khi báo cáo hoàn tất:
- **Nguyên tắc đóng Phase:** Hoàn tất sửa các lỗi đã báo KHÔNG đồng nghĩa hoàn tất phase. Sau mỗi đợt sửa, phải đối chiếu lại toàn bộ điều kiện ra phase trong plan và contract. Chỉ đóng phase khi mọi điều kiện bắt buộc đều có bằng chứng đạt và kiểm định qua `master.ps1 gate`.
- **Ma trận Scenarios Bắt Buộc:** Kiểm tra đầy đủ các scenario áp dụng trong [config/gate-scenarios.json](file:///.master_process/config/gate-scenarios.json):
  * `async_state` (`ASYNC-01..05`): edit while save pending, session/entity switch, late response, save failure retry.
  * `ownership_lifecycle` (`OWN-01..05`): registration identity, stale disposer safe, double dispose, 20-roundtrip mount-unmount without multiplying listeners, completion after dispose.
  * `router_ui` (`UI-01..05`): independent DOM inventory parity, panel visibility/focus, rapid A-B-A navigation, dirty guard.
  * `lifecycle_integration` (`LIFE-01`): module exercise qua public API/UI thực tế, không dùng in-memory/unit tests thay integration/E2E.
- **Quy trình Kiểm định Cổng Tự Động:**
  * Xuất JUnit test report với test ID ổn định dạng `classname.name`.
  * Chạy runner lấy receipt: `python .master_process/scripts/record-gate-run.py`.
  * Kiểm định cổng bằng `master.ps1 gate` hoặc `.master_process/scripts/check-gate.ps1`.
  * Rerun độc lập các critical test cases trên cùng commit SHA.
- **Kiểm thử đa chiều:** Áp dụng risk-based testing (BVA, fault injection, edge cases). Đối với UI, kiểm tra 1920x1080, 1440x900, 1280px, 390x844 trên cả Light/Dark mode.
- **Rà soát Console & Rendered DOM:** Quét UI đã render để loại bỏ ghi chú debug, lỗi thô, `undefined`, `null`, TODOs và comment mã nguồn thừa thãi. Zero unexpected console errors/warnings.
