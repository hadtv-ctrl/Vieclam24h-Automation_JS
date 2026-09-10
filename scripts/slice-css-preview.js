const fs = require('fs');

const raw = fs.readFileSync('dashboard/public/styles.css', 'utf8');
const lines = raw.split('\n');
console.log('Total original lines:', lines.length);

// Let's inspect boundaries
// Tokens: 1 to 71
// Base: 72 to 350
// Primitives/Runner: 351 to 3408
// Suites Quick/Workspace v1: 3409 to 4125
// Runner Segmented: 4126 to 4235
// Settings View: 4236 to 5540
// Recorder View: 5541 to 6685
// Data Studio View: 6686 to 7548
// Visual BDD & Script Studio View: 7549 to 10915
// Page Manager & Object Repository View: 10916 to 15142
// Docs & Guides View: 15143 to 16871
// Git View: 16872 to 17518
// Suites Studio View: 17519 to 18830
// Fixtures View: 18831 to 19463

const slices = [
  { name: 'tokens', start: 1, end: 71 },
  { name: 'base', start: 72, end: 350 },
  { name: 'primitives_and_runner', start: 351, end: 3408 },
  { name: 'suites_v1', start: 3409, end: 4125 },
  { name: 'runner_segmented', start: 4126, end: 4235 },
  { name: 'settings_view', start: 4236, end: 5540 },
  { name: 'recorder_view', start: 5541, end: 6685 },
  { name: 'data_view', start: 6686, end: 7548 },
  { name: 'bdd_view', start: 7549, end: 10915 },
  { name: 'pages_view', start: 10916, end: 15142 },
  { name: 'docs_view', start: 15143, end: 16871 },
  { name: 'git_view', start: 16872, end: 17518 },
  { name: 'suites_view', start: 17519, end: 18830 },
  { name: 'fixtures_view', start: 18831, end: lines.length },
];

let totalSliced = 0;
slices.forEach((s) => {
  const count = s.end - s.start + 1;
  totalSliced += count;
  console.log(`${s.name}: lines ${s.start} -> ${s.end} (${count} lines)`);
});
console.log('Total sliced lines:', totalSliced);
