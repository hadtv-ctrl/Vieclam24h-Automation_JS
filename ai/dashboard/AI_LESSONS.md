# Dashboard AI Lessons

This file is the version-controlled memory for agents maintaining the Dashboard. Read it before modifying anything under `dashboard/`.

Only record a lesson after the defect is confirmed and its root cause is understood. Do not store chat transcripts, guesses, credentials, personal data, or duplicate lessons. Consolidate an existing entry when the same cause appears again.

## Required entry format

- Date
- Area
- Symptom
- Root cause
- Correct pattern
- Preventive rule
- Regression check
- Related files

## Confirmed lessons

### 2026-09-05 — Base fixtures must be parsed as DI capabilities, not UI Page Objects

- Area: Object Repository & Page Manager / BDD Inspector.
- Symptom: Base test fixtures (`baseTest.js`, `mobileWebTest.js`) have no class constructor or UI locators, so standard page object parsers fail or misclassify them.
- Root cause: Fixtures use `base.extend({ ... })` for dependency injection (preconditions, worker data, injected pages, factories) rather than `class extends BasePage`.
- Correct pattern: Parse fixtures specifically by extracting injected keys from `.extend({ ... })`, categorize capabilities (`Xác thực & Precondition`, `Page Object Injection`, `Factory`, `Hạ tầng`), protect them from deletion, and adapt the UI (hide locator inputs, render capability pills with copy actions, provide direct code modal/editor access).
- Preventive rule: Always distinguish UI Page Objects (locators + actions) from Test Fixtures (Dependency Injection & lifecycle hooks) in framework visual inspection tools.
- Regression check: Run `core/generator/objectRepository.test.js` to ensure 17 pages + 2 fixtures scan cleanly; verify fixture filter and inspection in Page Manager.
- Related files: `core/generator/objectRepository.js`, `dashboard/public/app.js`, `dashboard/public/index.html`, `dashboard/public/styles.css`.

### 2026-09-05 — Codex/Ollama schema errors must fail fast

- Area: AI Agent local model startup.
- Symptom: A request stayed on “Đang khởi động mô hình local…” for many minutes without a response.
- Root cause: Codex CLI requested the Ollama model list through an OpenAI-compatible response (`object`/`data`) but attempted to parse it as a native Ollama response with `models`.
- Correct pattern: Surface the first sanitized Codex stderr event, detect the known model-schema mismatch, terminate the subprocess, and report an actionable compatibility error; keep a bounded startup timeout as a fallback.
- Preventive rule: Never leave a local Agent session waiting indefinitely when the provider emits a startup error; test both stderr failure and no-output timeout paths.
- Regression check: Start a local session against the incompatible provider, verify the error event and stopped session, then verify service, route, and UI controller regression tests remain green.
- Related files: `core/ai/agentService.js`, `dashboard/public/agent.js`, `dashboard/agent-ui.test.js`.

### 2026-09-03 — Shared UI behavior must have one implementation

- Area: Dashboard layout and source-code editors.
- Symptom: Page Manager and BDD/Test areas use different header backgrounds, page padding, workspace gaps, responsive rules, and edit/view implementations for equivalent behavior.
- Root cause: Feature-specific CSS selectors and JavaScript event handlers independently redefine page structure and code editing instead of consuming shared primitives.
- Correct pattern: Centralize design tokens and shared page/header/workspace/panel classes; use one file-language registry and one reusable code-editor controller for every source-code surface.
- Preventive rule: Before adding a layout or editor, search for the existing shared primitive and extend it. Feature classes may define only behavior that is genuinely feature-specific.
- Regression check: Compare computed styles in light/dark mode and supported viewports; verify every code surface has consistent language highlighting, inline editing, dirty state, save, revert, copy, Tab, Ctrl/Cmd+S, and scroll synchronization without duplicate listeners.
- Related files: `dashboard/public/index.html`, `dashboard/public/styles.css`, `dashboard/public/app.js`.

### 2026-09-03 — AI rules need tool-native discovery entry points

