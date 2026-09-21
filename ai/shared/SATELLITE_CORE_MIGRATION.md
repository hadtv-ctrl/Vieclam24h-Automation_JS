# Migration: đưa code riêng của dự án ra khỏi `core/`

**Đối tượng:** chủ repo vệ tinh (Automation_Carthings, Vieclam24h-Automation_JS).
**Người chạy:** chính bạn, trên repo của bạn. Hub không sửa hộ.

## Vì sao phải làm

`core/` do Hub `_Automation-Project` sở hữu và bị ghi đè mỗi lần sync. Mọi sửa đổi
trực tiếp trong `core/` sẽ biến mất. Việc này đã xảy ra: commit `7ad6984`
(2026-09-16, `github-actions[bot]`, "fix(core): restore commonUtils generators and
environment URL mappings") phải khôi phục tay 179 dòng `core/utils/commonUtils.js`,
4 dòng `core/config/dashboardConfig.js` và 11 dòng test.

Hub nay cung cấp **một điểm nối duy nhất, không bao giờ bị sync**: `core/local/`.
Chi tiết: `core/local/README.md` (tạo sau bước 1) hoặc bản Hub tại
`_Automation-Project/core/local/README.md`.

## Bước 0 — Chụp hiện trạng (bắt buộc, trước khi sync lần tới)

Chạy từ **Hub**, không phải từ repo vệ tinh:

```bash
cd D:/_Automation-Project
node scripts/pre-sync-drift.js
```

Cột `SAT-ONLY > 0` = số dòng chỉ tồn tại ở vệ tinh và sẽ bị xoá. Lưu lại output này.

---

## A. Automation_Carthings

### A1. Tách helper riêng khỏi `core/utils/commonUtils.js`

```bash
cd D:/_CarThings/Automation_Carthings
git checkout -b chore/core-local-seam
mkdir -p core/local
```

Tạo `core/local/commonUtils.local.js` và **di chuyển** (cắt, không copy) 178 dòng
chỉ có ở CarThings từ cuối `core/utils/commonUtils.js` sang:

| Hàm cần chuyển |
|---|
| `generateRandomVNIDCard` |
| `generateRandomVNAddress` |
| `generateRandomLicensePlate` |
| `generateRandomDriverLicense` |
| `generateDynamicVehicleDates` |
| `generateRandomVietnameseName` |
| `generateRandomCompanyName` (kèm `COMPANY_PREFIX_POOL`, `COMPANY_BODY_POOL`, `COMPANY_BRANCH_POOL`) |
| `readTestData`, `writeTestData` |

Lấy đúng nội dung từ commit đã khôi phục:

```bash
git show 7ad6984:core/utils/commonUtils.js > /tmp/restored-commonUtils.js
```

Khung file mới:

```js
// core/local/commonUtils.local.js — thuộc dự án, KHÔNG bao giờ bị Hub sync ghi đè.
const fs = require('fs');
const path = require('path');

// ... dán các hàm đã cắt vào đây ...
// Lưu ý readTestData/writeTestData dùng path.join(__dirname, '../../data', filename):
// từ core/local/ thì '../../data' vẫn trỏ đúng <repo>/data — giữ nguyên.

module.exports = {
  generateRandomVNIDCard,
  generateRandomVNAddress,
  generateRandomLicensePlate,
  generateRandomDriverLicense,
  generateDynamicVehicleDates,
  generateRandomVietnameseName,
  generateRandomCompanyName,
  readTestData,
  writeTestData,
};
```

### A2. Khôi phục `core/utils/commonUtils.js` về đúng bản Hub

```bash
cp D:/_Automation-Project/core/utils/commonUtils.js core/utils/commonUtils.js
```

Bản Hub tự nạp `core/local/commonUtils.local.js` nếu tồn tại và merge vào export,
nên **không phải sửa import ở test/page object**: `require('.../core/utils/commonUtils')`
vẫn trả về đủ hàm như trước.

### A3. Chuyển test của helper riêng

11 dòng test `generateRandomCompanyName` đang nằm cuối `core/utils/commonUtils.test.js`
(file Hub sở hữu) — cắt sang `core/local/commonUtils.local.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const { generateRandomCompanyName } = require('./commonUtils.local');
// ... dán test đã cắt ...
```

Rồi khôi phục bản Hub:

```bash
cp D:/_Automation-Project/core/utils/commonUtils.test.js core/utils/commonUtils.test.js
node --test core/
```

### A4. Xoá bản `core/config/dashboardConfig.js` riêng

Hub đã sửa: mọi key chuỗi ngoài `label` / `baseURL` / `apiBaseURL` trong
`core/config/dashboardConfig.json` được giữ nguyên, không cần khai báo tên trong `.js`.
`dashboardConfig.json` của CarThings đã có sẵn `carthingsURL` và `companyURL` ở cả ba
môi trường (`prod`, `dev`, `qc`), nên bản `.js` riêng là thừa:

```bash
cp D:/_Automation-Project/core/config/dashboardConfig.js core/config/dashboardConfig.js
node -e "const c=require('./core/config/dashboardConfig').getDashboardConfig(); console.log(c.environments.qc)"
# phải in ra đủ carthingsURL + companyURL
```

### A5. Nghiệm thu

```bash
node --test core/
npm run check:framework
cd D:/_Automation-Project && node scripts/pre-sync-drift.js --satellite=CarThings
# 3 file trên phải về cột RIENG = 0. Cột SAT-ONLY/BAN-CU khác 0 là bình thường:
# đó chỉ là dấu hiệu vệ tinh đang giữ bản cũ của Hub, và sync sinh ra để sửa đúng việc đó.
```

> Trạng thái đo được trên `origin/main` của CarThings (2026-09-20): đúng 3 file này còn
> chặn, tổng **140 dòng** — `commonUtils.js` 129, `commonUtils.test.js` 8,
> `dashboardConfig.js` 3. Cả ba đều nằm trong `core/`, nên sync **chỉ giữ lại `core/`**:
> `dashboard/`, `scripts/`, `bin/`, `ai/`, `tools/` và các file gốc vẫn được giao bình
> thường, nên tính năng dashboard mới vẫn tới nơi. Job CI kết thúc với mã 2 (đã giao
> một phần) thay vì báo hỏng.
>
> Hệ quả của việc giữ lại `core/`: bản `core/config/dashboardConfig.js` cũ không hiểu khóa
> `qa`, nên mục QA đọc theo thư mục mặc định (`requirements/`, `test-cases/`, `tests/`).
> Đúng với bố cục hiện tại của CarThings. Nếu dự án muốn đổi thư mục, dashboard sẽ hiện
> cảnh báo đỏ rằng cấu hình đang bị bỏ qua — không âm thầm đọc sai chỗ.

Còn lại `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `QA_AI_RULES.md`: đây là file gốc do Hub
sở hữu (mới được thêm vào `ROOT_FILES_TO_SYNC`). Bài học/ghi chú riêng của dự án phải
nằm ở `.ai/` — thư mục này không bao giờ được sync. Rà và chuyển trước khi sync.

---

## B. Vieclam24h-Automation_JS

> **ĐÃ HOÀN TẤT** (commit `be584a4`, "tach auth rieng sang core/local"). Đo trên
> `origin/main` ngày 2026-09-20: **0 file chặn**. Phần dưới giữ lại làm tham chiếu cho
> vệ tinh khác gặp tình huống tương tự.

### B1. `core/utils/authSetup.js` — 147 dòng riêng, SẼ BỊ XOÁ

Bản vệ tinh (207 dòng) đã viết đè logic riêng lên bản Hub (70 dòng): import
`./registrationApiHelper`, `../../pages/desktop/LoginPopup`, `HomePage`, `PopupConsent`,
và luồng đăng ký worker-scoped của dự án.

Cách xử lý: chuyển sang `core/local/authSetup.local.js`, rồi để test/fixture của dự án
import thẳng file đó, và khôi phục `core/utils/authSetup.js` về bản Hub.

```bash
cd D:/_SieuVietGroup
git checkout -b chore/core-local-seam
mkdir -p core/local
git mv core/utils/authSetup.js core/local/authSetup.local.js
cp D:/_Automation-Project/core/utils/authSetup.js core/utils/authSetup.js
grep -rn "utils/authSetup" tests/ pages/ core/ playwright.config.js 2>/dev/null
# sửa các import đó trỏ sang core/local/authSetup.local
```

### B2. Các file chỉ vệ tinh mới có — không cần làm gì

`core/utils/registrationApiHelper.js` và `core/reporters/suiteReporter.js` không tồn
tại ở Hub, nên sync không đụng tới. Dù vậy nên chuyển dần vào `core/local/` để nhất
quán và để tránh va chạm nếu Hub sau này thêm file cùng tên.

### B3. Thư mục `dashboard/` — không cần làm gì

9 file từng lệch đều là bản Hub cũ, không có tuỳ biến nào của dự án; sync ngày
2026-09-19 đã đưa chúng về đúng bản Hub. Chỉ còn khác kiểu xuống dòng (CRLF), vô hại.

### B4. Nghiệm thu

```bash
node --test core/
npm run check:framework
cd D:/_Automation-Project && node scripts/pre-sync-drift.js --satellite=Vieclam24h
```

---

## C. Áp dụng cho MỌI vệ tinh — bản đồ quyền sở hữu

| Thứ | Chủ sở hữu | Sync? |
|---|---|---|
| `dashboard/`, `core/`, `bin/`, `tools/`, công cụ Hub trong `scripts/` | **Hub** | Có — vệ tinh nhận cập nhật |
| `ai/shared/AI_PROMPTS.md` (prompt viết test case) | **Hub** | Có |
| `ai/dashboard/DASHBOARD_AI_PROMPT.md` | **Hub** | Có |
| `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `QA_AI_RULES.md` | **Hub** | Có |
| `ai/shared/TEST_AUTOMATION_LESSONS.md` | **Dự án** | Không |
| `ai/dashboard/AI_LESSONS.md` | **Dự án** | Không |
| `core/local/`, `core/config/dashboardConfig.json`, `core/fixtures/custom/` | **Dự án** | Không |
| `data/`, `tests/`, `pages/`, `requirements/`, `test-cases/`, `.ai/` | **Dự án** | Không bao giờ |
| `.env`, `playwright.config.js`, `package.json`, `.github/`, `.vscode/` | **Dự án** | Không bao giờ |

### C1. File lesson nay thuộc về dự án

Hai file lesson đã được đưa vào `excludes`, Hub không còn ghi đè. Mỗi repo tự giữ bài học
của mình ngay tại chỗ. Bài học đúng cho **mọi** dự án thì gửi PR lên Hub để đưa vào
`AI_PROMPTS.md` / `DASHBOARD_AI_PROMPT.md`.

**Việc cần làm một lần:** bản hiện có ở repo bạn vẫn mang banner cũ *"Hub owns this file.
It is overwritten on every sync."* — nay đã sai, và vì file không còn được sync nên Hub
không sửa hộ được. Hãy thay banner đó bằng:

```markdown
> **This file belongs to THIS project. The Hub never overwrites it.**
> A lesson that applies to EVERY project belongs in `AI_PROMPTS.md` via a PR to the Hub.
```

### C2. Fixture dùng chung vs dữ liệu mẫu

`core/fixtures/` là **lớp năng lực do Hub cấp**, mỗi dự án dùng theo đặc thù riêng. Đừng
fork một fixture của Hub chỉ vì cần đổi dữ liệu đầu vào — hãy truyền tham số. Cần đổi
*hành vi* thì đặt bản riêng ở `core/local/`.

```js
const { withMockSample } = require('../../../core/fixtures/mockSampleTest');

const test = withMockSample(base);                                        // tự tìm <gốc>/data/mock/sample.html, không có thì dùng HTML mặc định
const test = withMockSample(base, { htmlPath: 'data/mock/checkout.html' }); // bản mock riêng của dự án
const test = withMockSample(base, { html: '<h1>Trang nội bộ</h1>' });      // truyền thẳng
```

`data/` không bao giờ được sync, nên fixture của Hub không được hard-code đường dẫn tới
file dữ liệu của bất kỳ dự án nào. Dữ liệu mẫu là của dự án; fixture là của Hub.

### C3. Danh tính git trong repo của bạn có thể đang sai

Phiên bản cũ của `sync-satellites.js` chạy `git config user.name "github-actions[bot]"`
**ghi thẳng vào `.git/config`** của repo vệ tinh, nên nó tồn tại vĩnh viễn: mọi commit sau
đó của con người cũng bị gán cho bot. Hub đã sửa (dùng `git -c` cho từng lệnh), nhưng
`.git/config` ở máy bạn thì Hub không với tới được. Kiểm tra và dọn:

```bash
git config --local --get user.name     # nếu in ra github-actions[bot] thì:
git config --local --unset user.name
git config --local --unset user.email
git config --local --get user.name     # phải rỗng, để git dùng identity toàn cục của bạn
```

## Quy tắc từ nay

- Cần sửa `core/`? Hỏi: sửa này có giá trị cho **mọi** dự án không?
  - Có → PR ngược lên Hub.
  - Không → `core/local/`.
- Trước mỗi lần sync thủ công: `node scripts/pre-sync-drift.js --strict`.
- Cổng chặn nằm ngay trong `scripts/sync-satellites.js` và chạy **theo từng module của
  từng vệ tinh** trước khi ghi: chỉ module chứa nội dung riêng bị giữ lại, phần còn lại
  vẫn được giao. Nhờ vậy một helper riêng trong `core/` không còn chặn được tính năng
  dashboard mới. Exit code 2 = đã giao một phần.
- **`dashboard/` là ngoại lệ: KHÔNG BAO GIỜ bị giữ lại** (`ALWAYS_DELIVERED_MODULES`).
  Thư mục này không có exclude nào, tức toàn bộ nội dung được thiết kế để bị ghi đè.
  Giữ nó lại vì drift sẽ chặn vĩnh viễn mọi tính năng dashboard mới — đúng thứ vệ tinh
  cần nhất. Cổng vẫn **liệt kê** từng dòng sắp mất trước khi ghi, nhưng không dừng sync.
  Hệ quả: **không đặt dữ liệu hay cấu hình riêng của dự án vào `dashboard/`**. Cần thêm
  tài liệu vào mục Hướng dẫn thì thả file `.md` vào `docs/` — Hub tự quét, không cần
  sửa code.
- Cổng phân biệt "vệ tinh giữ bản cũ của Hub" với "vệ tinh tự viết thêm" bằng lịch sử
  git của Hub (`scripts/lib/hubHistory.js`). Chỉ trường hợp thứ hai mới bị chặn.
- Sau khi ghi, `scripts/verify-dashboard-features.js` kiểm tại đích rằng mọi view đều đủ
  slice + section + template + stylesheet, và mọi route đều được `server.js` gọi thật.
  Thiếu một mảnh thì không commit. Chạy tay: `npm run check:dashboard-features`.
