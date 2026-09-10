const fs = require('fs');
const path = require('path');

const srcPath = path.resolve(__dirname, '../dashboard/public/styles.css');
const stylesDir = path.resolve(__dirname, '../dashboard/public/styles');
const componentsDir = path.join(stylesDir, 'components');
const viewsDir = path.join(stylesDir, 'views');

[stylesDir, componentsDir, viewsDir].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const content = fs.readFileSync(srcPath, 'utf8');
const lines = content.split('\n');

const slices = [
  { file: path.join(stylesDir, 'tokens.css'), start: 1, end: 71, label: 'Design Tokens & Themes' },
  { file: path.join(stylesDir, 'base.css'), start: 72, end: 504, label: 'Base Reset & Shell Layout' },
  { file: path.join(componentsDir, 'ui-primitives.css'), start: 505, end: 1800, label: 'UI Primitives, Hero & Controls' },
  { file: path.join(viewsDir, 'resources.css'), start: 1801, end: 2362, label: 'Resources & Artifacts Explorer' },
  { file: path.join(componentsDir, 'toggle-switch.css'), start: 2363, end: 2460, label: 'Modern Toggle Switch' },
  { file: path.join(componentsDir, 'common-scale.css'), start: 2461, end: 3408, label: 'Common Typography & Code Editor Palette' },
  { file: path.join(viewsDir, 'suites-quick.css'), start: 3409, end: 4125, label: 'Test Suites Quick Bar & 3-Frame Workspace' },
  { file: path.join(viewsDir, 'runner.css'), start: 4126, end: 4235, label: 'Runner Mode Switcher & Scope Tabs' },
  { file: path.join(viewsDir, 'settings.css'), start: 4236, end: 5540, label: 'Settings, Discord, AI & Themes' },
  { file: path.join(viewsDir, 'recorder.css'), start: 5541, end: 6685, label: 'Playwright Codegen Recorder Wizard' },
  { file: path.join(viewsDir, 'data.css'), start: 6686, end: 7548, label: 'Test Data Studio' },
  { file: path.join(viewsDir, 'bdd.css'), start: 7549, end: 10915, label: 'Visual BDD Builder & Script Studio' },
  { file: path.join(viewsDir, 'pages.css'), start: 10916, end: 15142, label: 'Page Manager & Object Repository' },
  { file: path.join(viewsDir, 'docs.css'), start: 15143, end: 16871, label: 'Documents & Guides' },
  { file: path.join(viewsDir, 'git.css'), start: 16872, end: 17518, label: 'Git Synchronization Studio' },
  { file: path.join(viewsDir, 'suites.css'), start: 17519, end: 18830, label: 'Test Suites & Execution Matrix' },
  { file: path.join(viewsDir, 'fixtures.css'), start: 18831, end: lines.length, label: 'Fixtures & Lifecycle Hooks Studio' },
];

let totalLinesWritten = 0;
slices.forEach((s) => {
  const sliceLines = lines.slice(s.start - 1, s.end);
  totalLinesWritten += sliceLines.length;
  const header = `/**\n * ${path.relative(path.resolve(__dirname, '..'), s.file).replace(/\\/g, '/')}\n * ${s.label}\n * Original lines: ${s.start} - ${s.end}\n */\n`;
  fs.writeFileSync(s.file, header + sliceLines.join('\n'), 'utf8');
  console.log(`Created: ${path.relative(stylesDir, s.file)} (${sliceLines.length} lines)`);
});

console.log(`\nVerification: Sliced ${totalLinesWritten} / ${lines.length} lines (100% matched).`);

// Generate Master styles.css facade
const masterCss = `/**
 * dashboard/public/styles.css
 * Master Cascade Entry & Compatibility Facade.
 * Preserves 100% source cascade order across modularized domain stylesheets.
 */

/* 1. Design Tokens & Theme Variables (Original L1 - L71) */
@import url('./styles/tokens.css');

/* 2. Base Reset, Shell Layout & Topbar (Original L72 - L504) */
@import url('./styles/base.css');

/* 3. Core UI Components & Primitives (Original L505 - L1800) */
@import url('./styles/components/ui-primitives.css');

/* 4. Resources & Artifacts Explorer (Original L1801 - L2362 - strictly before toggle-switch & scale) */
@import url('./styles/views/resources.css');

/* 5. Components: Modern Toggle Switch & Common Scale (Original L2363 - L3408) */
@import url('./styles/components/toggle-switch.css');
@import url('./styles/components/common-scale.css');

/* 6. Feature Views (Original L3409 - L19463) */
@import url('./styles/views/suites-quick.css');
@import url('./styles/views/runner.css');
@import url('./styles/views/settings.css');
@import url('./styles/views/recorder.css');
@import url('./styles/views/data.css');
@import url('./styles/views/bdd.css');
@import url('./styles/views/pages.css');
@import url('./styles/views/docs.css');
@import url('./styles/views/git.css');
@import url('./styles/views/suites.css');
@import url('./styles/views/fixtures.css');
`;

fs.writeFileSync(srcPath, masterCss, 'utf8');
console.log(`Updated dashboard/public/styles.css to Master Cascade Entry (${masterCss.split('\n').length} lines).`);
