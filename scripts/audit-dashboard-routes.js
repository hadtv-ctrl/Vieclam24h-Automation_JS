/**
 * scripts/audit-dashboard-routes.js
 * Scans dashboard/server.js to extract all HTTP routes and API endpoints.
 */
const fs = require('fs');
const path = require('path');

const serverPath = path.resolve(__dirname, '../dashboard/server.js');
const content = fs.readFileSync(serverPath, 'utf8');
const lines = content.split('\n');

const endpoints = [];
const routePattern = /(?:if\s*\((?:.*?\s+)?request\.method\s*===?\s*['"]([A-Z]+)['"]\s*&&\s*(?:url\.)?pathname\s*([!=]==?|\.startsWith\()\s*['"]([^'"]+)['"]|(?:url\.)?pathname(?:\.startsWith\(\s*['"]([^'"]+)['"]|\s*===?\s*['"]([^'"]+)['"]))/;

lines.forEach((line, index) => {
  const trimmed = line.trim();
  if (trimmed.includes('/api/')) {
    // Check method
    let method = 'ALL';
    const methodMatch = trimmed.match(/request\.method\s*===?\s*['"]([A-Z]+)['"]/);
    if (methodMatch) {
      method = methodMatch[1];
    } else if (trimmed.includes("'POST'") || trimmed.includes('"POST"')) {
      method = 'POST';
    } else if (trimmed.includes("'GET'") || trimmed.includes('"GET"')) {
      method = 'GET';
    }

    // Check path
    const pathMatch = trimmed.match(/(?:pathname|url\.pathname)\s*(?:===?|\.startsWith\()\s*['"]([^'"]+)['"]/);
    if (pathMatch) {
      const endpointPath = pathMatch[1];
      let type = 'JSON';
      if (endpointPath.includes('stream') || endpointPath.includes('logs') || endpointPath.includes('events')) {
        type = 'SSE/Stream';
      } else if (endpointPath.includes('run') || endpointPath.includes('recorder') || endpointPath.includes('codegen')) {
        type = 'Subprocess';
      }

      // Group classification
      let group = 'system';
      if (endpointPath.startsWith('/api/git')) group = 'git';
      else if (endpointPath.startsWith('/api/agent')) group = 'agent';
      else if (endpointPath.startsWith('/api/discord')) group = 'discord';
      else if (endpointPath.startsWith('/api/builder') || endpointPath.includes('builder')) group = 'bdd';
      else if (endpointPath.startsWith('/api/object-repository') || endpointPath.includes('pages')) group = 'pages';
      else if (endpointPath.startsWith('/api/data') || endpointPath.includes('dataset')) group = 'data';
      else if (endpointPath.startsWith('/api/fixtures')) group = 'fixtures';
      else if (endpointPath.startsWith('/api/suites')) group = 'suites';
      else if (endpointPath.startsWith('/api/recorder')) group = 'recorder';
      else if (endpointPath.startsWith('/api/run') || endpointPath.includes('specs') || endpointPath.includes('test-results')) group = 'runner';

      endpoints.push({
        line: index + 1,
        method,
        path: endpointPath,
        group,
        type
      });
    }
  }
});

// Deduplicate endpoints by method + path
const seen = new Set();
const uniqueEndpoints = [];
endpoints.forEach(ep => {
  const key = `${ep.method} ${ep.path}`;
  if (!seen.has(key)) {
    seen.add(key);
    uniqueEndpoints.push(ep);
  }
});

console.log(`Scanned dashboard/server.js: Found ${uniqueEndpoints.length} unique endpoints across ${lines.length} lines.`);
if (process.argv.includes('--json')) {
  console.log(JSON.stringify(uniqueEndpoints, null, 2));
} else {
  console.table(uniqueEndpoints.map(e => ({ Method: e.Method, Path: e.path, Group: e.group, Type: e.type, Line: e.line })));
}

module.exports = { uniqueEndpoints };
