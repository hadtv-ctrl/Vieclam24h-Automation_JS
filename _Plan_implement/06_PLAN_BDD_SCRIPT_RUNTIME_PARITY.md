# PLAN-06: BDD SCRIPT RUNTIME PARITY
## Kế hoạch đưa Script Studio đạt tương đương script Playwright thực tế

> **Mục tiêu:** Cho phép QA/BA tạo một file BDD `.spec.js` có hành vi runtime tương đương script hiện có, không chỉ tạo được tiêu đề, `Given/When/Then` và code preview có vẻ hợp lệ.
>
> **Script đối chiếu:** `tests/e2e/desktop/apply_job_noCV_flow.spec.js`
>
> **Phạm vi:** Visual Step Builder, Step-by-Step Script Studio Wizard, compiler, schema validation, API compile/validate/save và regression tests.
>
> **Nguyên tắc:** Mô tả tiếng Việt chỉ là phần hiển thị. Mỗi bước phải có structured action có thể biên dịch thành lệnh Playwright/POM thực sự.

---

## 1. Kết luận hiện trạng và khoảng cách cần xử lý

### 1.1. Đã có

- Wizard 6 bước: thông tin, Page Objects, Test Data, Precondition, BDD Steps, Review & Save.
- Chọn platform Desktop/Mobile Web.
- Chọn Page Object tương thích platform.
- Chọn dataset và nhập `dataPath`.
- Cấu hình authentication, đóng onboarding, kiểm tra trang chủ và evidence ban đầu.
- Compiler chung tại `core/generator/visualBuilderCompiler.js`.
- Action registry/preset và assertion definitions hiện có.
- Preview, compile, validate, save và backup flow ở Dashboard.

### 1.2. Khoảng cách chính

1. Wizard step hiện chủ yếu lưu `stepType` và text; chưa bắt buộc action runtime.
2. Action mặc định có thể rơi về `click_element`/`assert_visible`, dù nội dung bước mô tả nghiệp vụ khác.
3. `dataPath` được thu thập nhưng chưa luôn được truyền vào method/action tương ứng.
4. Evidence theo từng step chưa được compiler dùng đầy đủ.
5. Assertion chưa luôn có target và expected value nghiệp vụ.
6. Flow mở tab mới, tạo Page Object runtime và biến dùng chung chưa được biểu diễn đầy đủ trong generic Wizard.
7. Nhánh `if`, bulk action, retry và custom business block chưa có mô hình UI chung.
8. Có hai hướng tạo code: template trong frontend và compiler backend; cần một nguồn compile duy nhất.

### 1.3. Rủi ro nếu chỉ sửa giao diện

Một bước có thể hiển thị:

```text
Người dùng điền thông tin Profile mini và nộp hồ sơ
```

nhưng sinh code không làm gì hoặc chỉ click locator mặc định. Khi đó file trông giống BDD nhưng không tương đương hành vi script hiện tại. Vì vậy acceptance phải kiểm tra generated code và runtime, không chỉ kiểm tra text trên UI.

---

## 2. Mục tiêu To-Be

Mỗi bước BDD phải trả lời được sáu câu hỏi:

```text
Ai thao tác trên Page/fixture nào?
Gọi action hoặc method nào?
Truyền tham số/dữ liệu nào?
Kết quả nào cần kiểm tra?
Có chụp evidence ở thời điểm nào?
Có điều kiện, biến hoặc retry nào đi kèm?
```

### 2.1. Structured step contract tối thiểu

```js
{
  id: 'step_profile',
  stepType: 'And',
  title: 'Người dùng điền thông tin Profile mini và nộp hồ sơ',
  pageObject: 'pages/desktop/JobApplyNoCVPage.js',
  action: {
    kind: 'preset',
    actionId: 'fill_mini_profile',
    methodName: null,
    params: [],
    dataRef: {
      variable: 'applyData',
      path: 'noCVApply.job1'
    }
  },
  assertion: null,
  evidence: {
    enabled: true,
    before: true,
    after: true,
    name: 'profile_submitted'
  },
  control: null
}
```

### 2.2. Các loại action phải hỗ trợ

