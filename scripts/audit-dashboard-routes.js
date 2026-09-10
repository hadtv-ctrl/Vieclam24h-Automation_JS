/**
 * scripts/audit-dashboard-routes.js
 * Scans dashboard/server.js and dashboard/routes to extract all HTTP routes and API endpoints.
 */
const fs = require('fs');
const path = require('path');

const dashboardDir = path.resolve(__dirname, '../dashboard');
const routesDir = path.join(dashboardDir, 'routes');

function scanFileRoutes(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const fileEndpoints = [];

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (trimmed.includes('/api/') || trimmed.includes('/report')) {
      let method = 'ALL';
      const methodMatch = trimmed.match(/request\.method\s*===?\s*['"]([A-Z]+)['"]/);
      if (methodMatch) method = methodMatch[1];
      else if (trimmed.includes("'POST'") || trimmed.includes('"POST"')) method = 'POST';
      else if (trimmed.includes("'GET'") || trimmed.includes('"GET"')) method = 'GET';
      else if (trimmed.includes("'PUT'") || trimmed.includes('"PUT"')) method = 'PUT';
      else if (trimmed.includes("'DELETE'") || trimmed.includes('"DELETE"')) method = 'DELETE';

      const pathMatch = trimmed.match(/(?:pathname|url\.pathname)\s*(?:===?|\.startsWith\()\s*['"]([^'"]+)['"]/);
      if (pathMatch) {
        const endpointPath = pathMatch[1];
        let type = 'JSON';
        if (endpointPath.includes('stream') || endpointPath.includes('logs') || endpointPath.includes('events')) {
          type = 'SSE/Stream';
        } else if (endpointPath.includes('run') || endpointPath.includes('recorder') || endpointPath.includes('codegen')) {
          type = 'Subprocess';
        }

        let group = 'system';
        if (endpointPath.startsWith('/api/git')) group = 'git';
        else if (endpointPath.startsWith('/api/agent')) group = 'agent';
        else if (endpointPath.startsWith('/api/discord')) group = 'discord';
        else if (endpointPath.startsWith('/api/ai')) group = 'ai';
        else if (endpointPath.startsWith('/api/builder') || endpointPath.includes('builder') || endpointPath.startsWith('/api/drafts')) group = 'bdd';
        else if (endpointPath.startsWith('/api/object-repository') || endpointPath.includes('pages')) group = 'pages';
        else if (endpointPath.startsWith('/api/data') || endpointPath.includes('dataset')) group = 'data';
        else if (endpointPath.startsWith('/api/fixtures')) group = 'fixtures';
        else if (endpointPath.startsWith('/api/recorder')) group = 'recorder';
        else if (endpointPath.startsWith('/api/run') || endpointPath.startsWith('/api/stop') || endpointPath.startsWith('/api/state') || endpointPath.startsWith('/api/events')) group = 'runner';
        else if (endpointPath.startsWith('/api/resource') || endpointPath.startsWith('/api/code') || endpointPath.startsWith('/report')) group = 'resources';

        fileEndpoints.push({
          file: path.relative(dashboardDir, filePath).replace(/\\/g, '/'),
          line: index + 1,
          method,
          path: endpointPath,
          group,
          type,
        });
      }
    }
  });

  return fileEndpoints;
}

function collectJsFiles(dir) {
  const files = [];
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...collectJsFiles(full));
    else if (entry.isFile() && entry.name.endsWith('.js')) files.push(full);
  }
  return files;
}

const allFiles = [
  path.join(dashboardDir, 'server.js'),
  ...collectJsFiles(routesDir),
];

const allEndpoints = [];
allFiles.forEach((file) => {
  allEndpoints.push(...scanFileRoutes(file));
});

// Deduplicate
const uniqueMap = new Map();
allEndpoints.forEach((ep) => {
  const key = `${ep.method}:${ep.path}`;
  if (!uniqueMap.has(key)) uniqueMap.set(key, ep);
});
const uniqueEndpoints = Array.from(uniqueMap.values());

console.log(`Audited Dashboard Routes: Scanned ${allFiles.length} files, found ${uniqueEndpoints.length} unique API endpoints.`);
console.table(uniqueEndpoints.map((e) => ({
  Method: e.Method || e.method,
  Path: e.path,
  Group: e.group,
  File: e.file,
})));
