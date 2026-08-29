const fs = require('fs');
const path = require('path');

class WorkerHtmlReporter {
  constructor(options = {}) {
    this.outputDir = path.resolve(options.outputFolder || 'playwright-report/workers');
    this.runId = String(options.runId || process.env.QA_RUN_ID || 'run')
      .replace(/[^a-zA-Z0-9-_]+/g, '-');
    this.resultsByWorker = new Map();
  }

  onBegin() {
    this.resultsByWorker.clear();
  }

  onTestEnd(test, result = {}) {
    const parallelIndex = Number.isInteger(result.parallelIndex) ? result.parallelIndex : 0;
    if (!this.resultsByWorker.has(parallelIndex)) {
      this.resultsByWorker.set(parallelIndex, []);
    }

    this.resultsByWorker.get(parallelIndex).push({
      title: test.titlePath?.().join(' › ') || test.title,
      project: test.parent?.project()?.name || '',
      status: result.status || 'unknown',
      duration: result.duration || 0,
      error: result.error?.message || '',
    });
  }

  async onEnd() {
    await fs.promises.mkdir(this.outputDir, { recursive: true });

    for (const [parallelIndex, results] of this.resultsByWorker) {
      const workerDir = path.join(this.outputDir, `worker-${parallelIndex}`);
      await fs.promises.mkdir(workerDir, { recursive: true });
      await fs.promises.writeFile(
        path.join(workerDir, 'index.html'),
        this.render(parallelIndex, results),
        'utf8'
      );
    }
  }

  escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  render(parallelIndex, results) {
    const passed = results.filter((result) => result.status === 'passed').length;
    const rows = results.map((result) => `
      <tr>
        <td>${this.escapeHtml(result.title)}</td>
        <td>${this.escapeHtml(result.project)}</td>
        <td class="${this.escapeHtml(result.status)}">${this.escapeHtml(result.status)}</td>
        <td>${(result.duration / 1000).toFixed(2)}s</td>
        <td><pre>${this.escapeHtml(result.error)}</pre></td>
      </tr>`).join('');

    return `<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Worker ${parallelIndex} report</title>
  <style>
    body{font-family:Segoe UI,sans-serif;margin:32px;color:#172033;background:#f5f7fb}
    main{max-width:1200px;margin:auto;background:white;padding:24px;border-radius:12px;box-shadow:0 8px 30px #17203318}
    h1{margin:0 0 8px}.meta{color:#667085;margin-bottom:24px}table{width:100%;border-collapse:collapse}
    th,td{padding:12px;border-bottom:1px solid #e4e7ec;text-align:left;vertical-align:top}
    th{background:#f9fafb}.passed{color:#087443;font-weight:700}.failed,.timedOut{color:#b42318;font-weight:700}
    pre{white-space:pre-wrap;margin:0;font-family:Consolas,monospace;font-size:12px}
  </style>
</head>
<body><main>
  <h1>Worker ${parallelIndex} report</h1>
  <div class="meta">Run: ${this.escapeHtml(this.runId)} · Passed: ${passed}/${results.length}</div>
  <table><thead><tr><th>Test</th><th>Project</th><th>Status</th><th>Duration</th><th>Error</th></tr></thead>
  <tbody>${rows}</tbody></table>
</main></body></html>`;
  }
}

module.exports = WorkerHtmlReporter;
