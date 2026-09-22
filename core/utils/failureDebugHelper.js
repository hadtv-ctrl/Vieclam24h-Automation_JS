const fs = require('fs');
const path = require('path');

const TRACKER_FILE = path.join(process.cwd(), 'evidence', 'reports', 'mobile_failure_tracker.json');
const ALERT_FILE = path.join(process.cwd(), 'evidence', 'reports', 'CONSECUTIVE_FAILURES_ALERT.md');
const SCRATCH_ALERT = path.join(process.cwd(), 'scratch', 'consecutive_failures_alert.json');
const HTML_DUMPS_DIR = path.join(process.cwd(), 'evidence', 'mobile_html_dumps');

/**
 * Dump page HTML to disk on failure and attach to testInfo
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').TestInfo} testInfo
 * @param {string} [stepName]
 * @returns {Promise<string|null>} Saved HTML file path or null
 */
async function dumpPageHtml(page, testInfo, stepName = 'failed_step') {
  if (!page) return null;
  try {
    const html = await page.content().catch(() => null);
    if (!html) return null;

    fs.mkdirSync(HTML_DUMPS_DIR, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const safeTitle = (testInfo?.title || 'test')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 60);
    const fileName = `${safeTitle}_attempt${testInfo?.retry || 0}_${stepName}_${timestamp}.html`;
    const dumpPath = path.join(HTML_DUMPS_DIR, fileName);

    fs.writeFileSync(dumpPath, html, 'utf8');

    if (testInfo && typeof testInfo.attach === 'function') {
      try {
        await testInfo.attach('failure_dom.html', {
          body: html,
          contentType: 'text/html',
        });
      } catch (attachErr) {
        // Attachment error should not break execution
      }
    }

    return dumpPath;
  } catch (err) {
    console.error(`[failureDebugHelper] Error dumping page HTML: ${err.message}`);
    return null;
  }
}

/**
 * Read current failure tracker
 */
