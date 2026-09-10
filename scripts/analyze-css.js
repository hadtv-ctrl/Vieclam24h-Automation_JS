const fs = require('fs');
const content = fs.readFileSync('dashboard/public/styles.css', 'utf8');
const lines = content.split('\n');

const viewIds = [
  'runner-view', 'builder-view', 'page-manager-view', 'data-view',
  'resources-view', 'docs-view', 'agent-view', 'settings-view',
  'git-view', 'suites-view', 'fixtures-view', 'recorder-view'
];

const found = {};
viewIds.forEach((id) => {
  found[id] = [];
});

lines.forEach((line, index) => {
  viewIds.forEach((id) => {
    if (line.includes(id)) {
      found[id].push(index + 1);
    }
  });
});

for (const [id, matches] of Object.entries(found)) {
  console.log(`${id}: ${matches.length} matches (first: ${matches[0]}, last: ${matches[matches.length - 1]})`);
}