- Area: Repository AI instructions.
- Symptom: A canonical Dashboard prompt exists, but some assistants do not automatically discover `AGENTS.md` or repository-local Codex skills.
- Root cause: Copilot and Gemini use their own repository instruction discovery conventions.
- Correct pattern: Keep one canonical Dashboard prompt and connect it through each supported tool's native entry point.
- Preventive rule: When the canonical prompt is moved or renamed, update Codex, Copilot, Gemini, Cursor, and Windsurf entry points in the same change; do not duplicate the full prompt in those entry points.
- Regression check: Confirm `.github/copilot-instructions.md` and the Dashboard path-specific Copilot instruction reference the canonical files; confirm root `GEMINI.md` imports the canonical prompt and lessons; confirm all referenced paths exist.
- Related files: `AGENTS.md`, `.github/copilot-instructions.md`, `.github/instructions/dashboard.instructions.md`, `GEMINI.md`, `.cursorrules`, `.windsurfrules`, `.agents/skills/dashboard-maintainer/SKILL.md`.

### 2026-09-04 — Wizard dependency states must match their controls

- Area: BDD Script Studio Wizard, Page Object dependency step.
- Symptom: The dependency list displayed “Chưa có Page Object sẵn sàng cho platform này” while the primary Page Object dropdown still offered a default `HomePage.js`; the message also used inconsistent typography and gave no next action.
- Root cause: The list and dropdown independently filtered Page Objects, and the empty state did not distinguish platform compatibility from readiness.
- Correct pattern: Share one compatibility filter and option renderer; when no ready Page Object exists, show the selected platform, explain whether files are missing or blocked, provide a create action, and disable the misleading default option.
- Preventive rule: Test Wizard dependency states for each platform with ready, blocked, empty, loading, and API-error data; verify list, dropdown, copy, and actions remain consistent.
- Regression check: Assert the ready-card count and dropdown options for Desktop/Mobile, then mock an empty or blocked repository and assert the contextual empty state, disabled primary option, create action, no horizontal overflow, and consistent font tokens.
- Related files: `dashboard/public/index.html`, `dashboard/public/styles.css`, `dashboard/public/app.js`.

### 2026-09-04 — Wizard actions need one entry point and explicit validation

- Area: BDD Script Studio Wizard navigation.
- Symptom: The sidebar repeated the primary create action; required scenario-name fields did not block “Tiếp theo”; the active navigation button looked disabled.
- Root cause: Duplicate controls were wired to the same workflow, the Wizard was not a form so native `required` validation never ran, and `.primary-button` had no shared active-state styling.
- Correct pattern: Keep one create entry point, validate each required Wizard step in the navigation handler, and define a shared primary button state with clear disabled styling.
- Preventive rule: Test duplicate-control count, empty required values, valid progression, active/disabled contrast, keyboard focus, and mobile wrapping for every Wizard step.
- Regression check: Assert one create action, empty scenario remains on Step 1 with a validation message, valid scenario advances to Step 2, and the active next button has full opacity and accent background.
- Related files: `dashboard/public/index.html`, `dashboard/public/styles.css`, `dashboard/public/app.js`.

### 2026-09-05 — Draft storage must be isolated outside framework source directories

- Area: Draft management for Test Scripts & Page Objects.
- Symptom: Saving in-progress drafts directly to `tests/` or `pages/` causes Playwright test runner (`npx playwright test`) and framework checker (`npm run check:framework`) to fail due to incomplete syntax or missing locators.
- Root cause: Temporary work-in-progress files reside within executable framework scan paths.
- Correct pattern: Store uncompleted drafts in a dedicated isolated directory (`.dashboard-drafts/` with `scripts/` and `pages/` subdirectories) ignored by git; only write to canonical directories (`tests/e2e/<platform>/` or `pages/<platform>/`) upon explicit, validated user creation, and automatically delete the corresponding draft upon success.
- Preventive rule: Never write uncompleted test scripts or Page Objects into executable test directories. Always verify `npm run check:framework` and Playwright suites remain completely unaffected by active drafts.
- Regression check: Save in-progress script and page drafts, verify `.dashboard-drafts/` stores them, verify `npm run check:framework` passes with 0 errors, finalize creation, verify files appear in canonical destination and draft files are deleted.
- Related files: `core/generator/draftManager.js`, `dashboard/server.js`, `dashboard/public/index.html`, `dashboard/public/app.js`, `.gitignore`.

