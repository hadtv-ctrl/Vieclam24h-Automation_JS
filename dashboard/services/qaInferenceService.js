'use strict';

/**
 * dashboard/services/qaInferenceService.js
 * Orchestrator điều phối suy luận kiểm thử QA (Heuristic vs AI) và trích xuất Scaffold.
 * Tuân thủ chuẩn Modular Decomposition (PLAN-07).
 */

const fs = require('fs');
const path = require('path');

const {
  RE_REQ,
  RE_AC,
  RE_TC,
  extractAcs,
  extractDecidedQuestions,
  findTestCaseFile,
  getNextTcId,
  collectAllExistingTcIds,
  slugify,
  inferDomainFromText,
} = require('./qa/markdownRequirementParser');

const { inferWithHeuristic } = require('./qa/heuristicInferenceEngine');
const { inferWithAi, extractWithAi } = require('./qa/semanticAiInferenceEngine');
const {
  detectIsTestScript,
  parseTestBlocksFromScript,
  extractHeuristicFromTestScript,
  extractHeuristicFromSpecText,
} = require('./qa/scaffoldScriptParser');
const {
  buildTestCaseDocument,
  appendTestCasesToDocument,
} = require('./qa/documentUpdater');
const {
  synthesizeScaffoldContents,
  formatScaffoldResult,
} = require('./qa/scaffoldSynthesizer');

async function inferTestCases({ root, reqPath, mode = 'heuristic', clientConfig = null }) {
  const absReqPath = path.resolve(root, reqPath);
  if (!fs.existsSync(absReqPath)) {
    throw Object.assign(new Error(`Tài liệu requirement "${reqPath}" không tồn tại.`), { status: 404 });
  }

  const reqContent = fs.readFileSync(absReqPath, 'utf8');
  const reqMatch = reqContent.match(RE_REQ);
  const reqId = reqMatch ? reqMatch[0].toUpperCase() : 'REQ-001';

  const decidedQuestions = extractDecidedQuestions(reqContent);
  if (!decidedQuestions.length) {
    return {
      reqId,
      totalInferred: 0,
      mode,
      testCases: [],
      items: [],
      message: 'Không tìm thấy câu hỏi nào đã chốt (**Đã chốt:**) trong mục Open Questions của tài liệu này.',
    };
  }

  const acs = extractAcs(reqContent);
  const tcFile = findTestCaseFile(root, reqId);
  const existingTcIds = collectAllExistingTcIds(root);
  const existingTcTitles = [];

  if (tcFile.exists) {
    const tcContent = fs.readFileSync(tcFile.absPath, 'utf8');
    for (const match of tcContent.matchAll(RE_TC)) {
      const tid = match[0].toUpperCase();
      if (!existingTcIds.includes(tid)) existingTcIds.push(tid);
    }
    const lines = tcContent.split(/\r?\n/);
    for (const line of lines) {
      if (line.includes('TC-') || line.startsWith('###')) {
        existingTcTitles.push(line.trim());
      }
    }
  }

  const items = mode === 'ai'
    ? await inferWithAi({ decidedQuestions, acs, existingTcIds, clientConfig, root })
    : inferWithHeuristic({ reqId, decidedQuestions, existingTcIds, existingTcTitles, acs });

  return {
    reqId,
    mode,
    totalInferred: items.length,
    testCases: items,
    items,
  };
}

async function extractScaffoldFromRaw(arg1, arg2 = {}) {
  let root = process.cwd();
  let payload = {};

  if (typeof arg1 === 'string') {
    root = arg1;
    payload = arg2 || {};
  } else if (arg1 && typeof arg1 === 'object') {
    payload = arg1;
    root = arg1.root || process.cwd();
  }

  const rawContent = String(payload.rawContent || payload.rawText || payload.raw || '').trim();
  if (!rawContent) {
    throw Object.assign(new Error('Nội dung thô (Spec hoặc Test Script) không được để trống.'), { status: 400 });
  }

  const isTestScript = detectIsTestScript(rawContent);
  const inputType = isTestScript ? 'test_script' : 'spec_text';

  let nextReqId = 'REQ-001';
  let existingDomains = ['auth', 'job', 'account', 'general'];
  try {
    const { getScaffoldMeta } = require('./qaService');
    const meta = getScaffoldMeta(root);
    if (meta.nextReqId) nextReqId = meta.nextReqId;
    if (Array.isArray(meta.existingDomains) && meta.existingDomains.length) existingDomains = meta.existingDomains;
  } catch (_) {}

  const textReqMatch = rawContent.match(/\bREQ-(\d{3})\b/i);
  const reqId = (payload.reqId && /^REQ-\d{3}$/i.test(payload.reqId.trim()))
    ? payload.reqId.trim().toUpperCase()
    : (textReqMatch ? textReqMatch[0].toUpperCase() : nextReqId);

  const domain = (payload.domain && String(payload.domain).trim())
    ? String(payload.domain).trim().toLowerCase()
    : inferDomainFromText(rawContent, existingDomains);

  let aiResult = null;
  if (!isTestScript && payload.useAi !== false) {
    try {
      aiResult = await extractWithAi(root, rawContent, inputType, reqId, domain, payload);
    } catch (_) {}
  }

  const parsed = aiResult || (isTestScript
    ? extractHeuristicFromTestScript(rawContent, reqId, domain)
    : extractHeuristicFromSpecText(rawContent, reqId, domain));

  const synthesized = synthesizeScaffoldContents(root, {
    reqId,
    domain: parsed.domain || domain,
    title: parsed.title || `Tính năng ${reqId}`,
    slug: parsed.slug || slugify(parsed.title || `feature-${reqId}`),
    businessGoal: parsed.businessGoal || '',
    acs: parsed.acs || [],
    rules: parsed.rules || [],
    testCases: parsed.testCases || [],
    specCode: parsed.specCode || null,
  });

  return formatScaffoldResult(synthesized, inputType, aiResult);
}

module.exports = {
  RE_REQ,
  RE_AC,
  RE_TC,
  extractDecidedQuestions,
  extractAcs,
  getNextTcId,
  collectAllExistingTcIds,
  findTestCaseFile,
  slugify,
  inferDomainFromText,
  inferWithHeuristic,
  inferWithAi,
  inferTestCases,
  detectIsTestScript,
  parseTestBlocksFromScript,
  extractHeuristicFromTestScript,
  extractHeuristicFromSpecText,
  extractWithAi,
  extractScaffoldFromRaw,
  buildTestCaseDocument,
  appendTestCasesToDocument,
};
