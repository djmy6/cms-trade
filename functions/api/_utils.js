// Cloudflare Pages Functions 共享工具（Web Crypto，兼容 Workers 运行时）

const enc = new TextEncoder();
const dec = new TextDecoder();

// ---------- JSON 响应 ----------
export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

export function error(msg, status = 400) {
  return json({ ok: false, error: msg }, status);
}

export function ok(data = {}) {
  return json({ ok: true, ...data });
}

// ---------- Body ----------
export async function readBody(request) {
  try {
    const t = await request.text();
    return t ? JSON.parse(t) : {};
  } catch {
    return {};
  }
}

// ---------- Base64 URL ----------
function b64url(buf) {
  let bin = '';
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function unb64url(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// ---------- 密码哈希 (PBKDF2-SHA256) ----------
export function generateSalt(bytes = 16) {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return b64url(a);
}

export async function hashPassword(password, salt) {
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: unb64url(salt), iterations: 100000, hash: 'SHA-256' },
    key, 256
  );
  return b64url(bits);
}

export async function verifyPassword(password, salt, expected) {
  const h = await hashPassword(password, salt);
  return h === expected;
}

// ---------- JWT (HMAC-SHA256) ----------
async function hmacKey(secret) {
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

export async function signToken(payload, secret) {
  const header = b64url(enc.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const body = b64url(enc.encode(JSON.stringify(payload)));
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(`${header}.${body}`));
  return `${header}.${body}.${b64url(sig)}`;
}

export async function verifyToken(token, secret) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const key = await hmacKey(secret);
    const okSig = await crypto.subtle.verify('HMAC', key, unb64url(parts[2]), enc.encode(`${parts[0]}.${parts[1]}`));
    if (!okSig) return null;
    const payload = JSON.parse(dec.decode(unb64url(parts[1])));
    if (payload.exp && payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

// ---------- 认证 ----------
export async function authFromRequest(env, request) {
  const auth = request.headers.get('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token || !env.SECRET_KEY) return null;
  const payload = await verifyToken(token, env.SECRET_KEY);
  if (!payload || !payload.uid) return null;
  const { results } = await env.DB.prepare(
    'SELECT id, phone, name, role, created_at FROM users WHERE id = ?'
  ).bind(payload.uid).all();
  return results[0] || null;
}

// 管理员初始账号：第一次部署后可在 D1 手动将某用户设为 admin：
//   UPDATE users SET role='admin' WHERE phone='你的手机号';

// ---------- 角色 / 权限（Discuz! 风格）----------
export function isAdmin(u) { return !!(u && u.role === 'admin'); }
export function isBanned(u) { return !!(u && u.role === 'banned'); }
export function roleLabel(r) {
  return { admin: '管理员', supermod: '超级版主', moderator: '版主', user: '用户', banned: '禁言' }[r] || r || '用户';
}
// 是否可管理指定板块：管理员/超级版主管全部；版主管自己名下的板块
export function canManageBoard(u, board) {
  if (!u) return false;
  if (u.role === 'admin' || u.role === 'supermod') return true;
  if (u.role === 'moderator' && board && board.moderator_ids) {
    return board.moderator_ids.split(',').map((x) => parseInt(x, 10)).includes(u.id);
  }
  return false;
}

// ---------- 敏感词过滤（命中替换为等长 *）----------
export async function filterBannedWords(env, text) {
  if (!text) return text;
  const { results } = await env.DB.prepare('SELECT word FROM forum_banned_words').all();
  if (!results.length) return text;
  for (const r of results) {
    const w = String(r.word || '');
    if (!w) continue;
    text = text.split(w).join('*'.repeat(w.length));
  }
  return text;
}

// ---------- 记录管理操作日志 ----------
export async function logAdmin(env, adminId, action, target, detail = '') {
  await env.DB.prepare(
    'INSERT INTO forum_admin_logs (admin_id, action, target, detail) VALUES (?, ?, ?, ?)'
  ).bind(adminId, action, target, detail).run();
}

// ---------- 积分 / 等级（v6）----------
export function levelFor(points) {
  return Math.max(1, Math.floor((points || 0) / 50) + 1); // 每 50 分升一级
}
export async function ensureStats(env, userId) {
  await env.DB.prepare('INSERT OR IGNORE INTO user_stats (user_id) VALUES (?)').bind(userId).run();
}
// 给用户加/扣积分并写流水，返回最新积分/等级
export async function addPoints(env, userId, points, reason, refId = 0) {
  await ensureStats(env, userId);
  const { results } = await env.DB.prepare('SELECT points FROM user_stats WHERE user_id = ?').bind(userId).all();
  const cur = (results[0] && results[0].points) || 0;
  const np = Math.max(0, cur + points);
  const nl = levelFor(np);
  await env.DB.prepare('UPDATE user_stats SET points = ?, level = ? WHERE user_id = ?').bind(np, nl, userId).run();
  await env.DB.prepare('INSERT INTO sign_log (user_id, points, reason, ref_id) VALUES (?, ?, ?, ?)').bind(userId, points, reason, refId).run();
  return { points: np, level: nl, delta: points };
}
// 论坛本地日期（UTC+8，与中国用户一致）
export function cnDate(offsetDays = 0) {
  const d = new Date(Date.now() + 8 * 3600 * 1000 + offsetDays * 86400000);
  return d.toISOString().slice(0, 10);
}

// ---------- @提及（v6）----------
export async function parseMentions(env, content, fromId, topicId = 0, replyId = 0) {
  if (!content) return;
  const names = content.match(/@([\u4e00-\u9fa5A-Za-z0-9_-]{1,30})/g) || [];
  const uniq = [...new Set(names.map((n) => n.slice(1)))].filter(Boolean);
  if (!uniq.length) return;
  const ph = uniq.map(() => '?').join(',');
  const { results } = await env.DB.prepare(`SELECT id FROM users WHERE name IN (${ph})`).bind(...uniq).all();
  for (const r of results) {
    if (r.id === fromId) continue;
    await env.DB.prepare('INSERT INTO mentions (topic_id, reply_id, from_id, to_id) VALUES (?, ?, ?, ?)')
      .bind(topicId, replyId, fromId, r.id).run();
  }
}
