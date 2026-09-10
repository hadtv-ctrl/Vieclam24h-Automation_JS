/**
 * dashboard/routes/bdd/bddScriptRoutes.js
 * Handles BDD script loading, step insertion, script creation/deletion, and draft management.
 */
const fs = require('fs');
const path = require('path');
const { scanAllProjectScripts, parseExistingSpecFile } = require('../../../core/generator/visualBuilderCompiler');
const { deleteTestScript, createBackup } = require('../../services/resourceService');
const { saveDraft, listDrafts, getDraft, deleteDraft, cleanupDraft } = require('../../../core/generator/draftManager');
const { sendJson, parseBody, safeChildPath } = require('../routeUtils');

async function handleBddScriptRoutes(request, response, url, context = {}) {
  const root = context.root || process.env.QA_PROJECT_ROOT || process.cwd();

  if (request.method === 'GET' && url.pathname === '/api/builder/scripts') {
    try {
      sendJson(response, 200, { scripts: scanAllProjectScripts(root) });
    } catch (e) { sendJson(response, 500, { error: e.message }); }
    return true;
  }
  if (request.method === 'GET' && url.pathname === '/api/builder/load-spec') {
    const file = url.searchParams.get('file');
    if (!file) { sendJson(response, 400, { error: 'Thiếu file kịch bản.' }); return true; }
    try { sendJson(response, 200, parseExistingSpecFile(file, root)); }
    catch (e) { sendJson(response, 404, { error: e.message }); }
    return true;
  }
  if ((request.method === 'DELETE' || request.method === 'POST') && (url.pathname === '/api/builder/script' || url.pathname === '/api/builder/delete-script')) {
    try {
      const body = request.method === 'POST' ? await parseBody(request) : {};
      const spec = body.spec || body.specPath || body.path || body.file || url.searchParams.get('spec') || url.searchParams.get('specPath') || url.searchParams.get('file');
      if (!spec) { sendJson(response, 400, { error: 'Thiếu đường dẫn kịch bản cần xóa.' }); return true; }
      sendJson(response, 200, deleteTestScript(spec, root));
    } catch (e) { sendJson(response, 400, { error: e.message }); }
    return true;
  }
  if (request.method === 'GET' && url.pathname === '/api/builder/page-content') {
    const pageFile = url.searchParams.get('file');
    if (!pageFile) { sendJson(response, 400, { error: 'Thiếu đường dẫn Page Object.' }); return true; }
    const fullPath = safeChildPath(root, pageFile.startsWith('/') ? pageFile : `/${pageFile}`);
    if (!fullPath || !fs.existsSync(fullPath)) { sendJson(response, 404, { error: 'Không tìm thấy file Page Object.' }); return true; }
    try { sendJson(response, 200, { path: pageFile, content: fs.readFileSync(fullPath, 'utf8') }); }
    catch (e) { sendJson(response, 500, { error: e.message }); }
    return true;
  }
  if (request.method === 'POST' && url.pathname === '/api/drafts/save') {
    try {
      const { type, id, data } = await parseBody(request);
      if (!type || !['script', 'page'].includes(type)) return sendJson(response, 400, { error: 'type phải là "script" hoặc "page"' }) || true;
      sendJson(response, 200, { success: true, draft: saveDraft({ type, id, data, rootDir: root }) });
    } catch (e) { sendJson(response, 500, { error: `Lỗi lưu bản nháp: ${e.message}` }); }
    return true;
  }
  if (request.method === 'GET' && url.pathname === '/api/drafts') {
    try { sendJson(response, 200, { success: true, drafts: listDrafts({ type: url.searchParams.get('type') || 'script', rootDir: root }) }); }
    catch (e) { sendJson(response, 500, { error: `Lỗi tải danh sách bản nháp: ${e.message}` }); }
    return true;
  }
  if (request.method === 'GET' && (url.pathname === '/api/drafts/get' || url.pathname === '/api/drafts/detail')) {
    try {
      const id = url.searchParams.get('id');
      if (!id) return sendJson(response, 400, { error: 'Thiếu id bản nháp' }) || true;
      const draft = getDraft({ type: url.searchParams.get('type') || 'script', id, rootDir: root });
      if (!draft) return sendJson(response, 404, { error: 'Không tìm thấy bản nháp' }) || true;
      sendJson(response, 200, { success: true, draft });
    } catch (e) { sendJson(response, 500, { error: `Lỗi lấy bản nháp: ${e.message}` }); }
    return true;
  }
  if ((request.method === 'DELETE' || request.method === 'POST') && (url.pathname === '/api/drafts/delete' || url.pathname === '/api/drafts/discard')) {
    try {
      const b = request.method === 'POST' ? await parseBody(request) : {};
      const id = b.id || url.searchParams.get('id');
      if (!id) return sendJson(response, 400, { error: 'Thiếu id bản nháp cần xóa' }) || true;
      sendJson(response, 200, deleteDraft({ type: b.type || url.searchParams.get('type') || 'script', id, rootDir: root }));
    } catch (e) { sendJson(response, 500, { error: `Lỗi xóa bản nháp: ${e.message}` }); }
    return true;
  }
  if (request.method === 'POST' && url.pathname === '/api/builder/insert-step') {
    return handleInsertStep(request, response, root);
  }
  if (request.method === 'POST' && url.pathname === '/api/builder/create-script') {
    return handleCreateScript(request, response, root);
  }
  return false;
}