function readFailureTracker() {
  try {
    if (fs.existsSync(TRACKER_FILE)) {
      const data = fs.readFileSync(TRACKER_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (e) {
    // If invalid JSON or corrupted, return fresh object
  }
  return {};
}

/**
 * Save updated failure tracker
 */
function saveFailureTracker(tracker) {
  try {
    const dir = path.dirname(TRACKER_FILE);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(TRACKER_FILE, JSON.stringify(tracker, null, 2), 'utf8');
  } catch (err) {
    console.error(`[failureDebugHelper] Error saving failure tracker: ${err.message}`);
  }
}

/**
 * Update alert report when any script reaches >= 3 consecutive failures
 */
function updateAlertReport(tracker) {
  try {
    const criticalEntries = Object.entries(tracker).filter(
      ([, item]) => item.consecutiveFailures >= 3
    );

    if (criticalEntries.length === 0) {
      // If alert files exist and all tests recovered, record clean state
      if (fs.existsSync(ALERT_FILE)) {
        fs.unlinkSync(ALERT_FILE);
      }
      if (fs.existsSync(SCRATCH_ALERT)) {
        fs.unlinkSync(SCRATCH_ALERT);
      }
      return;
    }

    // Write JSON scratch alert
    fs.mkdirSync(path.dirname(SCRATCH_ALERT), { recursive: true });
    fs.writeFileSync(
      SCRATCH_ALERT,
      JSON.stringify({ timestamp: new Date().toISOString(), alerts: criticalEntries }, null, 2),
      'utf8'
    );

    // Write Markdown report
    let md = `# CẢNH BÁO: Kịch bản kiểm thử Mobile thất bại 3 lần liên tiếp\n\n`;
    md += `> Thời gian phát hiện: **${new Date().toLocaleString('vi-VN')}**\n\n`;
    md += `| Script File | Số lần lỗi liên tiếp | Bước lỗi cuối | Chi tiết lỗi | File HTML Dump |\n`;
    md += `|-------------|-----------------------|---------------|--------------|----------------|\n`;

    for (const [scriptFile, data] of criticalEntries) {
      const dumpLink = data.lastHtmlDump
        ? `[HTML Dump](${path.relative(path.dirname(ALERT_FILE), data.lastHtmlDump).replace(/\\/g, '/')})`
        : 'N/A';
      const cleanError = (data.lastError || 'N/A').replace(/[\r\n]+/g, ' ').slice(0, 100);
      md += `| \`${scriptFile}\` | **${data.consecutiveFailures}** | ${data.lastFailedStep || 'N/A'} | ${cleanError}... | ${dumpLink} |\n`;
    }

    md += `\n### Hướng dẫn chẩn đoán và điều chỉnh:\n`;
    md += `1. Mở file HTML Dump tương ứng để kiểm tra mã nguồn DOM thực tế của trình duyệt Mobile.\n`;
    md += `2. So sánh selector của Page Object với các thuộc tính thẻ HTML, text, hoặc aria-label trên DOM mobile.\n`;
    md += `3. Kiểm tra xem có modal overlay (app install banner, consent, onboarding) đang che khuất phần tử hay không.\n`;

    fs.mkdirSync(path.dirname(ALERT_FILE), { recursive: true });
    fs.writeFileSync(ALERT_FILE, md, 'utf8');

    console.warn(`\n======================================================================`);
    console.warn(`⚠️ [DETECT ALERT] Có ${criticalEntries.length} script Mobile thất bại 3 lần liên tiếp!`);
    criticalEntries.forEach(([script, d]) => {
      console.warn(` - ${script}: ${d.consecutiveFailures} lần fail liên tiếp | Error: ${(d.lastError || '').slice(0, 80)}`);
    });
    console.warn(` Xem chi tiết tại: ${ALERT_FILE}`);
    console.warn(`======================================================================\n`);
  } catch (err) {
    console.error(`[failureDebugHelper] Error updating alert report: ${err.message}`);
  }
}

/**
 * Track test failure
 * @param {import('@playwright/test').TestInfo} testInfo
 * @param {Error|object} error
 * @param {string|null} htmlDumpPath
 */
async function trackTestFailure(testInfo, error, htmlDumpPath = null) {
  if (!testInfo || !testInfo.file) return;

  const scriptFile = path.basename(testInfo.file);
  const tracker = readFailureTracker();

  const prev = tracker[scriptFile] || {
    consecutiveFailures: 0,
    totalFailures: 0,
    history: [],
  };

  const newFailCount = prev.consecutiveFailures + 1;
  tracker[scriptFile] = {
    scriptFile,
    consecutiveFailures: newFailCount,
    totalFailures: (prev.totalFailures || 0) + 1,
    status: newFailCount >= 3 ? 'CRITICAL_3_FAILURES' : 'FAILING',
    lastError: error?.message || String(error || 'Unknown test error'),
    lastFailedStep: testInfo.title || 'Unknown Step',
    lastHtmlDump: htmlDumpPath,
    lastRunAt: new Date().toISOString(),
    history: [...(prev.history || []).slice(-9), 'failed'],
  };

  saveFailureTracker(tracker);
  updateAlertReport(tracker);
}

/**
 * Track test success (resets consecutive failures counter)
 * @param {import('@playwright/test').TestInfo} testInfo
 */
async function trackTestSuccess(testInfo) {
  if (!testInfo || !testInfo.file) return;

  const scriptFile = path.basename(testInfo.file);
  const tracker = readFailureTracker();

  const prev = tracker[scriptFile] || {
    consecutiveFailures: 0,
    totalFailures: 0,
    history: [],
  };

  tracker[scriptFile] = {
    scriptFile,
    consecutiveFailures: 0,
    totalFailures: prev.totalFailures || 0,
    status: 'HEALTHY',
    lastError: null,
    lastFailedStep: null,
    lastHtmlDump: null,
    lastRunAt: new Date().toISOString(),
    history: [...(prev.history || []).slice(-9), 'passed'],
  };

  saveFailureTracker(tracker);
  updateAlertReport(tracker);
}

module.exports = {
  dumpPageHtml,
  trackTestFailure,
  trackTestSuccess,
  readFailureTracker,
};