### 2026-09-05 — Modal box width and body padding must strictly follow shared dialog primitives

- Area: Modal Dialogs (Delete Confirmation, Code Viewer, Action Linker).
- Symptom: Confirmation modal (`#modal-confirm-delete`) has a 40px empty column on the right, header/footer backgrounds cut off prematurely, content adheres to the left edge with 0px padding, and close button displays an unsightly thick black browser focus box.
- Root cause: Setting `max-width` on the inner `.app-modal-box` instead of outer `.app-modal`, leaving `.app-modal-box` without `width: 100%`, omitting class `.app-modal-body` in favor of inline `padding: 16px 0;`, and missing focus resets on `.btn-icon-subtle`.
- Correct pattern: Constrain width exclusively on `.app-modal` (e.g. `max-width: 480px; width: 92vw;`), enforce `width: 100%; max-width: 100%; box-sizing: border-box;` on `.app-modal-box`, wrap all modal content in `.app-modal-body` (`padding: 22px`), and apply `:focus:not(:focus-visible) { outline: none; }` with subtle accent outline for `:focus-visible`.
- Preventive rule: Never apply inline `max-width` or inline horizontal padding overrides to modal inner containers. Verify computed box bounds match dialog bounds exactly and test programmatic autofocus across both light and dark themes.
- Regression check: Measure `.app-modal` and `.app-modal-box` bounding rects in Chromium; verify `Math.abs(modalWidth - boxWidth) <= 2`, zero horizontal page overflow, symmetric 22px padding on all sides, and clean theme-aligned focus rings.
- Related files: `dashboard/public/index.html`, `dashboard/public/styles.css`, `dashboard/public/app.js`.

### 2026-09-06 — Multi-user AI configurations must support client-scoped storage without server overwrite

- Area: Dashboard AI Settings & Agent execution.
- Symptom: When multiple team members access the Dashboard concurrently from different machines, modifying the AI Provider or API Key in the server `.env` causes key collisions, quota exhaustion, and overwrites other members' active settings.
- Root cause: Storing AI credentials exclusively in the server-side environment (`.env`) assumes a single-tenant local runtime.
- Correct pattern: Provide a dual-scope storage model: Server scope (`.env` for single-user local machines) vs Client scope (`localStorage` for multi-user team networks). Transmit client credentials via secure headers (`X-AI-Config`) and request payloads (`clientConfig`) so that individual browser sessions execute with their own provider/key/model while falling back cleanly to server defaults when unconfigured.
- Preventive rule: Always design developer AI tooling with dual-scope storage (Server `.env` + Client `localStorage`) to accommodate both local solo developers and shared team servers.
- Regression check: Run `core/ai/agentService.test.js`, `core/ai/agentRoutes.test.js`, and `dashboard/agent-ui.test.js` to ensure clientConfig override, server fallback, and status reporting pass 100%.
- Related files: `core/ai/agentService.js`, `core/ai/agentRoutes.js`, `dashboard/server.js`, `dashboard/public/index.html`, `dashboard/public/app.js`, `dashboard/public/agent.js`.

### 2026-09-06 — Top-level Dashboard studio views must adhere to the canonical 3-frame layout

