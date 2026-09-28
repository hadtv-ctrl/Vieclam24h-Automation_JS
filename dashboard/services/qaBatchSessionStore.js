'use strict';

/**
 * dashboard/services/qaBatchSessionStore.js
 * Session của batch fixer (PLAN-18) trong RAM + write lock theo project root.
 *
 * State machine: PLANNED -> APPLYING -> COMMITTED -> ROLLING_BACK -> ROLLED_BACK;
 * APPLYING -> FAILED; PLANNED -> EXPIRED (TTL). Trạng thái bền vững (sau commit) nằm ở
 * manifest trên đĩa, không ở đây — RAM chỉ giữ kế hoạch chưa áp dụng.
 */

const crypto = require('node:crypto');
const path = require('node:path');

const SESSION_TTL_MS = 15 * 60_000;
const MAX_PLANNED_SESSIONS = 20;
const SESSION_ID = /^qb-[a-z0-9]{6,14}-[a-f0-9]{6}$/;

const sessions = new Map();
const lockedRoots = new Set();

/** Lỗi mang status HTTP + code máy đọc được; route chỉ việc chuyển nguyên. */
function httpError(status, code, message, details) {
  return Object.assign(new Error(message), { status, code, details });
}

function isValidSessionId(id) {
  return typeof id === 'string' && SESSION_ID.test(id);
}

function sweep(now = Date.now()) {
  for (const [id, session] of sessions) {
    if (session.state === 'PLANNED' && now > session.expiresAt) sessions.delete(id);
  }
  const planned = [...sessions.values()].filter((s) => s.state === 'PLANNED')
    .sort((a, b) => a.createdAt - b.createdAt);
  while (planned.length > MAX_PLANNED_SESSIONS) sessions.delete(planned.shift().id);
}

function createSession(root, data) {
  sweep();
  const now = Date.now();
  const session = {
    ...data,
    id: `qb-${now.toString(36)}-${crypto.randomBytes(3).toString('hex')}`,
    root: path.resolve(root),
    state: 'PLANNED',
    revision: 1,
    createdAt: now,
    expiresAt: now + SESSION_TTL_MS,
  };
  sessions.set(session.id, session);
  return session;
}

/** Session còn hiệu lực của đúng root, hoặc ném 404 SESSION_NOT_FOUND. */
function requireSession(root, sessionId) {
  sweep();
  const session = isValidSessionId(sessionId) ? sessions.get(sessionId) : null;
  if (!session || session.root !== path.resolve(root)) {
    throw httpError(404, 'SESSION_NOT_FOUND', 'Kế hoạch sửa không còn hiệu lực. Hãy lập lại kế hoạch.');
  }
  return session;
}

/** Session còn chờ áp dụng của một root — dùng để không cấp trùng số TC đang giữ chỗ. */
function plannedSessions(root) {
  sweep();
  const key = path.resolve(root);
  return [...sessions.values()].filter((s) => s.state === 'PLANNED' && s.root === key);
}

function transition(session, from, to) {
  if (session.state !== from) {
    throw httpError(409, 'INVALID_STATE', `Kế hoạch đang ở trạng thái ${session.state}, không thể chuyển sang ${to}.`);
  }
  session.state = to;
}

function requireRevision(session, revision) {
  if (revision !== session.revision) {
    throw httpError(409, 'REVISION_STALE', 'Kế hoạch đã thay đổi. Hãy tải lại bản xem trước.', {
      revision: session.revision,
    });
  }
}

/** Chạy `fn` khi giữ lock ghi của root; đang bận thì 409 ngay, không xếp hàng. */
async function withWriteLock(root, fn) {
  const key = path.resolve(root).toLowerCase();
  if (lockedRoots.has(key)) {
    throw httpError(409, 'BATCH_LOCKED', 'Đang có thao tác ghi khác. Thử lại sau vài giây.');
  }
  lockedRoots.add(key);
  try {
    return await fn();
  } finally {
    lockedRoots.delete(key);
  }
}

/** Chỉ dùng trong test. */
function resetSessions() {
  sessions.clear();
  lockedRoots.clear();
}

module.exports = {
  SESSION_TTL_MS,
  MAX_PLANNED_SESSIONS,
  httpError,
  isValidSessionId,
  createSession,
  requireSession,
  plannedSessions,
  transition,
  requireRevision,
  withWriteLock,
  resetSessions,
};
