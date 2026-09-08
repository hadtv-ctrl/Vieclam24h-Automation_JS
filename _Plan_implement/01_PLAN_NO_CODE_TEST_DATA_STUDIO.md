# 📊 PLAN-01: NO-CODE TEST DATA STUDIO & ASSERTION PICKER

Kế hoạch chi tiết và tài liệu nghiệm thu tính năng Quản lý Dữ liệu Kiểm thử No-Code và Bộ chọn Điểm kiểm tra (Assertion Picker) cho dự án **Vieclam24h Automation Framework**.

> **Trạng thái cập nhật 2026-09-04:** Dashboard đã có Data Studio, dataset API, CSV helper và một phần Assertion Picker. Plan này không coi các phần đó là hoàn thiện; phần còn thiếu phải được triển khai theo mục 4.

---

## 1. Mục Tiêu & Trải Nghiệm Người Dùng (UI/UX)
* **Vấn đề cũ:** Dữ liệu test nằm trong `data/*.json` thô. Người dùng phi kỹ thuật (manual tester) khi sửa dễ bị lỗi cú pháp JSON (dấu phẩy, ngoặc nhọn), làm crash test. Bộ ghi kịch bản chỉ ghi nhận `click` và `fill` mà thiếu `expect` để verify kết quả.
* **Giải pháp đã hoàn thiện:**
  1. **Tab `Dữ liệu test (No-Code)` với 3 Chế Độ Xem Linh Hoạt:**
     - 📋 **Bảng tính (Table Grid):** Dành cho danh sách mảng (`users.json`), hỗ trợ sửa ô trực tiếp, thêm dòng, nhân bản dòng, xóa dòng.
     - 🌳 **Biểu mẫu phân nhóm (Grouped Form & Tree Inspector):** Dành cho các file dữ liệu phức hợp (`applyJobData.json`, `userProfileData.json`), tự động phân chia theo thẻ nhóm (Kinh nghiệm, Học vấn, Kỹ năng, Thành tựu, Ứng tuyển không CV) với giao diện Form trực quan.
     - 💻 **Mã JSON (Raw JSON Editor):** Xem mã nguồn thô kèm nút **"Định dạng JSON" (Beautify)** và kiểm tra cú pháp thời gian thực.
  2. **1-Click Import / Export CSV:** Dễ dàng xuất dữ liệu ra file `.csv` hoặc tải file CSV lên để nạp hàng loạt.
  3. **Thanh Biến Ngẫu Nhiên Tương Tác & Xem Thử Trực Tiếp:**
     - Các chip biến: `{{random_phone}}`, `{{random_email}}`, `{{random_name}}`, `{{timestamp}}`, `{{date}}`.
     - Nút **"Xem mẫu"** mở Modal hiển thị giá trị thực tế sinh ra kèm nút 1-click copy.
  4. **Tạo Tệp Dữ Liệu Mới (New Dataset Modal):** Nút **"+ Tạo tệp mới"** cho phép tạo file `.json` ngay trên giao diện với các mẫu có sẵn (Tài khoản users, Mảng rỗng, Đối tượng phân nhóm).
  5. **Tự động sao lưu an toàn (Auto-Backup):** Tự động tạo bản sao lưu trong `.dashboard-backups/data/` trước khi lưu.
  6. **Nút `+ Thêm điểm kiểm tra (Assertion)` trong Recorder:** Hỗ trợ `toBeVisible`, `toBeHidden`, `toHaveText`, `toContainText`, `toHaveValue`, `toHaveURL` và tự động sinh `expect(...)` trong Page Object / BDD Spec.

---