- Area: Dashboard Layout & Workspace Architecture (Page Manager, BDD Studio, Test Suites).
- Symptom: Implementing new management views (such as Test Suites) as card grids or 2-column layouts creates visual inconsistency, breaks muscle memory, and deviates from the established 3-column architecture (`290px minmax(360px, 1fr) minmax(380px, 1fr)`).
- Root cause: Treating new views as standalone settings cards rather than first-class studio workspaces consuming the shared 3-panel layout system.
- Correct pattern: Structure top-level studio views with the canonical 3-frame layout:
  - Khung 1 (Cột 1, 290px): Danh sách thực thể (search, filter pills, counters, collapsible rail strip).
  - Khung 2 (Cột 2, minmax(360px, 1fr)): Thiết lập chi tiết & form inputs / inspector.
  - Khung 3 (Cột 3, minmax(380px, 1fr)): Tổng quan thực thi, live code/spec preview, lệnh CLI, and primary run/save actions.
- Preventive rule: Never introduce 2-column card layouts or unstructured panels for primary dashboard studios; always consume `.suites-workspace` or equivalent 3-column grid tokens with collapsible sidebars.
- Regression check: Assert presence of all 3 panels (`sidebar`, `middle-panel`, `right-panel`) in DOM, test sidebar collapse/expand rail, verify responsive grid stacking on 1400px, 1050px, and 375px mobile, and verify zero horizontal overflow.
- Related files: `dashboard/public/index.html`, `dashboard/public/styles.css`, `dashboard/public/app.js`.

### 2026-09-08 — Subprocess execution in detached dashboard servers must enforce windowsHide and in-process execution

- Area: Git Sync Studio, Framework Quality Gate & Background Services.
- Symptom: When clicking the "main" branch button on the Dashboard in satellite projects, multiple black command prompt (`cmd.exe`) windows flash open and closed rapidly.
- Root cause: Satellite dashboards run detached without an attached console window (`detached: true, stdio: 'ignore'`). Invoking `execSync(command)` on Windows executes `cmd.exe /d /s /c ...` without `windowsHide: true`, causing Windows to allocate a new console window for each command. The sequence of 6 Git queries, 1 branch query, and 1 node quality check caused 8 console windows to flicker in rapid succession.
- Correct pattern:
  1. Always pass `windowsHide: true` and `stdio: ['pipe', 'pipe', 'pipe']` to all child process executions (`spawnSync`, `execSync`, `spawn`).
  2. Invoke `git.exe` directly via `spawnSync('git', args)` rather than spawning `cmd.exe`.
  3. Batch Git status and tracking queries using `git status --porcelain=v1 -uall --branch`.
  4. Run framework quality checks in-process via an exported module function (`runFrameworkCheck`) rather than spawning a separate `node` runtime.
- Preventive rule: Never invoke `execSync` or `spawn` without `windowsHide: true` in background server modules. Prefer in-process verification over subprocess calls whenever inspecting framework structure.
- Regression check: Click `#topbar-git-btn` ("main") in a detached dashboard server running on Windows; verify zero console windows appear, `/api/git/status` and `/api/git/quality-check` return HTTP 200 with complete branch and quality status, and `npm run check:framework` remains green.
- Related files: `core/system/gitSyncService.js`, `scripts/check-framework-structure.js`, `core/generator/recordWriter.js`, `core/system/updater.js`, `dashboard/server.js`, `dashboard/public/app.js`, `scripts/sync-satellites.js`.

### 2026-09-08 — Brand logo badges must render child img tags with fallback and respect theme-aware background colors

- Area: Dashboard Branding, Topbar Brand Badge & Theme Switching.
- Symptom: Setting a custom `logoUrl` in Dashboard Settings (Giao diện & Branding) resulted in an empty, invisible brand badge in the topbar `#brand-logo`, even though the live preview mockup rendered the logo. Additionally, setting a custom light background color broke dark mode contrast.
- Root cause:
  1. `applyLogoElement` cleared `innerHTML` and set inline `style.backgroundImage = url(...)`. Meanwhile, `.brand-mark-badge.has-logo` in `styles.css` specified `background: transparent !important;`. The CSS shorthand `background` reset `background-image` and overrode the inline style due to `!important`, leaving an empty invisible container.
  2. Setting `root.style.setProperty('--bg', config.backgroundColor)` applied an inline style that overrode dark mode theme variables, destroying dark mode contrast when a light background color was saved.
  3. Clicking `#topbar-git-btn` fired duplicate handlers because the button already carried the `.view-tab` class while also having an independent programmatic `.click()` attached.
