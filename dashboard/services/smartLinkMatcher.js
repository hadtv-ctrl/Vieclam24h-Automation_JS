'use strict';

/**
 * dashboard/services/smartLinkMatcher.js
 * So khớp Heuristic song ngữ Việt - Anh giữa Spec và kho Requirement hiện có.
 * Trọng số theo tầng: describe/REQ x3, domain/PO x2, test/AC x1.
 * Ngân sách dòng: <= 200 dòng.
 */

const fs = require('node:fs');
const path = require('node:path');

const STOP_WORDS = new Set([
  'kiem', 'thu', 'kich', 'ban', 'test', 'cho', 'voi', 'e2e', 'real', 'web', 'suite',
  'va', 'cua', 'the', 'la', 'trong', 'nhung', 'cac', 'page', 'standard', 'spec',
  'given', 'when', 'then', 'and', 'but', 'req', 'ac', 'tc',
  'mo', 'trang', 'vao', 'duoc', 'den', 'hien', 'thi', 'bao', 'thong', 'tin'
]);

const SYNONYM_MAP = {
  'xac thuc': 'login', 'dang nhap': 'login', 'auth': 'login', 'authentication': 'login', 'signin': 'login',
  'dang ky': 'register', 'signup': 'register',
  'tim kiem': 'search', 'search': 'search',
  'gio hang': 'cart', 'cart': 'cart',
  'thanh toan': 'checkout', 'checkout': 'checkout',
  'tai khoan': 'user', 'account': 'user', 'ho so': 'user', 'profile': 'user',
  'mat khau': 'password', 'password': 'password',
  'nguoi dung': 'user', 'user': 'user'
};

function stripDiacritics(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase();
}

/** Tách từ khoá, áp dụng từ điển đồng nghĩa và loại bỏ từ vô nghĩa */
function tokenizeText(text) {
  let normalized = stripDiacritics(text).replace(/[^a-z0-9\s]/g, ' ');
  for (const [phrase, canonical] of Object.entries(SYNONYM_MAP)) {
    if (phrase.includes(' ') && normalized.includes(phrase)) {
      normalized = normalized.replaceAll(phrase, ` ${canonical} `);
    }
  }

  const rawTokens = normalized.split(/\s+/).filter(Boolean);
  const result = [];
  for (const tok of rawTokens) {
    const canonical = SYNONYM_MAP[tok] || tok;
    if (canonical.length > 1 && !STOP_WORDS.has(canonical)) {
      result.push(canonical);
    }
  }
  return [...new Set(result)];
}

/** Tính điểm tương đồng có trọng số giữa spec và requirement */
function calculateMatchScore(specTokens, reqTokens) {
  const specTokensSet = new Set(specTokens.high.concat(specTokens.medium, specTokens.low));
  const reqTokensSet = new Set(reqTokens.high.concat(reqTokens.medium, reqTokens.low));
  if (specTokensSet.size === 0 || reqTokensSet.size === 0) return 0;

  const tiers = [
    { s: specTokens.high, r: reqTokens.high, w: 3 },
    { s: specTokens.medium, r: reqTokens.medium, w: 2 },
    { s: specTokens.low, r: reqTokens.low, w: 1 },
  ];

  let weightedOverlap = 0;
  let totalWeight = 0;

  for (const { s, r, w } of tiers) {
    if (s.length === 0 || r.length === 0) continue;
    const sSet = new Set(s);
    const rSet = new Set(r);
    const minSize = Math.min(sSet.size, rSet.size);
    let common = 0;
    for (const t of rSet) {
      if (sSet.has(t)) common++;
    }
    const overlap = common / minSize;
    weightedOverlap += overlap * w;
    totalWeight += w;
  }

  let crossBonus = 0;
  const highReqTokens = reqTokens.high;
  if (highReqTokens.length > 0) {
    const inSpecCount = highReqTokens.filter((t) => specTokensSet.has(t)).length;
    crossBonus = inSpecCount / highReqTokens.length;
  }

  const baseScore = totalWeight > 0 ? weightedOverlap / totalWeight : 0;
  const finalScore = Math.min(1, Math.max(baseScore, 0.7 * baseScore + 0.3 * crossBonus));
  return Number(finalScore.toFixed(2));
}

/** Quét thư mục requirements/ và xếp hạng candidates */
function rankMatchingRequirements(root, specParsed) {
  const reqDir = path.join(root, 'requirements');
  const candidates = [];
  let maxReqNumber = 0;

  if (!fs.existsSync(reqDir)) {
    return { candidates, maxReqNumber: 0 };
  }

  const specTokens = {
    high: tokenizeText(specParsed.describeTitle),
    medium: tokenizeText(specParsed.pageObjects.join(' ') + ' ' + specParsed.urls.join(' ') + ' ' + (specParsed.specPath || '')),
    low: tokenizeText(specParsed.tests.map((t) => t.title).join(' ')),
  };

  const files = fs.readdirSync(reqDir).filter((f) => /^REQ-\d{3}.*\.md$/i.test(f));
  for (const file of files) {
    const numMatch = file.match(/^REQ-(\d{3})/i);
    if (numMatch) {
      const num = parseInt(numMatch[1], 10);
      if (num > maxReqNumber) maxReqNumber = num;
    }

    const absPath = path.join(reqDir, file);
    const content = fs.readFileSync(absPath, 'utf8');
    const firstLine = content.split(/\r?\n/).find((l) => l.startsWith('#')) || '';
    const title = firstLine.replace(/^#+\s*(?:REQ-\d{3}\s*)?/, '').trim() || file;
    const reqId = `REQ-${numMatch[1]}`;

    const acLines = content.split(/\r?\n/).filter((l) => /[-*]\s*AC-\d{3}/i.test(l)).join(' ');

    const reqTokens = {
      high: tokenizeText(title),
      medium: tokenizeText(file.replace(/^REQ-\d{3}-?|\.md$/gi, '')),
      low: tokenizeText(acLines || content),
    };

    const score = calculateMatchScore(specTokens, reqTokens);
    const matchLevel = score >= 0.7 ? 'high' : (score >= 0.4 ? 'partial' : 'new');

    const tcFile = path.join(root, 'test-cases', file);
    const tcExists = fs.existsSync(tcFile);

    candidates.push({
      reqId,
      title,
      score,
      matchLevel,
      docPath: path.relative(root, absPath).replace(/\\/g, '/'),
      tcPath: tcExists ? path.relative(root, tcFile).replace(/\\/g, '/') : `test-cases/${file}`,
      rawContent: content,
    });
  }

  candidates.sort((a, b) => b.score - a.score);
  return { candidates, maxReqNumber };
}

module.exports = {
  stripDiacritics,
  tokenizeText,
  calculateMatchScore,
  rankMatchingRequirements,
};