## 2. Danh Sách Files Đã Triển Khai
* `core/utils/dataManager.js` & `core/utils/dataManager.test.js`: Bộ xử lý dataset, CSV parser/generator, dynamic variable resolver, `createDataset`.
* `core/generator/actionRegistry.js`: Danh mục các action và assertion chuẩn hóa tiếng Việt.
* `core/generator/recordParser.js` & `recordTransformer.js`: Nâng cấp parser regex lồng nhau và tự động sinh assertions vào POM/Spec.
* `dashboard/server.js`: Đã có `/api/data/datasets`, `/api/data/dataset`, `/api/data/create-dataset` và `/api/data/dynamic-preview`. `/api/data/import-csv` và `/api/data/export-csv` chỉ được coi là hoàn thành sau khi thực sự expose và test qua Dashboard.
* `dashboard/public/index.html`, `styles.css`, `app.js`: Giao diện 3 chế độ xem (Bảng tính, Biểu mẫu phân nhóm, Mã JSON), modal tạo dataset mới, modal xem giá trị động và modal Assertion Picker.

---

## 3. Kết Quả Kiểm Thử & Tinh Chỉnh UI/UX
* `npm run check:framework` $\rightarrow$ Passed (12 specs, 15 page objects).
* `node --test` $\rightarrow$ 16/16 tests passed 100%.
* **UI/UX Polish:**
  - Sidebar: mở rộng `320px`, thẻ button `min-height: 64px`, `gap: 8px`, `flex-shrink: 0` chống đè chữ và cắt cụt tên file.
  - Biểu mẫu: loại bỏ `max-height: 600px`, thẻ card `overflow: visible`, `height: auto`, các ô input và nhãn hiển thị đầy đủ 100% không bị che khuất.
  - Phân tách nhóm con (Compound Sub-cards): Đối với các đối tượng phức hợp lồng nhau như `noCVApply` (`job1`, `guestJob`, `job2`), tự động bóc tách thành các thẻ con riêng biệt với tiêu đề rõ ràng, các trường mảng (districts, tones) hiển thị dạng chuỗi phân cách dấu phẩy trực quan, không còn bị dính chùm chuỗi JSON thô.
  - Mã JSON (Syntax Highlighting): Tích hợp bộ Prism JSON & lớp `.code-preview` đồng bộ thời gian thực theo đúng chuẩn "Mã framework" (tô màu rực rỡ cho properties vàng/hổ phách, strings xanh ngọc, numbers cam, booleans tím), hỗ trợ cả giao diện Sáng và Tối.

## 4. Cập Nhật Kiến Trúc Và Gap Cần Xử Lý
- Schema dùng chung của dataset/action nằm tại `core/generator/wizardSchema.js` hoặc module contract tương đương; PLAN-02, PLAN-03 và PLAN-05 không tự định nghĩa schema riêng.
- `dataManager.js` là nguồn xử lý dataset; Dashboard phải dùng cùng một contract cho file name, raw JSON, parsed data, backup và lỗi JSON.
- `actionRegistry.js` là nguồn định nghĩa action/assertion duy nhất. `visualBuilderCompiler.js`, Recorder, Wizard và UI không được duy trì danh sách assertion/preset trùng nhau.
- Chuẩn hóa `dataSource`: `{ file, variable, dataPath }`. Chỉ import file không được tính là đã map dữ liệu vào action.
- API tạo dataset phải nhận và validate `content` khi người dùng nhập JSON; không được lặng lẽ bỏ qua nội dung rồi tạo template mặc định.
- CSV helper đã có trong core nhưng CSV Dashboard API thuộc Phase 2, trừ khi triển khai đủ giới hạn kích thước, encoding, malformed rows, path `data/` và backup.
- Source-code editor cho JSON phải dùng shared editor controller với language registry, dirty state, save/revert/copy, Ctrl/Cmd+S và bảo vệ mất thay đổi.

## 5. Acceptance bổ sung
- Mọi assertion trong `ASSERTION_TYPES` đều có metadata, code generator và test; không có assertion “hiển thị được nhưng compile thành comment”.
- Preview mask `password`, `otp`, `token` và không ghi giá trị nhạy cảm vào log.
- Dataset tạo từ Drawer lưu đúng `content` người dùng nhập và tạo backup khi sửa file cũ.
- CSV import/export có test success, malformed input, file quá lớn và path traversal khi được đưa vào Phase 2.
- Data contract tương thích với PLAN-02 và PLAN-05 trước khi cho phép mapping `dataPath`.

