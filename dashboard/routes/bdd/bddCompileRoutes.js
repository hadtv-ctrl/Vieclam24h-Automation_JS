/**
 * dashboard/routes/bdd/bddCompileRoutes.js
 * Handles Visual Scenario Compiler, Spec Validation, Saving, and Auto-Capture.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { PRESET_ACTIONS, compileVisualScenario } = require('../../../core/generator/visualBuilderCompiler');
const { injectSmartEvidenceCaptures } = require('../../../core/generator/evidenceInjector');
const { hashText } = require('../../../core/generator/wizardSchema');
const { cleanupDraft } = require('../../../core/generator/draftManager');
const { scanAllPageObjects } = require('../../../core/generator/objectRepository');
const { readDataset } = require('../../../core/utils/dataManager');
const { createBackup } = require('../../services/resourceService');
const { sendJson, parseBody } = require('../routeUtils');

function validateWizardDependencies(state, root) {
  const platform = state.platform || 'desktop';
  const pages = scanAllPageObjects(root);
  const errors = [];
  for (const selected of Array.isArray(state.pageObjects) ? state.pageObjects : []) {
    const relativePath = typeof selected === 'string' ? selected : selected?.path || selected?.relativePath;
    const page = pages.find((item) => item.relativePath === relativePath);
    if (!page) { errors.push(`Page Object không tồn tại: ${relativePath || 'unknown'}.`); continue; }
    if (page.platform !== platform) errors.push(`Page Object ${relativePath} không tương thích platform ${platform}.`);
    if (!page.readiness?.ready) errors.push(`Page Object ${relativePath} chưa sẵn sàng.`);
  }
  for (const source of state.dataSources || []) {
    try {
      if (!source.dataPath || !String(source.dataPath).trim()) {
        errors.push(`Chưa chọn đường dẫn dữ liệu (dataPath) cho ${source.file || 'dataset'}.`);
        continue;
      }
      const dataset = readDataset(path.basename(source.file));
      let value = dataset.data;
      for (const segment of String(source.dataPath).split('.')) value = value?.[segment];
      if (value === undefined) errors.push(`dataPath không tồn tại: ${source.dataPath}.`);
    } catch (_) { errors.push(`Dataset không hợp lệ: ${source.file}.`); }
  }
  return errors;
}

async function handleBddCompileRoutes(request, response, url, context = {}) {
  const root = context.root || process.env.QA_PROJECT_ROOT || process.cwd();

  if (request.method === 'GET' && url.pathname === '/api/builder/actions') {
    try {
      const presetActions = PRESET_ACTIONS.map(({ id, category, stepType, name, desc, fixture }) => ({
        id, category, stepType, name, desc, fixture,
      }));
      sendJson(response, 200, { presetActions });
    } catch (error) {
      sendJson(response, 500, { error: error.message });
    }
    return true;
  }

  if (request.method === 'POST' && url.pathname === '/api/builder/compile') {
    try {
      const body = await parseBody(request);
      const isPreview = body.previewMode !== false;
      const dependencyErrors = isPreview ? [] : validateWizardDependencies(body, root);
      if (dependencyErrors.length) return sendJson(response, 422, { valid: false, errors: dependencyErrors, warnings: [] }) || true;
      const compiled = compileVisualScenario(body, { previewMode: isPreview });
      sendJson(response, compiled.valid ? 200 : 422, compiled);
    } catch (error) {
      sendJson(response, 400, { error: error.message });
    }
    return true;
  }

  if (request.method === 'POST' && url.pathname === '/api/builder/validate-spec') {
    let tempPath = '';
    try {
      const body = await parseBody(request);
      const dependencyErrors = validateWizardDependencies(body, root);
      if (dependencyErrors.length) return sendJson(response, 422, { valid: false, syntaxError: null, errors: dependencyErrors, warnings: [] }) || true;
      const compiled = compileVisualScenario(body);
      if (!compiled.valid) return sendJson(response, 422, { ...compiled, syntaxError: null }) || true;
      tempPath = path.join(root, '.tmp', `wizard-validate-${process.pid}-${Date.now()}.spec.js`);
      fs.mkdirSync(path.dirname(tempPath), { recursive: true });
      fs.writeFileSync(tempPath, compiled.specCode, 'utf8');
      try {
        execSync(`node --check "${tempPath}"`, { cwd: root, stdio: 'pipe', windowsHide: true });
        sendJson(response, 200, { valid: true, syntaxError: null, errors: [], warnings: compiled.warnings, compiledHash: compiled.compiledHash, specRelativePath: compiled.specRelativePath });
      } catch (error) {
        sendJson(response, 422, { valid: false, syntaxError: error.stderr?.toString() || error.message, errors: [{ code: 'syntax-error', message: 'Spec sinh ra có lỗi cú pháp.' }], warnings: compiled.warnings, compiledHash: compiled.compiledHash });
      }
    } catch (error) {
      sendJson(response, 400, { valid: false, syntaxError: null, errors: [{ code: 'request-error', message: error.message }], warnings: [] });
    } finally {
      if (tempPath) fs.rmSync(tempPath, { force: true });
    }
    return true;
  }

  if (request.method === 'POST' && url.pathname === '/api/builder/save') {
    try {
      const body = await parseBody(request);
      const dependencyErrors = validateWizardDependencies(body, root);
      if (dependencyErrors.length) return sendJson(response, 422, { valid: false, errors: dependencyErrors, warnings: [] }) || true;
      const compiled = compileVisualScenario(body);
      if (!compiled.valid) return sendJson(response, 422, compiled) || true;
      const fullPath = path.join(root, compiled.specRelativePath);
      const specDir = path.dirname(fullPath);
      if (!fs.existsSync(specDir)) fs.mkdirSync(specDir, { recursive: true });
      let backup = null;
      if (fs.existsSync(fullPath)) {
        if (body.expectedHash && body.expectedHash !== hashText(fs.readFileSync(fullPath, 'utf8'))) {
          return sendJson(response, 409, { error: 'File đã thay đổi trên disk. Hãy tải lại trước khi lưu.' }) || true;
        }
        backup = createBackup(compiled.specRelativePath, fullPath, root);
      }
      const tempPath = `${fullPath}.${process.pid}.tmp`;
      fs.writeFileSync(tempPath, compiled.specCode, 'utf8');
      fs.renameSync(tempPath, fullPath);
      if (body.draftId) cleanupDraft({ type: 'script', id: body.draftId, rootDir: root });
      sendJson(response, 200, {
        success: true, message: 'Đã lưu kịch bản kiểm thử thành công', specPath: compiled.specRelativePath, backup, compiledHash: compiled.compiledHash,
      });
    } catch (error) {
      sendJson(response, 400, { error: error.message });
    }
    return true;
  }

  if (request.method === 'POST' && url.pathname === '/api/builder/auto-capture') {
    try {
      const body = await parseBody(request);
      const specCode = String(body.specCode || '');
      const result = injectSmartEvidenceCaptures(specCode, { filePath: body.filePath });
      sendJson(response, 200, result);
    } catch (error) {
      sendJson(response, 400, { error: error.message });
    }
    return true;
  }

  return false;
}

module.exports = { handleBddCompileRoutes, validateWizardDependencies };
