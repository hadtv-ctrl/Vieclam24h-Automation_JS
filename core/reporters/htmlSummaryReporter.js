const fs = require('fs');
const path = require('path');

const DASHBOARD_START = '<!-- qa-summary-dashboard:start -->';
const DASHBOARD_END = '<!-- qa-summary-dashboard:end -->';

class HtmlSummaryReporter {
  constructor(options = {}) {
    this.outputDir = options.outputFolder
      ? path.resolve(options.outputFolder)
      : path.resolve(process.cwd(), 'playwright-report');
    this.results = new Map();
  }

  onBegin() {
    this.results.clear();
  }

  onTestEnd(test, result = {}) {
    const id = test.id || test.titlePath?.().join(' > ') || test.title;
    this.results.set(id, result.status || 'passed');
  }

  async onEnd() {
    const indexPath = path.join(this.outputDir, 'index.html');
    if (!fs.existsSync(indexPath)) {
      return;
    }

    const stats = this.buildStats();
    const dashboard = this.renderDashboard(stats);
    const html = fs.readFileSync(indexPath, 'utf8');
    const updatedHtml = this.injectDashboard(html, dashboard);

    fs.writeFileSync(indexPath, updatedHtml, 'utf8');
  }

  buildStats() {
    const stats = { total: 0, passed: 0, failed: 0, skipped: 0 };

    for (const status of this.results.values()) {
      stats.total += 1;
      if (status === 'passed') {
        stats.passed += 1;
      } else if (status === 'skipped') {
        stats.skipped += 1;
      } else {
        stats.failed += 1;
      }
    }

    stats.percent = stats.total ? Math.round((stats.passed / stats.total) * 100) : 0;
    return stats;
  }

  injectDashboard(html, dashboard) {
    const withoutExisting = html.replace(
      new RegExp(`${DASHBOARD_START}[\\s\\S]*?${DASHBOARD_END}\\s*`, 'm'),
      ''
    );

    if (withoutExisting.includes('<body>')) {
      return withoutExisting.replace('<body>', `<body>\n${dashboard}`);
    }

    return `${dashboard}\n${withoutExisting}`;
  }

  renderDashboard(stats) {
    return `${DASHBOARD_START}
<style>
  .qa-summary-dashboard {
    box-sizing: border-box;
    margin: 16px auto 0;
    max-width: 1180px;
    padding: 20px 24px;
    border: 1px solid #d8dee4;
    border-radius: 8px;
    background: #ffffff;
    color: #1f2328;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }
  .qa-summary-dashboard__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 18px;
  }
  .qa-summary-dashboard__title {
    margin: 0;
    font-size: 20px;
    font-weight: 700;
  }
  .qa-summary-dashboard__subtitle {
    margin: 4px 0 0;
    color: #656d76;
    font-size: 13px;
  }
  .qa-summary-dashboard__percent {
    width: 92px;
    height: 92px;
    flex: 0 0 auto;
    border-radius: 50%;
    background: conic-gradient(#1a7f37 0 ${stats.percent}%, #d0d7de ${stats.percent}% 100%);
    display: grid;
    place-items: center;
    box-shadow: inset 0 0 0 10px #ffffff;
    font-size: 22px;
    font-weight: 700;
  }
  .qa-summary-dashboard__grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(120px, 1fr));
    gap: 12px;
  }
  .qa-summary-dashboard__stat {
    border: 1px solid #d8dee4;
    border-radius: 8px;
    padding: 12px 14px;
    background: #f6f8fa;
  }
  .qa-summary-dashboard__label {
    display: block;
    margin-bottom: 6px;
    color: #656d76;
    font-size: 12px;
  }
  .qa-summary-dashboard__value {
    font-size: 24px;
    font-weight: 700;
  }
  .qa-summary-dashboard__value--passed { color: #1a7f37; }
  .qa-summary-dashboard__value--failed { color: #cf222e; }
  .qa-summary-dashboard__value--skipped { color: #9a6700; }
  @media (max-width: 720px) {
    .qa-summary-dashboard {
      margin: 12px;
      padding: 16px;
    }
    .qa-summary-dashboard__header {
      align-items: flex-start;
      flex-direction: column;
    }
    .qa-summary-dashboard__grid {
      grid-template-columns: repeat(2, minmax(120px, 1fr));
    }
  }
</style>
<section class="qa-summary-dashboard" aria-label="Test summary dashboard">
  <div class="qa-summary-dashboard__header">
    <div>
      <h1 class="qa-summary-dashboard__title">Test Suite Summary</h1>
      <p class="qa-summary-dashboard__subtitle">Passed scripts vs total scripts</p>
    </div>
    <div class="qa-summary-dashboard__percent">${stats.percent}%</div>
  </div>
  <div class="qa-summary-dashboard__grid">
    <div class="qa-summary-dashboard__stat">
      <span class="qa-summary-dashboard__label">Total scripts</span>
      <span class="qa-summary-dashboard__value">${stats.total}</span>
    </div>
    <div class="qa-summary-dashboard__stat">
      <span class="qa-summary-dashboard__label">Passed</span>
      <span class="qa-summary-dashboard__value qa-summary-dashboard__value--passed">${stats.passed}</span>
    </div>
    <div class="qa-summary-dashboard__stat">
      <span class="qa-summary-dashboard__label">Failed</span>
      <span class="qa-summary-dashboard__value qa-summary-dashboard__value--failed">${stats.failed}</span>
    </div>
    <div class="qa-summary-dashboard__stat">
      <span class="qa-summary-dashboard__label">Skipped</span>
      <span class="qa-summary-dashboard__value qa-summary-dashboard__value--skipped">${stats.skipped}</span>
    </div>
  </div>
</section>
${DASHBOARD_END}
`;
  }
}

module.exports = HtmlSummaryReporter;