async function handleInsertStep(request, response, root) {
  try {
    const body = await parseBody(request);
    const { scriptPath, pageFile, pageClassName, actionType, actionName, actionParams, locatorInteraction = 'click', locatorValue, stepType = 'When', stepTitle, includeEvidence = true } = body;
    if (!scriptPath) return sendJson(response, 400, { error: 'Thiếu đường dẫn kịch bản BDD (scriptPath).' }) || true;
    const fullPath = path.resolve(root, scriptPath);
    if (!fs.existsSync(fullPath)) return sendJson(response, 404, { error: `Không tìm thấy file kịch bản: ${scriptPath}` }) || true;
    let content = fs.readFileSync(fullPath, 'utf8');
    const cleanClassName = pageClassName || (pageFile ? path.basename(pageFile, '.js') : 'CustomPage');
    const fixtureName = cleanClassName.charAt(0).toLowerCase() + cleanClassName.slice(1);
    const testArgsMatch = content.match(/test\(\s*(?:'[^']*'|"[^"]*"|`[^`]*`)\s*,\s*async\s*\(\s*\{([^}]*)\}\s*\)\s*=>/);
    if (testArgsMatch) {
      const currentArgs = testArgsMatch[1];
      const argTokens = currentArgs.split(',').map((t) => t.trim()).filter(Boolean);
      if (!argTokens.includes(fixtureName)) {
        const rawTrimEnd = currentArgs.replace(/\s+$/, '');
        content = content.replace(testArgsMatch[0], testArgsMatch[0].replace(currentArgs, `${rawTrimEnd}${rawTrimEnd.endsWith(',') ? '' : ','}\n    ${fixtureName},\n  `));
      }
    }
    const actionLines = [];
    const safeStepTitle = (stepTitle || `Tôi thực hiện ${actionName}`).trim();
    const evidenceName = `${stepType.toLowerCase()}_${actionName}_completed`.replace(/[^a-zA-Z0-9_]/g, '_');
    if (actionType === 'locator') {
      const locVar = `${fixtureName}.${actionName}`;
      if (locatorInteraction === 'fill') actionLines.push(`      await ${locVar}.fill(${JSON.stringify(locatorValue || '')});`);
      else if (locatorInteraction === 'check') actionLines.push(`      await ${locVar}.check();`);
      else if (locatorInteraction === 'visible') actionLines.push(`      await expect(${locVar}).toBeVisible();`);
      else actionLines.push(`      await ${locVar}.click();`);
    } else {
      actionLines.push(`      await ${fixtureName}.${actionName}(${(actionParams || '').trim()});`);
    }
    if (includeEvidence && locatorInteraction !== 'visible') actionLines.push(`      await ${fixtureName}.capture('${evidenceName}');`);
    const stepBlock = `\n    await test.step('${stepType} ${safeStepTitle}', async () => {\n${actionLines.join('\n')}\n    });\n`;
    const lastStepIndex = content.lastIndexOf('await test.step');
    if (lastStepIndex !== -1) {
      const stepEndMatch = content.slice(lastStepIndex).match(/\n\s*\}\s*\);\s*(?=\n\s*(?:\}\s*\);|test\.after|\/\/|$))/);
      const insertPos = stepEndMatch ? lastStepIndex + stepEndMatch.index + stepEndMatch[0].length : content.lastIndexOf('});');
      content = insertPos !== -1 ? content.slice(0, insertPos) + stepBlock + content.slice(insertPos) : content + stepBlock;
    } else {
      const lastClose = content.lastIndexOf('});');
      content = lastClose !== -1 ? content.slice(0, lastClose) + stepBlock + content.slice(lastClose) : content + stepBlock;
    }
    try { new Function(content); } catch (e) { return sendJson(response, 400, { error: `Mã nguồn sau khi chèn bước có lỗi cú pháp JS: ${e.message}` }) || true; }
    const backup = createBackup(scriptPath, fullPath, root);
    fs.writeFileSync(fullPath, content, 'utf8');
    sendJson(response, 200, {
      success: true, message: `Đã thêm bước "${stepType} ${safeStepTitle}" gọi ${cleanClassName}.${actionName}() thành công!`,
      script: parseExistingSpecFile(scriptPath, root), backup,
    });
  } catch (err) { sendJson(response, 500, { error: `Lỗi chèn bước BDD: ${err.message}` }); }
  return true;
}

