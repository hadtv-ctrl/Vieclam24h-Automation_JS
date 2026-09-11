/**
 * dashboard/routes/recorderRoutes.js
 * Handles all /api/recorder/* endpoints for Playwright Codegen recording.
 */
const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');
const { sendJson, parseBody } = require('./routeUtils');
const { getDashboardConfig } = require('../../core/config/dashboardConfig');
const { parsePlaywrightScript, scanPages } = require('../../core/generator/recordParser');
const { transformToPomAndSpec } = require('../../core/generator/recordTransformer');
const { saveDraftFiles } = require('../../core/generator/recordWriter');
const {
  isProcessAlive,
  killRecorderProcess,
  normalizeTargetUrl,
  ensureRecordingsDir,
  listRecentRecordings
} = require('../services/recorderService');
const { createBackup } = require('../services/resourceService');
const { publish } = require('../services/runnerService');

let activeRecorder = null;
let isStarting = false;

async function handleRecorderRoutes(request, response, url, context = {}) {
  if (!url.pathname.startsWith('/api/recorder/')) return false;
  const root = context.root || process.env.QA_PROJECT_ROOT || process.cwd();
  const recordingsDir = ensureRecordingsDir(root);

  if (request.method === 'POST' && url.pathname === '/api/recorder/start') {
    if (isStarting) {
      return sendJson(response, 409, { error: 'Tiến trình ghi đang được khởi động, vui lòng đợi.' });
    }
    isStarting = true;
    try {
      const body = await parseBody(request);
      const activeConfig = getDashboardConfig();
      const defaultEnvKey = activeConfig.runtime?.defaultEnvironment || 'qc';
      const fallbackUrl = activeConfig.environments?.[defaultEnvKey]?.baseURL || 'https://example.com';
      const targetUrl = normalizeTargetUrl(body.url, fallbackUrl);
      const platform = body.platform === 'mobile-web' ? 'mobile-web' : 'desktop';
      const fileName = `rec_${Date.now()}.js`;
      const outputPath = path.join(recordingsDir, fileName);

      if (activeRecorder) {
        if (!isProcessAlive(activeRecorder.child?.pid)) {
          activeRecorder = null;
        } else if (body.force !== false) {
          killRecorderProcess(activeRecorder);
          activeRecorder = null;
          await new Promise((r) => setTimeout(r, 300));
        } else {
          return sendJson(response, 409, { error: 'Đang có một phiên ghi UI đang chạy.' });
        }
      }

      const playwrightCli = require.resolve('@playwright/test/cli');
      const args = [playwrightCli, 'codegen', targetUrl, '--target=playwright-test', `--output=${outputPath}`];
      if (body.browser && ['chromium', 'firefox', 'webkit'].includes(body.browser)) {
        args.push(`--browser=${body.browser}`);
      } else if (body.browser === 'chrome') {
        args.push('--channel=chrome');
      }
      if (body.device) args.push(`--device=${body.device}`);
      else if (body.viewport) args.push(`--viewport-size=${body.viewport}`);

      const child = spawn(process.execPath, args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env }, shell: false, windowsHide: true });
      let stderrBuffer = '';
      let earlyExitCode = null;

      // Gán activeRecorder ngay lập tức để bất kỳ request/tín hiệu hủy nào cũng nhận diện được child process
      activeRecorder = { child, url: targetUrl, platform, fileName, outputPath, startTime: new Date().toISOString() };

      child.stderr?.on('data', (chunk) => { stderrBuffer = (stderrBuffer + chunk.toString()).slice(-4000); });
      child.on('exit', (code) => {
        earlyExitCode = code;
        const finished = activeRecorder;
        if (activeRecorder?.child === child) activeRecorder = null;
        publish('recorder_status', { isRecording: false, code, fileName: finished?.fileName, recentRecordings: listRecentRecordings(root).slice(0, 15) });
      });

      await new Promise((resolve) => setTimeout(resolve, 600));
      if (earlyExitCode !== null) {
        if (activeRecorder?.child === child) activeRecorder = null;
        return sendJson(response, 500, { error: `Không thể mở Playwright Codegen: tiến trình đã thoát sớm (mã thoát: ${earlyExitCode}). ${stderrBuffer.trim()}` });
      }

      publish('recorder_status', { isRecording: true, url: targetUrl, platform, fileName, startTime: activeRecorder.startTime });
      return sendJson(response, 200, { message: 'Đã khởi chạy Playwright Codegen.', fileName, url: targetUrl });
    } catch (err) {
      return sendJson(response, 400, { error: err.message });
    } finally {
      isStarting = false;
    }
  }

  if (request.method === 'POST' && url.pathname === '/api/recorder/stop') {
    if (!activeRecorder) return sendJson(response, 400, { error: 'Không có phiên ghi nào đang chạy.' });
    const current = activeRecorder;
    killRecorderProcess(current);
    activeRecorder = null;
    publish('recorder_status', { isRecording: false, fileName: current.fileName, recentRecordings: listRecentRecordings(root).slice(0, 15) });

    await new Promise((r) => setTimeout(r, 400));
    const rawScript = fs.existsSync(current.outputPath) ? fs.readFileSync(current.outputPath, 'utf8') : '';
    const parsed = parsePlaywrightScript(rawScript);
    return sendJson(response, 200, { message: 'Đã dừng phiên ghi.', fileName: current.fileName, rawScript, actionsCount: parsed.actionsCount, actions: parsed.actions });
  }

  if (request.method === 'POST' && url.pathname === '/api/recorder/reset') {
    if (activeRecorder) { killRecorderProcess(activeRecorder); activeRecorder = null; }
    publish('recorder_status', { isRecording: false, recentRecordings: listRecentRecordings(root).slice(0, 15) });
    return sendJson(response, 200, { message: 'Đã thiết lập lại trạng thái phiên ghi.' });
  }

  if (request.method === 'GET' && (url.pathname === '/api/recorder/status' || url.pathname === '/api/recorder/state')) {
    if (activeRecorder && !isProcessAlive(activeRecorder.child?.pid)) activeRecorder = null;
    return sendJson(response, 200, { isRecording: Boolean(activeRecorder), activeRecorder: activeRecorder ? { url: activeRecorder.url, platform: activeRecorder.platform } : null, recentRecordings: listRecentRecordings(root).slice(0, 15) });
  }

  if (request.method === 'GET' && (url.pathname === '/api/recorder/file' || url.pathname === '/api/recorder/output')) {
    const fileName = path.basename(url.searchParams.get('name') || url.searchParams.get('file') || '');
    const filePath = path.join(recordingsDir, fileName);
    if (!fileName.endsWith('.js') || !fs.existsSync(filePath)) return sendJson(response, 404, { error: 'Không tìm thấy file record.' });
    const rawScript = fs.readFileSync(filePath, 'utf8');
    const parsed = parsePlaywrightScript(rawScript);
    return sendJson(response, 200, { fileName, rawScript, actionsCount: parsed.actionsCount, actions: parsed.actions });
  }

  if ((request.method === 'POST' || request.method === 'DELETE') && url.pathname === '/api/recorder/delete') {
    try {
      const body = request.method === 'POST' ? await parseBody(request) : {};
      const fileName = path.basename(body.fileName || url.searchParams.get('name') || url.searchParams.get('file') || '');
      const filePath = path.join(recordingsDir, fileName);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      return sendJson(response, 200, { message: `Đã xóa bản ghi ${fileName}.`, recentRecordings: listRecentRecordings(root).slice(0, 15) });
    } catch (err) {
      return sendJson(response, 400, { error: err.message });
    }
  }

  if (request.method === 'POST' && url.pathname === '/api/recorder/clear') {
    try {
      fs.readdirSync(recordingsDir).filter((f) => f.endsWith('.js')).forEach((f) => {
        try { fs.unlinkSync(path.join(recordingsDir, f)); } catch (_) {}
      });
      return sendJson(response, 200, { message: 'Đã dọn dẹp bản ghi lịch sử.', recentRecordings: [] });
    } catch (err) {
      return sendJson(response, 400, { error: err.message });
    }
  }

  if (request.method === 'POST' && url.pathname === '/api/recorder/scan-pages') {
    try {
      const body = await parseBody(request);
      const platform = body.platform === 'mobile-web' ? 'mobile-web' : 'desktop';
      return sendJson(response, 200, { platform, pages: scanPages(platform, root) });
    } catch (err) {
      return sendJson(response, 400, { error: err.message });
    }
  }

  if (request.method === 'POST' && (url.pathname === '/api/recorder/convert' || url.pathname === '/api/recorder/generate-draft')) {
    try {
      const body = await parseBody(request);
      const platform = body.platform === 'mobile-web' ? 'mobile-web' : 'desktop';
      const parsed = parsePlaywrightScript(String(body.rawScript || ''));
      const result = transformToPomAndSpec({
        platform,
        actions: body.actions || parsed.actions,
        isNewPage: body.isNewPage !== false,
        pageClassName: body.pageClassName || 'CustomPage',
        baseClass: 'BasePage',
        methodName: body.methodName || 'performRecordedActions',
        featureName: body.featureName || 'Recorded Feature',
        testName: body.testName || 'Recorded Scenario',
        includeEvidence: body.includeEvidence !== false,
        url: parsed.detectedUrl || parsed.url || '',
      });
      return sendJson(response, 200, result);
    } catch (err) {
      return sendJson(response, 400, { error: err.message });
    }
  }

  if (request.method === 'POST' && (url.pathname === '/api/recorder/save-draft' || url.pathname === '/api/recorder/save')) {
    try {
      const body = await parseBody(request);
      const saveResult = saveDraftFiles({ ROOT: root, pomFile: body.pomFile, specFile: body.specFile, createBackupFn: createBackup, execSyncFn: execSync });
      return sendJson(response, 200, saveResult);
    } catch (err) {
      return sendJson(response, 400, { error: err.message });
    }
  }

  return false;
}

function stopRecorderSession() {
  if (activeRecorder) {
    killRecorderProcess(activeRecorder);
    activeRecorder = null;
  }
}

function getActiveRecorder() {
  return activeRecorder;
}

module.exports = { handleRecorderRoutes, stopRecorderSession, getActiveRecorder };
