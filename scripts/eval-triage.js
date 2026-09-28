/**
 * scripts/eval-triage.js
 * Evaluates Failure Triage accuracy on Synthetic (F6) and CarThings Real (F6a) datasets.
 * Target: Accuracy >= 80% for all suites.
 * Strict ceiling <= 150 lines.
 */
const fs = require('fs');
const path = require('path');
const { analyzeDiagnostics } = require('../core/diagnostics/diagnosticsAnalyzer');

function evaluateDataset(filePath, suiteName) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Dataset not found at ${filePath}`);
  }

  const dataset = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  let matched = 0;
  const results = [];

  for (const item of dataset) {
    const diag = analyzeDiagnostics({
      error: item.error,
      testTitle: item.testTitle
    });

    const isMatch = diag.topCategory === item.expectedCategory;
    if (isMatch) matched++;

    results.push({
      id: item.id,
      expected: item.expectedCategory,
      predicted: diag.topCategory,
      confidence: diag.findings[0]?.confidence || 0,
      pass: isMatch
    });
  }

  const accuracy = (matched / dataset.length) * 100;
  const passed = accuracy >= 80;

  console.log(`\n==================================================`);
  console.log(`TRIAGE EVALUATION REPORT: ${suiteName}`);
  console.log(`Total samples: ${dataset.length}`);
  console.log(`Matches: ${matched}/${dataset.length}`);
  console.log(`Accuracy: ${accuracy.toFixed(1)}% (Threshold >= 80%)`);
  console.log(`Verdict: ${passed ? 'PASSED (Green Gate)' : 'FAILED'}`);
  console.log(`==================================================`);

  return { passed, accuracy, matched, total: dataset.length, results };
}

function runEvaluation() {
  const baseDir = path.join(__dirname, '..', 'test-fixtures', 'ai-eval');
  const syntheticPath = path.join(baseDir, 'triage-dataset.json');
  const carthingsPath = path.join(baseDir, 'carthings-dataset.json');

  const synOutcome = evaluateDataset(syntheticPath, 'Synthetic Dataset (Plan-17b F6)');
  let ctOutcome = { passed: true };

  if (fs.existsSync(carthingsPath)) {
    ctOutcome = evaluateDataset(carthingsPath, 'CarThings Real Dataset (Plan-17 F6a)');
  }

  const allPassed = synOutcome.passed && ctOutcome.passed;
  return {
    passed: allPassed,
    synthetic: synOutcome,
    carthings: ctOutcome
  };
}

if (require.main === module) {
  try {
    const outcome = runEvaluation();
    process.exit(outcome.passed ? 0 : 1);
  } catch (err) {
    console.error('Eval error:', err);
    process.exit(1);
  }
}

module.exports = { runEvaluation, evaluateDataset };