async function handleCreateScript(request, response, root) {
  try {
    const body = await parseBody(request);
    const platform = body.platform === 'mobile-web' ? 'mobile-web' : 'desktop';
    let rawName = (body.fileName || '').trim().replace(/\.spec\.js$/, '');
    if (!rawName) rawName = `scenario_${Date.now()}`;
    if (!rawName.endsWith('-bdd')) rawName += '-bdd';
    const fileName = `${rawName}.spec.js`;
    const relPath = `tests/e2e/${platform}/${fileName}`;
    const fullPath = path.resolve(root, relPath);
    if (fs.existsSync(fullPath)) return sendJson(response, 400, { error: `File kịch bản ${fileName} đã tồn tại trong ${platform}.` }) || true;
    const fixtureName = body.primaryPage ? path.basename(body.primaryPage, '.js').charAt(0).toLowerCase() + path.basename(body.primaryPage, '.js').slice(1) : 'homePage';
    const fixtureRelPath = platform === 'mobile-web' ? '../../../core/fixtures/mobileWebTest' : '../../../core/fixtures/baseTest';
    const template = `const { test, expect } = require('${fixtureRelPath}');\n\ntest.describe('Feature: ${(body.featureName || 'Tính năng kiểm thử').trim()} ${(body.tags || '@e2e @custom').trim()}', () => {\n  test('${(body.scenarioName || 'Người dùng thực hiện quy trình kiểm thử').trim()}', async ({\n    ${fixtureName},\n  }, testInfo) => {\n    test.setTimeout(180000);\n    testInfo.annotations.push({ type: 'Precondition', description: 'Môi trường sẵn sàng, khởi tạo kịch bản kiểm thử' });\n    await test.step('Given Tiền điều kiện: Mở trang kiểm thử và chuẩn bị môi trường', async () => {\n      await ${fixtureName}.capture('precondition_ready');\n    });\n    await test.step('When Người dùng thực hiện các bước kiểm thử', async () => {});\n    await test.step('Then Hệ thống phản hồi đúng kết quả mong đợi', async () => {});\n  });\n});\n`;
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(fullPath, (typeof body.specCode === 'string' && body.specCode.trim()) ? body.specCode : template, 'utf8');
    if (body.draftId) cleanupDraft({ type: 'script', id: body.draftId, rootDir: root });
    sendJson(response, 200, { success: true, message: `Đã tạo kịch bản BDD ${fileName} thành công!`, script: parseExistingSpecFile(relPath, root) });
  } catch (err) { sendJson(response, 500, { error: `Lỗi tạo kịch bản: ${err.message}` }); }
  return true;
}

module.exports = { handleBddScriptRoutes };
