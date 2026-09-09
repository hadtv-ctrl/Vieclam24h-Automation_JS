const fs = require('fs');
const path = require('path');
const http = require('http');

// Opt-in local server; production fixtures and external sample URLs stay unchanged.
function withMockSample(base) {
  return base.extend({
    mockSampleUrl: [async ({}, use) => {
      const html = fs.readFileSync(path.resolve(__dirname, '../../data/mock/sample.html'));
      const server = http.createServer((request, response) => {
        if (request.url !== '/') {
          response.writeHead(404);
          response.end('Not found');
          return;
        }
        response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        response.end(html);
      });
      await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', resolve);
      });
      try {
        await use(`http://127.0.0.1:${server.address().port}/`);
      } finally {
        await new Promise((resolve, reject) => {
          server.close((error) => error ? reject(error) : resolve());
          server.closeAllConnections();
        });
      }
    }, { scope: 'worker' }],
  });
}

module.exports = { withMockSample };