- Correct pattern:
  1. Render a dedicated `<img>` child element inside `.brand-mark-badge` with `object-fit: contain; width: 100%; height: 100%;` and an `onerror` handler that automatically restores the fallback badge ("QA") and removes `.has-logo`.
  2. Bind real-time topbar brand logo updates inside `updateBrandingPreview()` so live input changes reflect instantly in both the preview and topbar.
  3. Manage custom background colors via theme-aware logic (`applyTheme` only sets custom `--bg` when `theme === 'light'`, removing it in dark mode to preserve dark palette integrity).
  4. Guard `openGitStudio()` against re-entrant calls and remove redundant synthetic click dispatchers.
- Preventive rule: Never rely on `style.backgroundImage` when parent CSS uses `background: ... !important`. Always render explicit `<img>` tags for brand logos with automatic graceful fallbacks. Never let light theme background overrides corrupt dark mode variables.
- Regression check: In Chromium at 1920x1080 and 1440x900, verify `#brand-logo` renders `<img>` with clean scaling; test valid SVG, valid PNG, empty URL, and broken image URLs; toggle dark and light modes and verify razor-sharp contrast across both.
- Related files: `dashboard/public/app.js`, `dashboard/public/styles.css`, `core/system/gitSyncService.js`.

### 2026-09-11 — Modular HTML template loading must be awaited before invoking view controllers

- Area: Modular Studio Architecture, View Tab Switching & Data Rendering.
- Symptom: Dashboard displays empty lists / zero items across BDD Test Scripts (stuck on "Đang đọc các kịch bản..."), Page Objects (blank list, 0 pages), Test Suites (total 0 suites), and Data Studio upon navigation.
- Root cause:
  1. Commit `0d41463` extracted 4,112 lines of studio view HTML from `index.html` into 12 standalone template files (`templates/*.html`).
  2. Tab click event listeners in `app.js` executed view controllers (`openPageManager()`, `initVisualBuilder()`, `openSuitesManager()`) synchronously *before* the asynchronous template loader fetched and injected the HTML into the container.
  3. When DOM queries ran against container elements (`#script-files-list`, `#page-manager-existing-list`, `#suites-sidebar-list`), they returned `null`, silently skipping rendering or locking initialization flags (`suitesViewInitialized = true`, `isVisualBuilderInitialized = true`). Once the template finally loaded into the DOM, its static placeholder spinner or 0-count badges remained permanently.
- Correct pattern:
  1. Implement an explicit `ensureViewTemplate(viewId)` promise cache in `app.js` that checks whether the container has children, fetches `/templates/${name}.html` if empty, and populates `innerHTML`.
  2. Invoke `preloadAllViewTemplates()` immediately at bootstrap to asynchronously preload all 12 templates (~5-10ms on localhost).
  3. `await ensureViewTemplate(...)` both in `.view-tab` click handlers and at the entry point of each individual view controller.
  4. Guard initialization functions (`initSuitesView`, `initVisualBuilderControls`, `initDataStudioControls`, `initGitStudio`) so they only latch `true` when DOM elements actually exist.
  5. Connect `window.onViewSwitched(targetViewId)` to allow cross-slice and event bus navigation to cleanly trigger view controllers.
- Preventive rule: Any view controller querying the DOM must guarantee that its container markup is fully mounted prior to reading or binding elements. Never rely on implicit asynchronous script execution order between classic scripts and ES modules.
- Regression check: In browser, switch between Runner, BDD Studio, Page Objects, Test Suites, Data Studio, Fixtures, and Settings; verify all items (25 scripts, 19 pages, 19 suites, 5 datasets) render instantly with correct hero counts and zero stuck spinners.
- Related files: `dashboard/public/app.js`, `dashboard/public/js/core/templateLoader.js`, `dashboard/public/js/core/featureRegistry.js`, `dashboard/public/js/legacy/legacyAdapter.js`, `dashboard/public/templates/*.html`.


