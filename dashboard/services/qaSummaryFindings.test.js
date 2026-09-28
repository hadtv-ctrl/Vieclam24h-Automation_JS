'use strict';

/**
 * PLAN-18 Phase 1: getQaSummary gộp finding trùng, gắn findingKey/fixRoute, giữ chỉ mục
 * findingsIndex theo root và scanId chỉ tăng khi quét thật. Chạy scanner thật trên fixture.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { createFixtureWorkspace } = require('../../tests/dashboard/support/fixtureWorkspace');
const { seedBatchFixture } = require('../../tests/dashboard/support/batchFixtureSeed');
const { getQaSummary, getFindingsIndex, invalidateQaSummaryCache } = require('./qaService');

test('getQaSummary: gộp finding lặp theo project, gắn key/route, health khớp danh sách', () => {
  const ws = createFixtureWorkspace();
  try {
    seedBatchFixture(ws.rootPath);
    invalidateQaSummaryCache();
    const summary = getQaSummary(ws.rootPath, { force: true });

    const awaits = summary.findings.filter((f) => f.kind === 'assertion-thieu-await');
    assert.equal(awaits.length, 3);
    assert.ok(awaits.every((f) => f.occurrences === 2 && f.fixRoute === 'quick'));
    assert.equal(new Set(summary.findings.map((f) => f.findingKey)).size, summary.findings.length);
    assert.equal(summary.findings.find((f) => f.kind === 'spec-thieu-assertion').fixRoute, 'manual');

    assert.equal(summary.health.totalFindings, summary.findings.length);
    assert.equal(
      summary.health.blockers + summary.health.majors + summary.health.minors,
      summary.findings.filter((f) => ['blocker', 'major', 'minor'].includes(f.severity)).length,
    );
  } finally {
    ws.cleanup();
    invalidateQaSummaryCache();
  }
});

test('getQaSummary: scanId giữ nguyên khi trả cache, tăng khi quét lại; findingsIndex tra được theo key', () => {
  const ws = createFixtureWorkspace();
  try {
    seedBatchFixture(ws.rootPath);
    invalidateQaSummaryCache();
    assert.equal(getFindingsIndex(ws.rootPath), null);

    const first = getQaSummary(ws.rootPath, { force: true });
    const cached = getQaSummary(ws.rootPath);
    assert.equal(cached.scanId, first.scanId);

    const index = getFindingsIndex(ws.rootPath);
    assert.equal(index.scanId, first.scanId);
    const sample = first.findings[0];
    assert.equal(index.byKey.get(sample.findingKey).where, sample.where);

    const rescanned = getQaSummary(ws.rootPath, { force: true });
    assert.ok(rescanned.scanId > first.scanId);
    assert.equal(getFindingsIndex(ws.rootPath).scanId, rescanned.scanId);
  } finally {
    ws.cleanup();
    invalidateQaSummaryCache();
  }
});
