/**
 * scripts/measure-dashboard-baseline.js
 * Measures real baseline performance metrics for Plan 09 Phase 0:
 * - DOM element count at app-ready
 * - CSS transferred bytes & request count
 * - JS Heap memory size
 * - Captures 8 baseline screenshots (1920x1080, 1440x900, 1280x800, 390x844 x Light/Dark)
 */

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { startDashboardHarness } = require('../tests/dashboard/support/dashboardHarness');
const { createFixtureWorkspace } = require('../tests/dashboard/support/fixtureWorkspace');

async function measure() {
  console.log('=== Plan 09 Phase 0 Baseline Measurement ===');
  const baselineDir = path.resolve(__dirname, '../_Plan_implement/plan09-evidence/visual-baseline');
  if (!fs.existsSync(baselineDir)) {
    fs.mkdirSync(baselineDir, { recursive: true });
  }

  const fixture = createFixtureWorkspace();
  const harness = await startDashboardHarness(fixture.rootPath);
  console.log(`Harness started at: ${harness.url}`);

  const browser = await chromium.launch({ headless: true });
  const results = {
    timestamp: new Date().toISOString(),
    harnessUrl: harness.url,
    cssMetrics: { requests: 0, totalBytes: 0, files: [] },
    domMetrics: {},
    memoryMetrics: {},
    screenshots: [],
  };

  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

    // Track network CSS
    page.on('response', async (res) => {
      const url = res.url();
      if (url.includes('.css')) {
        try {
          const body = await res.body();
          results.cssMetrics.requests++;
          results.cssMetrics.totalBytes += body.length;
          results.cssMetrics.files.push({
            url: url.replace(harness.url, ''),
            status: res.status(),
            bytes: body.length,
          });
        } catch {
          // ignore stream responses
        }
      }
    });

    // 1. Initial Load & Metrics at 1920x1080 (Dark mode default)
    const startTime = Date.now();
    await page.goto(harness.url, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.shell');
    const loadTimeMs = Date.now() - startTime;

    // DOM Count
    const domCount = await page.evaluate(() => document.querySelectorAll('*').length);
    results.domMetrics.shellInitial = domCount;
    results.domMetrics.loadTimeMs = loadTimeMs;

    // Memory usage
    const memory = await page.evaluate(() => {
      if (window.performance && window.performance.memory) {
        return {
          usedJSHeapSize: window.performance.memory.usedJSHeapSize,
          totalJSHeapSize: window.performance.memory.totalJSHeapSize,
          jsHeapSizeLimit: window.performance.memory.jsHeapSizeLimit,
        };
      }
      return null;
    });
    results.memoryMetrics = memory || { note: 'performance.memory not exposed in this Chromium configuration' };

    console.log(`Initial DOM Elements: ${domCount}`);
    console.log(`Initial Load Time: ${loadTimeMs} ms`);
    console.log(`CSS Requests: ${results.cssMetrics.requests}, Total Bytes: ${results.cssMetrics.totalBytes}`);

    // 2. Capture 8 Viewport / Theme Baseline Screenshots
    const combinations = [
      { name: '1920x1080-dark', width: 1920, height: 1080, theme: 'dark' },
      { name: '1920x1080-light', width: 1920, height: 1080, theme: 'light' },
      { name: '1440x900-dark', width: 1440, height: 900, theme: 'dark' },
      { name: '1440x900-light', width: 1440, height: 900, theme: 'light' },
      { name: '1280x800-dark', width: 1280, height: 800, theme: 'dark' },
      { name: '1280x800-light', width: 1280, height: 800, theme: 'light' },
      { name: '390x844-dark', width: 390, height: 844, theme: 'dark' },
      { name: '390x844-light', width: 390, height: 844, theme: 'light' },
    ];

    for (const combo of combinations) {
      await page.setViewportSize({ width: combo.width, height: combo.height });
      await page.evaluate((theme) => {
        document.documentElement.setAttribute('data-theme', theme);
      }, combo.theme);
      await page.waitForTimeout(300); // Wait for transition/re-layout

      const screenshotPath = path.join(baselineDir, `${combo.name}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: false });
      results.screenshots.push({ combo: combo.name, path: screenshotPath });
      console.log(`Captured screenshot: ${combo.name}.png`);
    }

    // Write summary report
    const summaryFile = path.resolve(__dirname, '../_Plan_implement/plan09-evidence/baseline-measurement.json');
    fs.writeFileSync(summaryFile, JSON.stringify(results, null, 2), 'utf8');
    console.log(`Measurement saved to: ${summaryFile}`);

    return results;
  } finally {
    await browser.close();
    await harness.stop();
    fixture.cleanup();
  }
}

if (require.main === module) {
  measure().then(() => {
    console.log('Measurement completed successfully.');
    process.exit(0);
  }).catch((err) => {
    console.error('Measurement failed:', err);
    process.exit(1);
  });
}

module.exports = { measure };
