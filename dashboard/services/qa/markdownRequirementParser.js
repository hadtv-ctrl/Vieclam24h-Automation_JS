'use strict';

/**
 * dashboard/services/qa/markdownRequirementParser.js
 * Tiện ích bóc tách AC-xxx, REQ-xxx, Open Questions và tra cứu file test-cases.
 */

const fs = require('fs');
const path = require('path');

const RE_REQ = /\bREQ-(\d{3})\b/;
const RE_AC = /\bAC-(\d{3})\b/g;
const RE_TC = /\bTC-(\d{3})\b/g;

function extractAcs(markdown) {
  const acs = [];
  const lines = String(markdown || '').split(/\r?\n/);
  for (const line of lines) {
    const m = line.match(/^#{2,4}\s*(AC-\d{3})\b[:\s\-—]*(.*)$/i);
    if (m) {
      acs.push({ id: m[1].toUpperCase(), title: m[2].trim() });
    }
  }
  if (!acs.length) {
    for (const line of lines) {
      const allMatches = line.matchAll(RE_AC);
      for (const match of allMatches) {
        const id = match[0].toUpperCase();
        if (!acs.some((a) => a.id === id)) {
          acs.push({ id, title: line.trim().slice(0, 100) });
        }
      }
    }
  }
  return acs;
}

function extractDecidedQuestions(markdown) {
  const lines = String(markdown || '').split(/\r?\n/);
  const qSectionIdx = lines.findIndex((l) => /^#{1,6}\s+open\s+questions\b/i.test(l));
  if (qSectionIdx === -1) return [];

  const decided = [];
  for (let i = qSectionIdx + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^#{1,4}\s+/.test(line)) break;

    const isNumbered = line.match(/^\s*(\d+)[.)]\s+(.*)$/);
    const isBullet = line.match(/^\s*[-*+]\s+(.*)$/);
    if (!isNumbered && !isBullet) continue;

    const rawText = (isNumbered ? isNumbered[2] : isBullet[1]).trim();
    if (/\*\*Đã chốt\b/i.test(rawText)) {
      const splitDecided = rawText.split(/\*\*Đã chốt[^*]*\*\*:?\s*/i);
      const questionPart = splitDecided[0].replace(/\s*[—–-]\s*c[ầa]n\s+[^—–-]*?x[áa]c\s+nh[ậa]n\s*$/i, '').trim();
      const decisionPart = (splitDecided[1] || '').trim();

      decided.push({
        id: isNumbered ? `Q-${isNumbered[1]}` : `Q-${decided.length + 1}`,
        raw: rawText,
        question: questionPart,
        decision: decisionPart,
      });
    }
  }
  return decided;
}

function findTestCaseFile(root, reqId) {
  const dirsToTry = ['test-cases', 'testCases'];
  for (const d of dirsToTry) {
    const absDir = path.join(root, d);
    if (fs.existsSync(absDir)) {
      const files = fs.readdirSync(absDir);
      const match = files.find((f) => f.toUpperCase().includes(reqId.toUpperCase()) && f.endsWith('.md'));
      if (match) {
        return {
          relPath: path.posix.join(d, match),
          absPath: path.join(absDir, match),
          exists: true,
        };
      }
      return {
        relPath: path.posix.join(d, `${reqId}.md`),
        absPath: path.join(absDir, `${reqId}.md`),
        exists: false,
      };
    }
  }
  return {
    relPath: path.posix.join('test-cases', `${reqId}.md`),
    absPath: path.join(root, 'test-cases', `${reqId}.md`),
    exists: false,
  };
}

function getNextTcId(existingIds, offset = 0) {
  let max = 0;
  for (const id of existingIds) {
    const m = id.match(/TC-(\d{3,})/i);
    if (m) {
      const val = parseInt(m[1], 10);
      if (val > max) max = val;
    }
  }
  return `TC-${String(max + 1 + offset).padStart(3, '0')}`;
}

function slugify(text) {
  return String(text || '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'feature';
}

function inferDomainFromText(text, existingDomains = []) {
  const lower = String(text || '').toLowerCase();
  for (const d of existingDomains) {
    if (d && lower.includes(d.toLowerCase())) return d.toLowerCase();
  }
  if (/login|sign.?in|đăng nhập|register|sign.?up|đăng ký|auth|password|mật khẩu|otp/i.test(lower)) return 'auth';
  if (/job|tin tuyển dụng|việc làm|tuyển dụng|apply|ứng tuyển|hồ sơ/i.test(lower)) return 'job';
  if (/profile|user|tài khoản|thông tin cá nhân|cài đặt/i.test(lower)) return 'profile';
  if (/employer|nhà tuyển dụng|ntd|doanh nghiệp/i.test(lower)) return 'employer';
  return existingDomains[0] || 'general';
}

function collectAllExistingTcIds(root) {
  const ids = new Set();
  const dirs = ['test-cases', 'testCases'];
  for (const d of dirs) {
    const absDir = path.join(root, d);
    if (!fs.existsSync(absDir)) continue;
    try {
      const files = fs.readdirSync(absDir);
      for (const f of files) {
        if (!f.endsWith('.md')) continue;
        const text = fs.readFileSync(path.join(absDir, f), 'utf8');
        for (const match of text.matchAll(RE_TC)) {
          ids.add(match[0].toUpperCase());
        }
      }
    } catch {}
  }
  return [...ids];
}

module.exports = {
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
};
