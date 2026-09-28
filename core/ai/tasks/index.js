/**
 * core/ai/tasks/index.js
 * Central entrypoint for the QA assistant tasks (F9). Every task exported here is deterministic
 * (0 token, no AI call); AI-backed work lives in agentService and the QA services' opt-in modes.
 * Strict ceiling <= 150 lines.
 */
const { runTriageFailure, heuristicTriage } = require('./triageFailure');
const { parseJiraMarkupToMarkdown, extractJiraKey } = require('./jiraStoryParser');
const { runCheckRequirementClarity, heuristicCheckClarity, detectHeuristicAmbiguities } = require('./checkRequirementClarity');
const { runDraftBugReport, heuristicBugReport } = require('./draftBugReport');
const { runGenerateTestCases, buildRuleTestCases } = require('./generateTestCases');
const { buildHeuristicTestCases } = require('./heuristicTestCases');
const { runSuggestLocator } = require('./suggestLocator');
const { runReviewSpec, staticSpecReview } = require('./reviewSpec');
const { runAnalyzeTestImpact } = require('./analyzeTestImpact');
const { runGenerateReleaseBriefing } = require('./generateReleaseBriefing');
const { runAnalyzeRequirementChange } = require('./analyzeRequirementChange');
const { runGeneratePlaywrightSpec, validateScriptSyntax, buildRuleSpec } = require('./generatePlaywrightSpec');
const { runDraftDecisionRecord } = require('./draftDecisionRecord');
const { formatForJira } = require('./copyForJira');
const { runDetectFlakyTests } = require('./detectFlakyTests');
const { runSummarizeCiRun } = require('./summarizeCiRun');

module.exports = {
  runTriageFailure,
  heuristicTriage,
  parseJiraMarkupToMarkdown,
  extractJiraKey,
  runCheckRequirementClarity,
  heuristicCheckClarity,
  detectHeuristicAmbiguities,
  runDraftBugReport,
  heuristicBugReport,
  runGenerateTestCases,
  buildRuleTestCases,
  buildHeuristicTestCases,
  runSuggestLocator,
  runReviewSpec,
  staticSpecReview,
  runAnalyzeTestImpact,
  runGenerateReleaseBriefing,
  runAnalyzeRequirementChange,
  runGeneratePlaywrightSpec,
  validateScriptSyntax,
  buildRuleSpec,
  runDraftDecisionRecord,
  formatForJira,
  runDetectFlakyTests,
  runSummarizeCiRun
};
