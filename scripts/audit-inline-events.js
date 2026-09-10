/**
 * scripts/audit-inline-events.js
 * Scans dashboard/public/index.html to extract all views and inline event handlers.
 */
const fs = require('fs');
const path = require('path');

const htmlPath = path.resolve(__dirname, '../dashboard/public/index.html');
const content = fs.readFileSync(htmlPath, 'utf8');
const lines = content.split('\n');

// 1. Scan all data-view attributes
const viewMatches = [];
const viewRegex = /data-view=["']([^"']+)["']/g;
let match;
while ((match = viewRegex.exec(content)) !== null) {
  viewMatches.push(match[1]);
}
const uniqueViews = Array.from(new Set(viewMatches));

// 2. Scan all inline event handlers (onclick, onchange, onsubmit, oninput, onkeydown, onkeyup)
const eventRegex = /\s(on[a-z]+)=["']([^"']+)["']/gi;
const inlineEvents = [];
let eventMatch;

lines.forEach((line, index) => {
  let lineMatch;
  const lineEventRegex = /\s(on[a-z]+)=["']([^"']+)["']/gi;
  while ((lineMatch = lineEventRegex.exec(line)) !== null) {
    const eventType = lineMatch[1].toLowerCase();
    const handlerCode = lineMatch[2].trim();
    // extract function name if like fnName(args)
    const fnMatch = handlerCode.match(/^([a-zA-Z0-9_$]+)\s*\(/);
    const functionName = fnMatch ? fnMatch[1] : handlerCode;

    inlineEvents.push({
      line: index + 1,
      eventType,
      handlerCode,
      functionName
    });
  }
});

// Deduplicate functions
const uniqueFunctions = Array.from(new Set(inlineEvents.map(e => e.functionName)));

console.log(`Scanned dashboard/public/index.html (${lines.length} lines):`);
console.log(`- Unique Views (data-view): ${uniqueViews.length} views: ${uniqueViews.join(', ')}`);
console.log(`- Total inline event occurrences: ${inlineEvents.length}`);
console.log(`- Unique inline action functions to bind to WindowBridge: ${uniqueFunctions.length}`);

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ views: uniqueViews, functions: uniqueFunctions, events: inlineEvents }, null, 2));
}

module.exports = { uniqueViews, uniqueFunctions, inlineEvents };
