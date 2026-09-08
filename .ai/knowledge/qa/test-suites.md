# Danh Mục & Kiến Trúc Test Suites (Playwright Automation)

> [!NOTE]
> Tài liệu chuẩn hóa cấu trúc tổ chức, phân loại và cách vận hành các Test Suite trong dự án Automation Vieclam24h.

---

## 1. Nguyên Tắc Thiết Kế Phân Cấp (3 Trục Chuẩn)

Hệ thống Test Suite được thiết kế đồng bộ xuyên suốt qua 3 giao diện:
1. **NPM Scripts** (`npm run suite:<name>`) phục vụ kỹ sư kiểm thử chạy nhanh trên Terminal/IDE.
2. **Dashboard Studio** (`dashboardConfig.json`) phục vụ chạy 1-click trực quan trên Web GUI.
3. **CLI Runner** (`node scripts/run-suite.js <name> <env>`) phục vụ CI/CD pipeline và Discord Bot.

---

## 2. Bảng Tra Cứu Test Suites Toàn Diện

| Tên Suite | Mục Đích & Phạm Vi | Filter / Tags | Lệnh Terminal (NPM) | Lệnh CLI Trực Tiếp |
| :--- | :--- | :--- | :--- | :--- |
| **`smoke`** | Smoke test toàn hệ thống sau deploy (Phone & Email Register) | `@smoke` (Desktop + Mobile) | `npm run suite:smoke` | `node scripts/run-suite.js smoke qc` |
| **`smoke:desktop`** | Smoke test siêu tốc chỉ trên Desktop Chrome | `@smoke` (Desktop Chrome) | `npm run suite:smoke:desktop` | `node scripts/run-suite.js smoke:desktop qc` |
| **`smoke:mobile`** | Smoke test chỉ trên Mobile Web (Android & iOS) | `@smoke` (Mobile Pixel 7 & iPhone 13) | `npm run suite:smoke:mobile` | `node scripts/run-suite.js smoke:mobile qc` |
| **`applyjob`** | Toàn bộ 8 luồng ứng tuyển việc làm (Không CV, Có CV, Profile, OTP) | `@applyjob` (Tất cả nền tảng) | `npm run suite:applyjob` | `node scripts/run-suite.js applyjob qc` |
| **`applyjob:desktop`**| 4 luồng ứng tuyển việc làm trên Desktop Chrome | `@applyjob @desktop` | `npm run suite:applyjob:desktop` | `node scripts/run-suite.js applyjob:desktop qc`|
| **`applyjob:mobile`** | 4 luồng ứng tuyển việc làm trên Mobile Web | `@applyjob @mobile` | `npm run suite:applyjob:mobile` | `node scripts/run-suite.js applyjob:mobile qc` |
| **`profile`** | Toàn bộ 8 luồng tạo hồ sơ, tải CV, AI Profile Writer, Cài đặt | `@profile` (Tất cả nền tảng) | `npm run suite:profile` | `node scripts/run-suite.js profile qc` |
| **`profile:desktop`**| 4 luồng hồ sơ & CV trên Desktop Chrome | `@profile @desktop` | `npm run suite:profile:desktop` | `node scripts/run-suite.js profile:desktop qc` |
| **`profile:mobile`** | 4 luồng hồ sơ & CV trên Mobile Web | `@profile @mobile` | `npm run suite:profile:mobile` | `node scripts/run-suite.js profile:mobile qc` |
| **`auth`** | Đăng ký & xác thực người tìm việc (E2E & Backend API) | `@register` (Tất cả) | `npm run suite:auth` | `node scripts/run-suite.js auth qc` |
| **`onboarding`** | Khảo sát định hướng người tìm việc mới | `@onboarding` (Desktop & Mobile) | `npm run suite:onboarding` | `node scripts/run-suite.js onboarding qc` |
| **`desktop`** | Toàn bộ 11 kịch bản kiểm thử trên Desktop Chrome | `@desktop` | `npm run suite:desktop` | `node scripts/run-suite.js desktop qc` |
| **`mobile`** | Toàn bộ 11 kịch bản kiểm thử trên Mobile Web (Android & iOS) | `@mobile` | `npm run suite:mobile` | `node scripts/run-suite.js mobile qc` |
| **`mobile:android`** | Chỉ kiểm thử trên Google Chrome giả lập Android (Pixel 7) | Android Chrome Smoke & Regression | `npm run suite:mobile:android` | `node scripts/run-suite.js mobile:android qc` |
| **`mobile:ios`** | Chỉ kiểm thử trên WebKit giả lập iPhone (iPhone 13) | iOS Safari Smoke & Regression | `npm run suite:mobile:ios` | `node scripts/run-suite.js mobile:ios qc` |
| **`api`** | Kịch bản kiểm thử API Backend Vieclam24h | `@api` | `npm run suite:api` | `node scripts/run-suite.js api qc` |
| **`regression`** | Toàn bộ 24 kịch bản kiểm thử E2E & API hệ thống | `@e2e`, `@api` | `npm run suite:regression` | `node scripts/run-suite.js regression qc` |

---

## 3. Quy Ước Gắn Tag Khi Tạo Kịch Bản Test Mới

Để kịch bản test mới tự động được gán vào đúng các Test Suites, bắt buộc gắn các tags tương ứng tại dòng `test.describe`:

```javascript
// Ví dụ 1: Kịch bản ứng tuyển việc làm trên Desktop
test.describe('Feature: Ứng tuyển việc làm với CV tải lên @applyjob @desktop @e2e', () => { ... });

// Ví dụ 2: Kịch bản hồ sơ cá nhân trên Mobile Web
test.describe('Mobile Feature: Cập nhật hồ sơ bằng AI @profile @ai @mobile @e2e', () => { ... });

// Ví dụ 3: Kịch bản Smoke Test đăng ký tài khoản
test.describe('Feature: Đăng ký tài khoản bằng Số điện thoại @register @smoke @smoke-desktop @desktop @e2e', () => { ... });
```

### Danh mục Tags tiêu chuẩn:
- **Cấp độ**: `@smoke`, `@e2e`
- **Nền tảng**: `@desktop`, `@mobile`, `@smoke-desktop`, `@smoke-mobile`
- **Nghiệp vụ**: `@applyjob`, `@profile`, `@register`, `@onboarding`, `@ai`, `@api`

---

## 4. Các Tham Số Mở Rộng Khi Chạy CLI

`scripts/run-suite.js` hỗ trợ chuyển tiếp trực tiếp mọi cờ của Playwright CLI:
- Xem trước danh sách test mà không chạy:  
  `node scripts/run-suite.js smoke qc --list` hoặc `npm run suite:smoke -- --list`
- Chạy có hiển thị giao diện trình duyệt:  
  `node scripts/run-suite.js smoke qc --headed`
- Điều chỉnh số luồng chạy song song:  
  `node scripts/run-suite.js regression qc --workers=4`