| Loại | Ví dụ | Code kỳ vọng |
|---|---|---|
| `preset` | `open_nocv_job_list` | Gọi business block đã được kiểm thử |
| `pom_method` | `jobApplyNoCVPage.fillMiniProfile(...)` | Gọi method Page Object với params |
| `locator` | click/fill/check | Dùng locator thuộc Page Object, không đưa locator trực tiếp vào spec nếu vi phạm POM |
| `navigation` | mở URL | Gọi `page.goto` hoặc method điều hướng được phê duyệt |
| `assertion` | visible/text/url/value | Sinh assertion có target và expected value |
| `custom_block` | mở tab, gán biến, if | Chỉ cho phép block đã whitelist và validate |

Không cho lưu step chỉ có `title` mà không có action, trừ khi step được đánh dấu rõ là draft và không được phép compile/save.

---

## 3. Đối chiếu 100% với flow ứng tuyển không cần CV

### 3.1. Import bắt buộc

```js
const { test } = require('../../../core/fixtures/baseTest');
const applyData = require('../../../data/applyJobData.json');
const usersData = require('../../../data/users.json');
```

`expect` chỉ được import khi assertion dùng trực tiếp `expect`. Dữ liệu phải được import theo action thực tế, không import thừa.

### 3.2. Fixture và biến runtime

```js
authenticatedUser,
onboardingPopup,
homePage,
jobSearchPage,
createJobApplyNoCVPage
```

Khi flow mở tab mới:

```js
let jobApplyNoCVPage;
```

Compiler phải biết `createJobApplyNoCVPage` là factory và không nhầm nó với Page Object fixture thông thường.

### 3.3. Bảng mapping step

| BDD | Action/preset | Dữ liệu | Evidence | Kết quả cần có |
|---|---|---|---|---|
| Given | `auth_login_precondition` hoặc precondition config | `authenticatedUser` | `precondition_logged_in_state` | Trang chủ sẵn sàng |
| And | `close_onboarding_popup` và `homePage.closeBlockingModalIfVisible` | Không có | Tùy chọn | Không còn modal chặn |
| When | `open_nocv_job_list` | Không có | Tùy chọn | Danh sách job hiển thị |
| When | `select_first_job` | `usersData[0].otp` | `job_detail_opened` | Có `jobApplyNoCVPage` |
| And | `fill_mini_profile` | `applyData.noCVApply.job1` | Start/end/submit | Profile được gửi |
| And | `bulk_apply_all` | `applyData.noCVApply.job2` | Nếu apply thành công | Xử lý được nhánh `didBulkApply` |
| Then | `verify_applied_jobs` | Không có | `applied_jobs_list_visible` | Danh sách đã ứng tuyển hiển thị |

Preset này là parity fixture để kiểm tra compiler. Các flow khác có thể dùng cùng contract nhưng không được copy riêng compiler.

---

## 4. Kiến trúc triển khai

### 4.1. Nguồn sự thật duy nhất

- `core/generator/wizardSchema.js`: schema, normalize và validation.
- `core/generator/actionRegistry.js`: metadata action, assertion và fixture requirement.
- `core/generator/visualBuilderCompiler.js`: compile duy nhất cho preview backend, validate và save.
- `dashboard/public/app.js`: chỉ quản lý state UI, gọi API và render preview trả về từ backend.

Template `generateBddSpecTemplate` trong frontend phải được loại bỏ hoặc chuyển thành adapter không sinh code độc lập. Không duy trì hai compiler có logic khác nhau.

### 4.2. Module/area cần cập nhật

| Khu vực | Công việc |
|---|---|
| `core/generator/wizardSchema.js` | Bổ sung contract cho action, dataRef, assertion, evidence, control; validate required fields |
| `core/generator/actionRegistry.js` | Chuẩn hóa action id, fixture, params, output variables, platform và metadata UI |
| `core/generator/visualBuilderCompiler.js` | Sinh import, fixture, method call, data expression, assertion, evidence, variable và control flow |
| `dashboard/public/index.html` | Bổ sung Action Picker, Page/fixture, params, data binding, assertion và evidence editor cho mỗi step |
| `dashboard/public/app.js` | Đồng bộ state, load metadata, render conditional fields, giữ draft, gọi compile backend |
| `dashboard/public/styles.css` | Dùng shared panel/editor/form tokens; bảo đảm responsive cho step card và form dài |
| `dashboard/server.js` | Compile/validate/save state ở backend; không tin `specCode` từ client |
| `core/generator/*.test.js` | Unit/regression cho schema, compiler, data mapping, evidence, security và parity |

