'use strict';

const fs = require('fs');
const path = require('path');
const { DEFAULT_DIRS, isHubRepo } = require('./qaTraceShared');
const { parseRequirements, parseTestCases } = require('./qaTraceDocs');
const { parseSpecs } = require('./qaTraceSpecs');
const { lintDocFindings, specFindings } = require('./qaTraceFindings');

/**
 * @param {{root?: string, dirs?: object}} options
 * @returns báo cáo truy vết đầy đủ, không ném lỗi khi tài liệu chưa tồn tại.
 */
function buildTraceReport({ root = process.cwd(), dirs = {} } = {}) {
  const d = { ...DEFAULT_DIRS, ...dirs };
  const isHub = isHubRepo(root);

  const reqParse = parseRequirements(root, d.requirements);
  const tcParse = parseTestCases(root, d.testCases);
  const { requirements } = reqParse;
  const { testCases } = tcParse;
  const { specs } = parseSpecs(root, d.specs);

  const hasRequirements = !isHub && fs.existsSync(path.join(root, d.requirements)) && reqParse.files.length > 0;
  const hasTestCases = !isHub && fs.existsSync(path.join(root, d.testCases)) && tcParse.files.length > 0;

  const allAcs = new Set();
  for (const req of requirements.values()) req.acs.forEach((ac) => allAcs.add(ac));

  const acsCoveredByTc = new Set();
  for (const tc of testCases.values()) tc.acs.forEach((ac) => acsCoveredByTc.add(ac));

  const tcsInSpecs = new Set();
  const reqsInSpecs = new Set();
  for (const s of specs) {
    s.tcs.forEach((tc) => tcsInSpecs.add(tc));
    s.reqs.forEach((r) => reqsInSpecs.add(r));
  }

  const findings = [];
  findings.push(...lintDocFindings(reqParse, tcParse));

  // 1. Nghiệp vụ đã ghi nhận nhưng chưa ai thiết kế test case.
  for (const ac of [...allAcs].sort()) {
    if (!acsCoveredByTc.has(ac)) {
      const owner = [...requirements.values()].find((r) => r.acs.includes(ac));
      findings.push({
        kind: 'ac-khong-co-tc',
        severity: 'major',
        id: ac,
        detail: `${ac} (thuộc ${owner ? owner.id : '?'}) chưa có test case nào trong ${d.testCases}/`,
      });
    }
  }

  // 2. Test case đã viết nhưng chưa có script -> ứng viên automation.
  //    Trừ TC đã khai rõ là cố ý không automation: ghi ở mức info, không tính là nợ.
  const candidates = [];
  for (const tc of [...testCases.values()].sort((a, b) => a.id.localeCompare(b.id))) {
    if (tcsInSpecs.has(tc.id)) continue;

    if (tc.automation === 'no') {
      findings.push({
        kind: 'tc-co-y-thu-cong',
        severity: 'info',
        id: tc.id,
        detail: `${tc.id}${tc.priority ? ` (${tc.priority})` : ''} khai rõ không automation — giữ nguyên, không tính là nợ`,
      });
      continue;
    }

    candidates.push(tc);
    findings.push({
      kind: 'tc-chua-automation',
      severity: tc.priority === 'P0' || tc.priority === 'P1' ? 'major' : 'minor',
      id: tc.id,
      detail: `${tc.id}${tc.priority ? ` (${tc.priority})` : ''} chưa có spec nào tham chiếu tới`,
    });
  }

  findings.push(...specFindings({ specs, requirements, testCases, hasRequirements, hasTestCases, d }));

  const bootstrap = !hasRequirements && !hasTestCases;

  return {
    root,
    isHub,
    dirs: d,
    hasRequirements,
    hasTestCases,
    bootstrap,
    counts: {
      requirements: requirements.size,
      acceptanceCriteria: allAcs.size,
      testCases: testCases.size,
      specs: specs.length,
      specsWithoutTrace: specs.filter((s) => s.reqs.length === 0).length,
    },
    requirements: [...requirements.values()],
    testCases: [...testCases.values()],
    specs,
    candidates,
    findings,
  };
}

module.exports = { buildTraceReport };
