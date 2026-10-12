/**
 * core/generator/visualFixtureMap.js
 * Scans page objects and maps fixtures to Page classes. Budget <= 60 lines.
 */
const fs = require('fs');
const path = require('path');

const FIXTURE_PAGE_MAP = {
  samplePage: { name: 'SamplePage.js', relativePath: 'pages/desktop/SamplePage.js', className: 'SamplePage' },
  sampleMobilePage: { name: 'SampleMobilePage.js', relativePath: 'pages/mobile/SampleMobilePage.js', className: 'SampleMobilePage' },
};

function getFixturePageMap(rootDir = process.cwd()) {
  const map = { ...FIXTURE_PAGE_MAP };
  const scanDirs = [
    { dir: 'pages/desktop', platform: 'desktop' },
    { dir: 'pages/mobile', platform: 'mobile' },
    { dir: 'pages/mobile-web', platform: 'mobile-web' },
    { dir: 'pages', platform: 'base' },
  ];
  for (const item of scanDirs) {
    const fullDir = path.join(rootDir, item.dir);
    if (fs.existsSync(fullDir)) {
      const files = fs.readdirSync(fullDir).filter((f) => f.endsWith('.js'));
      for (const file of files) {
        const base = path.basename(file, '.js');
        const fix = base.charAt(0).toLowerCase() + base.slice(1);
        const shortAlias = fix.endsWith('Page') ? fix.slice(0, -4) : fix;
        const pageEntry = {
          name: file,
          relativePath: `${item.dir}/${file}`.replace(/\\/g, '/'),
          className: base,
        };
        if (!map[fix]) map[fix] = pageEntry;
        if (shortAlias && !map[shortAlias]) map[shortAlias] = pageEntry;
      }
    }
  }
  return map;
}

module.exports = {
  FIXTURE_PAGE_MAP,
  getFixturePageMap,
};
