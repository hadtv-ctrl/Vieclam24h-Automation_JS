const fs = require('fs');
const path = require('path');

class SummaryReporter {
  constructor(options = {}) {
    this.options = options;
    this.outputDir = options.outputFolder
      ? path.resolve(options.outputFolder)
      : path.resolve(process.cwd(), 'playwright-report', 'summary');
    this.stats = { total: 0, passed: 0, failed: 0, skipped: 0 };
  }

  onBegin() {
    fs.mkdirSync(this.outputDir, { recursive: true });
    this.stats = { total: 0, passed: 0, failed: 0, skipped: 0 };
  }

  onTestEnd(test, result = {}) {
    this.stats.total += 1;

    const status = result.status || 'passed';
    if (status === 'passed') {
      this.stats.passed += 1;
    } else if (status === 'failed') {
      this.stats.failed += 1;
    } else if (['skipped', 'timedOut', 'interrupted', 'pending'].includes(status)) {
      this.stats.skipped += 1;
    }
  }

  onEnd(result = {}) {
    const stats = result.stats || {};
    const total = Number(this.stats.total || stats.tests || 0);
    const passed = Number(this.stats.passed || stats.passed || 0);
    const failed = Number(this.stats.failed || stats.failed || 0);
    const skipped = Number(this.stats.skipped || stats.skipped || 0);
    const percent = total ? Math.round((passed / total) * 100) : 0;

    const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Test Summary</title>
    <style>
      :root {
        color-scheme: light;
        font-family: Arial, Helvetica, sans-serif;
      }
      body {
        margin: 0;
        background: #f5f7fb;
        color: #111827;
      }
      .container {
        max-width: 980px;
        margin: 32px auto;
        padding: 24px;
        background: white;
        border-radius: 16px;
        box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
      }
      h1 {
        margin-top: 0;
        margin-bottom: 8px;
      }
      .subtitle {
        color: #6b7280;
        margin-bottom: 24px;
      }
      .grid {
        display: grid;
        grid-template-columns: 1.1fr 0.9fr;
        gap: 24px;
        align-items: center;
      }
      .card {
        padding: 20px;
        border-radius: 14px;
        background: #f9fafb;
        border: 1px solid #e5e7eb;
      }
      .chart-wrap {
        display: flex;
        justify-content: center;
        align-items: center;
      }
      .chart {
        width: 220px;
        height: 220px;
        border-radius: 50%;
        background: conic-gradient(#16a34a 0 ${percent}%, #e5e7eb ${percent}% 100%);
        display: flex;
        justify-content: center;
        align-items: center;
        box-shadow: inset 0 0 0 16px white;
      }
      .chart span {
        font-size: 28px;
        font-weight: 700;
        color: #111827;
      }
      .stats {
        display: grid;
        gap: 12px;
        margin-top: 16px;
      }
      .stat-row {
        display: flex;
        justify-content: space-between;
        padding: 10px 12px;
        border-radius: 10px;
        background: white;
        border: 1px solid #e5e7eb;
      }
      .label {
        color: #6b7280;
      }
      .value {
        font-weight: 700;
      }
      .passed { color: #16a34a; }
      .failed { color: #dc2626; }
      .skipped { color: #f59e0b; }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>Test Suite Summary</h1>
      <div class="subtitle">Passed scripts vs total scripts</div>
      <div class="grid">
        <div class="chart-wrap">
          <div class="chart">
            <span>${percent}%</span>
          </div>
        </div>
        <div class="card">
          <div class="stats">
            <div class="stat-row"><span class="label">Total scripts</span><span class="value">${total}</span></div>
            <div class="stat-row"><span class="label">Passed</span><span class="value passed">${passed}</span></div>
            <div class="stat-row"><span class="label">Failed</span><span class="value failed">${failed}</span></div>
            <div class="stat-row"><span class="label">Skipped</span><span class="value skipped">${skipped}</span></div>
          </div>
        </div>
      </div>
    </div>
  </body>
</html>`;

    const summaryPath = path.join(this.outputDir, 'summary.html');
    fs.writeFileSync(summaryPath, html, 'utf8');
  }
}

module.exports = SummaryReporter;
