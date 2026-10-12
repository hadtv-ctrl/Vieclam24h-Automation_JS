/**
 * core/generator/visualScriptScanner.js
 * Scans and caches project test scripts across desktop, mobile-web, api, setup dirs.
 * Budget <= 120 lines.
 */
const fs = require('fs');
const path = require('path');
const { getFixturePageMap, parseExistingSpecFile } = require('./visualSpecParser');

let _scannedScriptsCache = null;
let _scannedScriptsCacheTime = 0;
let _scannedScriptsCacheRoot = '';
const CACHE_TTL_MS = 60000;

function invalidateScriptCache() {
  _scannedScriptsCache = null;
  _scannedScriptsCacheTime = 0;
  _scannedScriptsCacheRoot = '';
}

function scanAllProjectScripts(rootDir = process.cwd(), forceRefresh = false) {
  const normRoot = path.resolve(rootDir).toLowerCase();
  const now = Date.now();
  if (!forceRefresh && _scannedScriptsCache && _scannedScriptsCacheRoot === normRoot && (now - _scannedScriptsCacheTime < CACHE_TTL_MS)) {
    return _scannedScriptsCache;
  }

  const scripts = [];
  const dirsToScan = [
    { dir: 'tests/e2e/desktop', platform: 'desktop' },
    { dir: 'tests/e2e/mobile-web', platform: 'mobile-web' },
    { dir: 'tests/api', platform: 'api' },
    { dir: 'tests/setup', platform: 'setup' },
  ];

  const fixturePageMap = getFixturePageMap(rootDir);

  for (const item of dirsToScan) {
    const fullDir = path.join(rootDir, item.dir);
    if (fs.existsSync(fullDir)) {
      const files = fs.readdirSync(fullDir).filter((f) => f.endsWith('.spec.js') || f.endsWith('.setup.js') || f.endsWith('.js'));
      for (const file of files) {
        try {
          const relPath = path.join(item.dir, file).replace(/\\/g, '/');
          const parsed = parseExistingSpecFile(relPath, rootDir, fixturePageMap);
          scripts.push({
            id: path.basename(file, '.spec.js').replace(/\.setup$/, '').replace(/\.js$/, ''),
            fileName: file,
            relativePath: relPath,
            featureName: parsed.featureName,
            scenarioName: parsed.scenarioName,
            platform: item.platform,
            tags: parsed.tags,
            dataFiles: parsed.dataFiles,
            primaryDataFile: parsed.primaryDataFile,
            pages: parsed.pages,
            pageCount: parsed.pages.length,
            stepCount: parsed.steps.length,
            steps: parsed.steps,
            specCode: parsed.specCode,
          });
        } catch (err) {
          console.error(`Error parsing script ${file}:`, err.message);
        }
      }
    }
  }

  _scannedScriptsCache = scripts;
  _scannedScriptsCacheTime = now;
  _scannedScriptsCacheRoot = normRoot;
  return scripts;
}

module.exports = {
  scanAllProjectScripts,
  invalidateScriptCache,
};