---

## 5. Lộ trình triển khai theo phase

### Phase 0 - Chốt contract và baseline

**Deliverables**

- Chụp baseline generated output hiện tại của Wizard.
- Tạo fixture parity test từ script `apply_job_noCV_flow.spec.js`.
- Chốt schema version mới, ví dụ `schemaVersion: 2`.
- Liệt kê preset/action/fixture hiện có và action thiếu.

**Gate**

- Có test chứng minh lỗi hiện tại: step chỉ có text vẫn compile thành placeholder/default action.
- Không thay đổi API public ngoài contract đã chốt.

### Phase 1 - Structured Step Editor

**Deliverables**

- Mỗi step có Action Picker.
- Chọn `preset`, method Page Object, locator action hoặc assertion.
- Hiển thị fields theo loại action.
- Chọn data variable/path từ dataset đã chọn.
- Cấu hình evidence trước/sau.
- Cảnh báo step thiếu action hoặc thiếu tham số.

**Gate**

- Không thể đi tới Review/Save nếu có blocking validation error.
- Đổi platform phải lọc lại Page Object và action không tương thích.

### Phase 2 - Compiler runtime parity

**Deliverables**

- Sinh imports tối thiểu và đúng.
- Sinh fixture list và dynamic factory đúng.
- Sinh method calls với params/dataRef.
- Sinh assertion thật.
- Sinh capture theo step.
- Sinh `let`/assignment cho dynamic page.
- Sinh `if`/retry/loop chỉ từ control block đã whitelist.
- Output deterministic với state giống nhau.

**Gate**

- Generated code không còn placeholder trong step hợp lệ.
- `node --check` pass.
- Snapshot/structural assertions khớp flow parity.

### Phase 3 - Preset ứng tuyển không cần CV

**Deliverables**

- Preset hiển thị cho non-tech user bằng tiếng Việt.
- Một thao tác chọn preset tạo đầy đủ step mapping ở mục 3.
- Người dùng có thể xem và chỉnh từng step.
- Preset không hard-code password/token/OTP; OTP lấy từ data fixture hiện có.

**Gate**

- Generated file có cùng hành vi chính với script mẫu.
- Có thể compile từ preset và save vào `tests/e2e/desktop/`.

### Phase 4 - Backend validation, save và conflict safety

**Deliverables**

- `/api/builder/compile` nhận structured state.
- `/api/builder/validate-spec` compile tạm và chạy `node --check`.
- `/api/builder/save` compile lại server-side, kiểm tra path, backup, atomic write và expected hash.
- Lỗi trả theo `path`, `code`, `message`, không trả stack trace/dữ liệu nhạy cảm.

**Gate**

- Path traversal, filename sai, action không tồn tại, fixture thiếu, data path sai và method không tồn tại đều bị từ chối.
- Save conflict không ghi đè file mới hơn.

### Phase 5 - Runtime regression và phát hành

**Deliverables**

- Chạy targeted generated spec trên Desktop.
- Chạy smoke Mobile cho compiler fixture path.
- Kiểm tra evidence, report annotation và final assertion.
- Tài liệu hướng dẫn cho non-tech user.

**Gate**

- Test generated script pass trong môi trường có credential/test data hợp lệ.
- Không có console error mới, duplicate listener hoặc mất draft.

---

## 6. Validation và security requirements

### 6.1. Schema validation

- `featureName`, `scenarioName`, `fileName` bắt buộc theo ngữ cảnh.
- `fileName` chỉ cho phép `.spec.js` và basename an toàn.
- `stepType` thuộc `Given/When/Then/And`.
- `actionId` tồn tại trong registry.
- `pom_method` phải có Page Object, method và params đúng metadata.
- `locator` phải tham chiếu locator được phép; không nhận selector tùy ý nếu policy POM không cho phép.
- `dataRef.file`, `variable`, `path` hợp lệ; kiểm tra path tồn tại nếu yêu cầu.
- Assertion phải có target; assertion cần expected value phải có expected value.
- Evidence name chỉ gồm ký tự an toàn và không trùng trong cùng scenario.

