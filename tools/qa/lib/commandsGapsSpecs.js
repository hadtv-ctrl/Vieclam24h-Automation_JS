'use strict';

const {
  mergeOptions,
  specPath,
  emptySpecFinding,
  getAutomatedTcIds,
  getWipTcIds,
  collect,
} = require('./commandsCore');
const { checkGlobalDocumentIntegrity, checkRequirementGaps } = require('./commandsGapsReqs');
const { missingSpecPaths } = require('./specLinkPaths');

function checkTraceabilityLinkGaps(root, testCases, automated, automatedTcIds, options, findings) {
  for (const link of testCases.links) {
    if (link.automation === 'Yes' && !automatedTcIds.has(link.tcId)) {
      findings.push({
        severity: 'blocker',
        kind: 'khai-automation-nhung-khong-co-script',
        where: link.file,
        message: `${link.tcId} khai Automation=Yes nhưng không có test nào mang mã đó.`,
        action: 'Viết script, hoặc sửa cột Automation về Candidate/No kèm lý do.',
      });
    }
    if (link.automation === 'No' && !testCases.noAutomationReasons.has(link.tcId)) {
      findings.push({
        severity: 'major',
        kind: 'khong-automation-nhung-khong-co-ly-do',
        where: link.file,
        message: `${link.tcId} là Automation=No nhưng không có dòng lý do ở mục "Case không automation".`,
        action: 'Ghi lý do và cách bù đắp, nếu không sẽ thành nợ ẩn.',
      });
    }
    if (link.automation === 'Candidate' && /^P[01]$/.test(link.priority)) {
      findings.push({
        severity: 'major',
        kind: 'p0-p1-con-dang-candidate',
        where: link.file,
        message: `${link.tcId} là ${link.priority} nhưng vẫn ở trạng thái Candidate.`,
        action: 'P0/P1 nên được automation, hoặc hạ priority kèm giải thích.',
      });
    }
    const missing = missingSpecPaths(root, link.spec, automated, options);
    if (missing.length > 0) {
      findings.push({
        severity: 'major',
        kind: 'spec-khong-ton-tai',
        where: link.file,
        message: `${link.tcId} khai spec "${missing.join(', ')}" nhưng file không tồn tại trên filesystem.`,
        action: 'Kiểm tra lại đường dẫn spec trong bảng Traceability.',
      });
    }
  }
}