### 6.2. Security/integrity

- Chặn `../`, absolute path và ghi ngoài whitelist.
- Serialize string bằng `JSON.stringify`, không nối code không kiểm soát.
- Mask password, token, OTP và secret trong preview/log/error.
- Custom code chỉ được bật bằng capability rõ ràng; mặc định tắt.
- Không thực thi test trong endpoint validate.
- Không tin `specCode` do frontend gửi khi save.

---

## 7. Bộ kiểm thử bắt buộc

### Unit

- Normalize/validate schema v2.
- Action registry lookup.
- Data path expression.
- Fixture/import resolution.
- Method params và dynamic variable.
- Assertion types.
- Evidence before/after.
- Branch/retry whitelist.
- Deterministic compile.
- No placeholder code trong step hợp lệ.

### API/integration

- Compile success cho parity scenario.
- Compile lỗi khi thiếu action.
- Compile lỗi khi thiếu locator/value/expected value.
- Dataset không tồn tại hoặc dataPath sai.
- Page Object sai platform/not ready.
- Validate syntax không ghi file.
- Save backup/atomic write/conflict.
- Path traversal và malformed payload.

### UI

- Thêm/sửa/xóa/nhân bản/reorder step.
- Action picker đổi loại và hiển thị đúng fields.
- Chọn Page Object và method.
- Bind data path.
- Cấu hình assertion/evidence.
- Chặn Review khi thiếu action.
- Giữ draft khi chuyển tab, refresh hoặc mở Page Manager.
- Keyboard focus, Tab, Enter, Escape và Ctrl/Cmd+S.
- Không tràn ngang ở 1920x1080, 1440x900, 1280px và mobile.
- Light/dark theme và contrast.

### Runtime parity

1. Compile preset ứng tuyển không cần CV.
2. Parse generated spec.
3. Kiểm tra imports/fixtures/steps bằng structural assertions.
4. Chạy targeted spec với test data hợp lệ.
5. Kiểm tra evidence đầu/cuối và evidence giữa flow.
6. Kiểm tra final applied-jobs assertion.
7. Kiểm tra console, exit code, report và artifact path.

---

## 8. Acceptance Criteria đạt 100%

- Người dùng non-tech chọn preset hoặc cấu hình từng step mà không sửa code thủ công.
- Mỗi step hợp lệ có action runtime cụ thể.
- Generated spec có đúng feature, scenario, tag, platform, fixture, Page Object và data.
- `dataPath` thực sự được dùng trong lời gọi action.
- OTP và dữ liệu test được lấy từ fixture/data, không hard-code bí mật.
- `Given`, `When`, `Then`, `And` phản ánh đúng thứ tự và nghiệp vụ.
- Assertion kiểm tra kết quả nghiệp vụ, không dùng assertion placeholder.
- Evidence được sinh theo cấu hình và có tên ổn định.
- Dynamic page, factory, biến dùng chung và nhánh điều kiện compile/chạy đúng.
- Backend validate lại trước save; có backup, atomic write và conflict protection.
- Generated spec pass syntax check và targeted runtime test.
- Wizard restore được draft, không mất state hoặc tạo artifact mồ côi.
- Không phá vỡ script cũ, API cũ, Page Manager, Data Studio hoặc Recorder.

> **Không được tuyên bố 100% chỉ vì UI hiển thị đủ trường. Mốc 100% chỉ đạt khi generated spec được kiểm tra cấu trúc và chạy thành công trong runtime parity test.**

---

## 9. Thứ tự ưu tiên thực hiện

1. Contract/schema và parity baseline.
2. Action Picker cho từng step.
3. Compiler runtime parity.
4. Data binding và assertion builder.
5. Evidence và dynamic variables.
6. Preset ứng tuyển không cần CV.
7. Backend validate/save/conflict.
8. UI/API/unit/runtime regression.
9. Responsive, accessibility, console và documentation pass.

### Ngoài phạm vi MVP

- AI tự đoán toàn bộ action từ câu tiếng Việt.
- Tự động sửa Page Object và fixture không có backup/rollback.
- Arbitrary JavaScript không qua whitelist.
- Nhiều scenario/feature phức tạp nếu chưa có schema và round-trip contract.