function checkSpecQualityGaps(realTests, detailsByTc, options, deepSeverity, findings) {
  for (const t of realTests) {
    const profileKind = t.assertionProfile && t.assertionProfile.kind;
    const matchers = (t.assertionProfile && t.assertionProfile.matchers) || [];
    const isWip = Boolean(t.tags && t.tags.includes('@wip'));

    if (t.assertionCount === 0 && profileKind !== 'unknown') {
      findings.push({
        severity: 'major',
        kind: 'spec-thieu-assertion',
        where: specPath(options, t),
        message: `${t.tcId || t.title} không chứa bất kỳ lệnh assert/expect nào (assertionCount = 0).`,
        action: 'Bổ sung assertion expect(...) để kiểm chứng kết quả mong đợi, tránh test rỗng.',
      });
    }

    const isNavOnly = profileKind ? profileKind === 'navigation-only' : Boolean(t.onlyNavigationAssert);
    if (isNavOnly && !t.isSkipped && !isWip) {
      const list = matchers.length > 0 ? matchers.join(', ') : 'toHaveURL/toHaveTitle';
      findings.push({
        severity: 'minor',
        kind: 'spec-chi-assert-url',
        where: specPath(options, t),
        message: `${t.tcId || t.title} chỉ assert điều hướng trên page (${list}) mà chưa kiểm chứng trạng thái UI/dữ liệu nghiệp vụ.`,
        action:
          'Đối chiếu Expected Result của test case; bổ sung assertion đúng kết quả nghiệp vụ nếu TC yêu cầu (không thêm đại một toBeVisible bất kỳ chỉ để tắt cảnh báo).',
      });
    }

    const isWeakExistence = Boolean((t.assertionProfile && t.assertionProfile.weakExistenceOnly) || t.weakExistenceOnly);
    if (isWeakExistence && !t.isSkipped && !isWip) {
      const list = matchers.length > 0 ? matchers.join(', ') : 'toBeDefined/toBeTruthy';
      findings.push({
        severity: deepSeverity,
        kind: 'weak-existence-assertion',
        where: specPath(options, t),
        message: `${t.tcId || t.title} chỉ dùng assertion kiểm tra tồn tại yếu (${list}) mà chưa đối chiếu giá trị hoặc trạng thái cụ thể.`,
        action: 'Thay toBeDefined()/toBeTruthy() bằng assertion kiểm tra giá trị/trạng thái cụ thể (toBe, toEqual, toHaveText, toBeVisible, hoặc deep helper).',
      });
    }

    const tcDetail = t.tcId ? detailsByTc.get(t.tcId) : null;
    const requiresIdempotency = Boolean(
      t.requiresIdempotencyGuard ||
        (t.tags && t.tags.includes('@idempotency')) ||
        (tcDetail && Array.isArray(tcDetail.capabilities) && tcDetail.capabilities.includes('idempotency')),
    );
    if (requiresIdempotency && !t.isSkipped && !isWip && !matchers.includes('helper:expectIdempotentSubmit')) {
      findings.push({
        severity: deepSeverity,
        kind: 'missing-idempotency-guard',
        where: specPath(options, t),
        message: `${t.tcId || t.title} yêu cầu kiểm chứng chống gửi trùng (idempotency) nhưng chưa sử dụng helper expectIdempotentSubmit.`,
        action: 'Sử dụng expectIdempotentSubmit từ support/deep-guards để kiểm chứng khoá nút và chỉ gửi đúng 1 request mutation.',
      });
    }

    if (t.isSkipped && !isWip) {
      findings.push({
        severity: 'major',
        kind: 'test-bi-skip-am-tham',
        where: specPath(options, t),
        message: `${t.tcId || t.title} đang bị test.skip hoặc test.fixme mà không gắn tag @wip để cách ly.`,
        action: 'Gắn tag @wip hoặc phục hồi lại test nếu đã sẵn sàng.',
      });
    }

    if (t.missingAwaits && t.missingAwaits.length > 0) {
      for (const ma of t.missingAwaits) {
        findings.push({
          severity: 'major',
          kind: 'assertion-thieu-await',
          where: `${t.path || t.file}:${ma.line}`,
          message: `${t.tcId || t.title} gọi matcher bất đồng bộ của Playwright mà thiếu "await": "${ma.text}". Test có nguy cơ pass giả hoặc flaky.`,
          action: 'Thêm await trước expect(...).',
        });
      }
    }
  }
}

function gaps(root, rawOptions) {
  const options = mergeOptions(root, rawOptions);
  const { requirements, testCases, automated, realTests } = collect(root, options);
  const automatedTcIds = getAutomatedTcIds(realTests);
  const wipTcIds = getWipTcIds(realTests);

  const linksByAc = new Map();
  for (const link of testCases.links) {
    const k = `${link.reqId}/${link.acId}`;
    if (!linksByAc.has(k)) linksByAc.set(k, []);
    linksByAc.get(k).push(link);
  }
  const detailsByTc = new Map((testCases.details || []).map((d) => [d.tcId, d]));
  const activeTestsByReq = new Map();
  for (const t of realTests) {
    const isWip = Boolean(t.tags && t.tags.includes('@wip'));
    if (t.isSkipped || isWip || !t.reqId) continue;
    if (!activeTestsByReq.has(t.reqId)) activeTestsByReq.set(t.reqId, []);
    activeTestsByReq.get(t.reqId).push(t);
  }
  const deepSeverity = options && options.checkDeepCoverage ? 'major' : 'minor';
  const findings = [];

  checkGlobalDocumentIntegrity(requirements, testCases, options, findings);
  checkRequirementGaps(
    { requirements, testCases, linksByAc, automatedTcIds, wipTcIds, activeTestsByReq, options, deepSeverity },
    findings,
  );
  checkTraceabilityLinkGaps(root, testCases, automated, automatedTcIds, options, findings);
  checkSpecQualityGaps(realTests, detailsByTc, options, deepSeverity, findings);

  const empty = emptySpecFinding(testCases, automated, options);
  if (empty) findings.push(empty);
  if (automated.error) {
    findings.push({
      severity: 'blocker',
      kind: 'khong-doc-duoc-playwright',
      where: (options && options.projectDir) || 'playwright',
      message: automated.error,
      action: `Chạy npm install trong ${(options && options.projectDir) || 'playwright'} rồi thử lại.`,
    });
  }
  return findings;
}

module.exports = { gaps };

