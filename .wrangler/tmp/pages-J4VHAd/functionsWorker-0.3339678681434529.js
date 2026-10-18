var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// api/_utils.js
var enc = new TextEncoder();
var dec = new TextDecoder();
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}
__name(json, "json");
function error(msg, status = 400) {
  return json({ ok: false, error: msg }, status);
}
__name(error, "error");
async function readBody(request) {
  try {
    const t = await request.text();
    return t ? JSON.parse(t) : {};
  } catch {
    return {};
  }
}
__name(readBody, "readBody");
function b64url(buf) {
  let bin = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
__name(b64url, "b64url");
function unb64url(s) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
__name(unb64url, "unb64url");
function generateSalt(bytes = 16) {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return b64url(a);
}
__name(generateSalt, "generateSalt");
async function hashPassword(password, salt) {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: unb64url(salt), iterations: 1e5, hash: "SHA-256" },
    key,
    256
  );
  return b64url(bits);
}
__name(hashPassword, "hashPassword");
async function verifyPassword(password, salt, expected) {
  const h = await hashPassword(password, salt);
  return h === expected;
}
__name(verifyPassword, "verifyPassword");
async function hmacKey(secret) {
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}
__name(hmacKey, "hmacKey");
async function signToken(payload, secret) {
  const header = b64url(enc.encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const body = b64url(enc.encode(JSON.stringify(payload)));
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(`${header}.${body}`));
  return `${header}.${body}.${b64url(sig)}`;
}
__name(signToken, "signToken");
async function verifyToken(token, secret) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const key = await hmacKey(secret);
    const okSig = await crypto.subtle.verify("HMAC", key, unb64url(parts[2]), enc.encode(`${parts[0]}.${parts[1]}`));
    if (!okSig) return null;
    const payload = JSON.parse(dec.decode(unb64url(parts[1])));
    if (payload.exp && payload.exp * 1e3 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
__name(verifyToken, "verifyToken");
async function authFromRequest(env, request) {
  const auth = request.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token || !env.SECRET_KEY) return null;
  const payload = await verifyToken(token, env.SECRET_KEY);
  if (!payload || !payload.uid) return null;
  const { results } = await env.DB.prepare(
    "SELECT id, phone, name, role, created_at FROM users WHERE id = ?"
  ).bind(payload.uid).all();
  return results[0] || null;
}
__name(authFromRequest, "authFromRequest");

// api/admin/users/[id]/role.js
var onRequestPut = /* @__PURE__ */ __name(async ({ env, request, params }) => {
  const user = await authFromRequest(env, request);
  if (!user || user.role !== "admin") return error("\u9700\u8981\u7BA1\u7406\u5458\u6743\u9650", 403);
  const id = parseInt(params.id, 10);
  const body = await readBody(request);
  const role = body.role === "admin" ? "admin" : "user";
  if (id === user.id && role !== "admin") return error("\u4E0D\u80FD\u64A4\u9500\u81EA\u5DF1\u7684\u7BA1\u7406\u5458\u6743\u9650");
  await env.DB.prepare("UPDATE users SET role = ? WHERE id = ?").bind(role, id).run();
  return json({ updated: true, id, role });
}, "onRequestPut");

// api/admin/users/[id].js
var onRequestDelete = /* @__PURE__ */ __name(async ({ env, request, params }) => {
  const user = await authFromRequest(env, request);
  if (!user || user.role !== "admin") return error("\u9700\u8981\u7BA1\u7406\u5458\u6743\u9650", 403);
  const id = parseInt(params.id, 10);
  if (id === user.id) return error("\u4E0D\u80FD\u5220\u9664\u81EA\u5DF1");
  await env.DB.prepare("DELETE FROM posts WHERE user_id = ?").bind(id).run();
  await env.DB.prepare("DELETE FROM display_settings WHERE user_id = ?").bind(id).run();
  await env.DB.prepare("DELETE FROM users WHERE id = ?").bind(id).run();
  return json({ deleted: true, id });
}, "onRequestDelete");

// api/admin/posts.js
var onRequestGet = /* @__PURE__ */ __name(async ({ env, request }) => {
  const user = await authFromRequest(env, request);
  if (!user || user.role !== "admin") return error("\u9700\u8981\u7BA1\u7406\u5458\u6743\u9650", 403);
  const { results } = await env.DB.prepare(
    `SELECT p.*, u.name AS author_name, u.phone AS author_phone
     FROM posts p LEFT JOIN users u ON u.id = p.user_id ORDER BY p.id DESC`
  ).all();
  return json({ list: results });
}, "onRequestGet");

// api/admin/stats.js
var onRequestGet2 = /* @__PURE__ */ __name(async ({ env, request }) => {
  const user = await authFromRequest(env, request);
  if (!user || user.role !== "admin") return error("\u9700\u8981\u7BA1\u7406\u5458\u6743\u9650", 403);
  const u = await env.DB.prepare("SELECT COUNT(*) AS c FROM users").all();
  const p = await env.DB.prepare("SELECT COUNT(*) AS c, COALESCE(SUM(refund_amount), 0) AS ra FROM posts").all();
  const admin = await env.DB.prepare("SELECT COUNT(*) AS c FROM users WHERE role='admin'").all();
  return json({ stats: { users: u.results[0].c, posts: p.results[0].c, refundAmount: p.results[0].ra, admins: admin.results[0].c } });
}, "onRequestGet");

// api/admin/users.js
var onRequestGet3 = /* @__PURE__ */ __name(async ({ env, request }) => {
  const user = await authFromRequest(env, request);
  if (!user || user.role !== "admin") return error("\u9700\u8981\u7BA1\u7406\u5458\u6743\u9650", 403);
  const { results } = await env.DB.prepare(
    `SELECT u.id, u.phone, u.name, u.role, u.created_at,
       (SELECT COUNT(*) FROM posts p WHERE p.user_id = u.id) AS post_count
     FROM users u ORDER BY u.id DESC`
  ).all();
  return json({ list: results });
}, "onRequestGet");

// api/posts.js
var FIELDS = [
  "platform",
  "shop_name",
  "item",
  "amount",
  "buyer_account",
  "buyer_name",
  "buyer_real_phone",
  "buyer_virtual_phone",
  "buyer_address",
  "tracking_no",
  "refund_count",
  "refund_amount"
];
var onRequestGet4 = /* @__PURE__ */ __name(async ({ env, request }) => {
  const url = new URL(request.url);
  const name = (url.searchParams.get("name_exact") || "").trim();
  const addr = (url.searchParams.get("address_exact") || "").trim();
  const trk = (url.searchParams.get("tracking4") || "").trim();
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10) || 1);
  const size = Math.min(100, Math.max(1, parseInt(url.searchParams.get("size") || "20", 10) || 20));
  const offset = (page - 1) * size;
  const viewer = await authFromRequest(env, request);
  if (!viewer) return error("\u8BF7\u5148\u767B\u5F55\uFF0C\u624D\u80FD\u641C\u7D22\u5E76\u67E5\u770B\u4ED6\u4EBA\u53D1\u5E03\u7684\u5185\u5BB9", 401);
  const conds = [];
  const values = [];
  if (name) {
    conds.push("p.buyer_name = ?");
    values.push(name);
  }
  if (addr) {
    conds.push("p.buyer_address = ?");
    values.push(addr);
  }
  if (trk) {
    conds.push("substr(p.tracking_no, -4) = ?");
    values.push(trk);
  }
  if (!conds.length) return error("\u8BF7\u81F3\u5C11\u586B\u5199\u4E00\u9879\uFF1A\u4E70\u5BB6\u59D3\u540D / \u6536\u8D27\u5730\u5740 / \u8BA2\u5355\u53F7\u540E\u56DB\u4F4D");
  const whereSql = "WHERE p.user_id != ? AND (" + conds.join(" OR ") + ")";
  const bind = [viewer.id, ...values];
  const { results: total } = await env.DB.prepare(
    `SELECT COUNT(*) AS c FROM posts p ${whereSql}`
  ).bind(...bind).all();
  const count = total[0].c;
  const { results } = await env.DB.prepare(
    `SELECT p.*, u.name AS author_name FROM posts p LEFT JOIN users u ON u.id = p.user_id ${whereSql}
     ORDER BY p.id DESC LIMIT ? OFFSET ?`
  ).bind(...bind, size, offset).all();
  return json({ total: count, page, size, list: results, matched: true });
}, "onRequestGet");
var onRequestPost = /* @__PURE__ */ __name(async ({ env, request }) => {
  const user = await authFromRequest(env, request);
  if (!user) return error("\u8BF7\u5148\u767B\u5F55", 401);
  const body = await readBody(request);
  const p = {};
  for (const f of FIELDS) p[f] = body[f] !== void 0 ? String(body[f]).trim() : "";
  if (typeof p.refund_count === "string") p.refund_count = parseInt(p.refund_count, 10) || 0;
  if (!p.buyer_account && !p.shop_name && !p.item) return error("\u8BF7\u81F3\u5C11\u586B\u5199 \u4E70\u5BB6\u8D26\u53F7 / \u5E97\u94FA\u540D\u79F0 / \u8D2D\u4E70\u7269\u54C1 \u4E4B\u4E00");
  const r = await env.DB.prepare(
    `INSERT INTO posts (user_id, platform, shop_name, item, amount, buyer_account, buyer_name,
       buyer_real_phone, buyer_virtual_phone, buyer_address, tracking_no, refund_count, refund_amount)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    user.id,
    p.platform,
    p.shop_name,
    p.item,
    p.amount,
    p.buyer_account,
    p.buyer_name,
    p.buyer_real_phone,
    p.buyer_virtual_phone,
    p.buyer_address,
    p.tracking_no,
    p.refund_count,
    p.refund_amount
  ).run();
  return json({ id: r.meta.last_row_id }, 201);
}, "onRequestPost");

// api/posts/[id].js
var onRequestGet5 = /* @__PURE__ */ __name(async ({ env, request, params }) => {
  const id = parseInt(params.id, 10);
  const viewer = await authFromRequest(env, request);
  const isAdmin = !!(viewer && viewer.role === "admin");
  const { results } = await env.DB.prepare(
    `SELECT p.*, u.name AS author_name FROM posts p LEFT JOIN users u ON u.id = p.user_id WHERE p.id = ?`
  ).bind(id).all();
  if (!results[0]) return error("\u5E16\u5B50\u4E0D\u5B58\u5728", 404);
  const post = results[0];
  if (!isAdmin) {
    const { results: ss } = await env.DB.prepare("SELECT * FROM display_settings WHERE user_id = ?").bind(post.user_id).all();
    const settings = ss[0] || {};
    const map = {
      platform: "show_platform",
      shop_name: "show_shop",
      item: "show_item",
      amount: "show_amount",
      buyer_account: "show_buyer_account",
      buyer_name: "show_buyer_name",
      buyer_real_phone: "show_real_phone",
      buyer_virtual_phone: "show_virtual_phone",
      buyer_address: "show_address",
      tracking_no: "show_tracking",
      refund_count: "show_refund_count",
      refund_amount: "show_refund_amount"
    };
    for (const f of FIELDS) if (map[f] && settings[map[f]] === 0) post[f] = "";
  }
  return json({ post });
}, "onRequestGet");
var onRequestPut2 = /* @__PURE__ */ __name(async ({ env, request, params }) => {
  const user = await authFromRequest(env, request);
  if (!user) return error("\u8BF7\u5148\u767B\u5F55", 401);
  const id = parseInt(params.id, 10);
  const { results } = await env.DB.prepare("SELECT user_id FROM posts WHERE id = ?").bind(id).all();
  if (!results[0]) return error("\u5E16\u5B50\u4E0D\u5B58\u5728", 404);
  if (user.role !== "admin" && results[0].user_id !== user.id) return error("\u65E0\u6743\u7F16\u8F91\u8BE5\u5E16\u5B50", 403);
  const body = await readBody(request);
  const p = {};
  for (const f of FIELDS) p[f] = body[f] !== void 0 ? String(body[f]).trim() : "";
  if (typeof p.refund_count === "string") p.refund_count = parseInt(p.refund_count, 10) || 0;
  await env.DB.prepare(
    `UPDATE posts SET platform=?, shop_name=?, item=?, amount=?, buyer_account=?, buyer_name=?,
       buyer_real_phone=?, buyer_virtual_phone=?, buyer_address=?, tracking_no=?, refund_count=?, refund_amount=?
     WHERE id=?`
  ).bind(
    p.platform,
    p.shop_name,
    p.item,
    p.amount,
    p.buyer_account,
    p.buyer_name,
    p.buyer_real_phone,
    p.buyer_virtual_phone,
    p.buyer_address,
    p.tracking_no,
    p.refund_count,
    p.refund_amount,
    id
  ).run();
  return json({ updated: true });
}, "onRequestPut");
var onRequestDelete2 = /* @__PURE__ */ __name(async ({ env, request, params }) => {
  const user = await authFromRequest(env, request);
  if (!user) return error("\u8BF7\u5148\u767B\u5F55", 401);
  const id = parseInt(params.id, 10);
  const { results } = await env.DB.prepare("SELECT user_id FROM posts WHERE id = ?").bind(id).all();
  if (!results[0]) return error("\u5E16\u5B50\u4E0D\u5B58\u5728", 404);
  if (user.role !== "admin" && results[0].user_id !== user.id) return error("\u65E0\u6743\u5220\u9664\u8BE5\u5E16\u5B50", 403);
  await env.DB.prepare("DELETE FROM posts WHERE id = ?").bind(id).run();
  return json({ deleted: true });
}, "onRequestDelete");

// api/export.js
var COLS = [
  ["id", "ID"],
  ["platform", "\u4EA4\u6613\u5E73\u53F0"],
  ["shop_name", "\u5E97\u94FA\u540D\u79F0"],
  ["item", "\u8D2D\u4E70\u7269\u54C1"],
  ["amount", "\u7269\u54C1\u91D1\u989D"],
  ["buyer_account", "\u4E70\u5BB6\u8D26\u53F7"],
  ["buyer_name", "\u4E70\u5BB6\u59D3\u540D"],
  ["buyer_real_phone", "\u4E70\u5BB6\u771F\u5B9E\u53F7\u7801"],
  ["buyer_virtual_phone", "\u4E70\u5BB6\u865A\u62DF\u53F7\u7801"],
  ["buyer_address", "\u4E70\u5BB6\u5730\u5740"],
  ["tracking_no", "\u5FEB\u9012\u5355\u53F7"],
  ["refund_count", "\u4EC5\u9000\u6B3E\u6B21\u6570"],
  ["refund_amount", "\u4EC5\u9000\u6B3E\u91D1\u989D"],
  ["created_at", "\u521B\u5EFA\u65F6\u95F4"]
];
var onRequestPost2 = /* @__PURE__ */ __name(async ({ env, request }) => {
  const user = await authFromRequest(env, request);
  if (!user) return error("\u8BF7\u5148\u767B\u5F55\uFF0C\u624D\u80FD\u641C\u7D22\u5E76\u5BFC\u51FA\u4ED6\u4EBA\u5185\u5BB9", 401);
  const body = await readBody(request);
  const name = String(body.name_exact || "").trim();
  const addr = String(body.address_exact || "").trim();
  const trk = String(body.tracking4 || "").trim();
  const conds = [];
  const values = [];
  if (name) {
    conds.push("buyer_name = ?");
    values.push(name);
  }
  if (addr) {
    conds.push("buyer_address = ?");
    values.push(addr);
  }
  if (trk) {
    conds.push("substr(tracking_no, -4) = ?");
    values.push(trk);
  }
  if (!conds.length) return error("\u8BF7\u81F3\u5C11\u586B\u5199\u4E00\u9879\uFF1A\u4E70\u5BB6\u59D3\u540D / \u6536\u8D27\u5730\u5740 / \u8BA2\u5355\u53F7\u540E\u56DB\u4F4D");
  const whereSql = "WHERE user_id != ? AND (" + conds.join(" OR ") + ")";
  const bind = [user.id, ...values];
  const { results } = await env.DB.prepare(
    `SELECT * FROM posts ${whereSql} ORDER BY id DESC`
  ).bind(...bind).all();
  const esc = /* @__PURE__ */ __name((v) => {
    const s = v === null || v === void 0 ? "" : String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }, "esc");
  const csv = "\uFEFF" + COLS.map(([, h]) => esc(h)).join(",") + "\n" + results.map((r) => COLS.map(([f]) => esc(r[f])).join(",")).join("\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="matched_export_${Date.now()}.csv"`
    }
  });
}, "onRequestPost");

// api/login.js
var onRequestPost3 = /* @__PURE__ */ __name(async ({ request, env }) => {
  const body = await readBody(request);
  const phone = String(body.phone || "").trim();
  const password = String(body.password || "");
  const { results } = await env.DB.prepare(
    "SELECT id, phone, password_hash, salt, name, role FROM users WHERE phone = ?"
  ).bind(phone).all();
  const user = results[0];
  if (!user) return error("\u624B\u673A\u53F7\u672A\u6CE8\u518C");
  const ok = await verifyPassword(password, user.salt, user.password_hash);
  if (!ok) return error("\u5BC6\u7801\u9519\u8BEF");
  const token = await signToken({ uid: user.id, role: user.role, exp: Math.floor(Date.now() / 1e3) + 7 * 24 * 3600 }, env.SECRET_KEY);
  return json({ token, user: { id: user.id, phone: user.phone, name: user.name, role: user.role } });
}, "onRequestPost");

// api/me.js
var onRequestGet6 = /* @__PURE__ */ __name(async ({ env, request }) => {
  const user = await authFromRequest(env, request);
  if (!user) return json({ ok: false, error: "\u672A\u767B\u5F55" }, 401);
  const { results } = await env.DB.prepare(
    "SELECT show_platform, show_shop, show_item, show_amount, show_buyer_account, show_buyer_name, show_real_phone, show_virtual_phone, show_address, show_tracking, show_refund_count, show_refund_amount FROM display_settings WHERE user_id = ?"
  ).bind(user.id).all();
  return json({ user, display: results[0] || {} });
}, "onRequestGet");

// api/register.js
var PHONE_RE = /^1[3-9]\d{9}$/;
var onRequestPost4 = /* @__PURE__ */ __name(async ({ request, env }) => {
  const body = await readBody(request);
  const phone = String(body.phone || "").trim();
  const code = String(body.code || "").trim();
  const password = String(body.password || "");
  const name = String(body.name || "").trim();
  if (!PHONE_RE.test(phone)) return error("\u624B\u673A\u53F7\u683C\u5F0F\u4E0D\u6B63\u786E");
  if (password.length < 6) return error("\u5BC6\u7801\u81F3\u5C11 6 \u4F4D");
  if (!code) return error("\u8BF7\u586B\u5199\u9A8C\u8BC1\u7801");
  const now = Date.now();
  const { results } = await env.DB.prepare(
    `SELECT id, code, expires_at FROM sms_codes
     WHERE phone = ? AND purpose = 'register' AND used = 0
     ORDER BY id DESC LIMIT 1`
  ).bind(phone).all();
  const rec = results[0];
  if (!rec) return error("\u8BF7\u5148\u83B7\u53D6\u9A8C\u8BC1\u7801");
  if (rec.expires_at < now) return error("\u9A8C\u8BC1\u7801\u5DF2\u8FC7\u671F\uFF0C\u8BF7\u91CD\u65B0\u83B7\u53D6");
  if (rec.code !== code) return error("\u9A8C\u8BC1\u7801\u4E0D\u6B63\u786E");
  const exist = await env.DB.prepare("SELECT id FROM users WHERE phone = ?").bind(phone).all();
  if (exist.results.length) return error("\u8BE5\u624B\u673A\u53F7\u5DF2\u6CE8\u518C\uFF0C\u8BF7\u76F4\u63A5\u767B\u5F55");
  const salt = generateSalt();
  const hash = await hashPassword(password, salt);
  await env.DB.prepare(
    "INSERT INTO users (phone, password_hash, salt, name, role) VALUES (?, ?, ?, ?, ?)"
  ).bind(phone, hash, salt, name, "user").run();
  const { results: us } = await env.DB.prepare("SELECT id FROM users WHERE phone = ?").bind(phone).all();
  const uid = us[0].id;
  await env.DB.prepare("UPDATE sms_codes SET used = 1 WHERE id = ?").bind(rec.id).run();
  await env.DB.prepare(
    "INSERT OR IGNORE INTO display_settings (user_id) VALUES (?)"
  ).bind(uid).run();
  const token = await signToken({ uid, role: "user", exp: Math.floor(Date.now() / 1e3) + 7 * 24 * 3600 }, env.SECRET_KEY);
  return json({ token, user: { id: uid, phone, name, role: "user" } });
}, "onRequestPost");

// api/send-code.js
function genCode() {
  return String(Math.floor(1e5 + Math.random() * 9e5));
}
__name(genCode, "genCode");
var PHONE_RE2 = /^1[3-9]\d{9}$/;
var onRequestPost5 = /* @__PURE__ */ __name(async ({ request, env }) => {
  const body = await readBody(request);
  const phone = String(body.phone || "").trim();
  const purpose = body.purpose === "login" ? "login" : "register";
  if (!PHONE_RE2.test(phone)) return error("\u624B\u673A\u53F7\u683C\u5F0F\u4E0D\u6B63\u786E");
  if (purpose === "register") {
    const { results } = await env.DB.prepare("SELECT id FROM users WHERE phone = ?").bind(phone).all();
    if (results.length) return error("\u8BE5\u624B\u673A\u53F7\u5DF2\u6CE8\u518C\uFF0C\u8BF7\u76F4\u63A5\u767B\u5F55");
  }
  const now = Date.now();
  const recent = await env.DB.prepare(
    "SELECT expires_at FROM sms_codes WHERE phone = ? AND used = 0 ORDER BY id DESC LIMIT 1"
  ).bind(phone).all();
  if (recent.results[0] && recent.results[0].expires_at > now - 45e3) {
    return error("\u53D1\u9001\u592A\u9891\u7E41\uFF0C\u8BF7\u7A0D\u540E\u518D\u8BD5");
  }
  const code = genCode();
  const expiresAt = now + 5 * 60 * 1e3;
  await env.DB.prepare(
    "INSERT INTO sms_codes (phone, code, purpose, used, expires_at) VALUES (?, ?, ?, 0, ?)"
  ).bind(phone, code, purpose, expiresAt).run();
  const provider = (env.SMS_PROVIDER || "mock").toLowerCase();
  const mockCode = env.MOCK_CODE || "123456";
  if (provider === "mock") {
    await env.DB.prepare(
      "UPDATE sms_codes SET code = ? WHERE phone = ? AND used = 0 ORDER BY id DESC LIMIT 1"
    ).bind(mockCode, phone).run();
    return json({ sent: true, mode: "mock", devCode: mockCode, msg: "\u5F00\u53D1\u6A21\u5F0F\uFF1A\u9A8C\u8BC1\u7801\u4E3A " + mockCode });
  }
  if (provider === "aliyun") {
    const akId = env.ALIYUN_ACCESS_KEY_ID, akSecret = env.ALIYUN_ACCESS_KEY_SECRET;
    const signName = env.ALIYUN_SIGN_NAME, tplCode = env.ALIYUN_TEMPLATE_CODE;
    if (!akId || !akSecret || !signName || !tplCode) return mockFallback(env, mockCode, phone);
    const sent = await sendAliyun({ akId, akSecret, signName, tplCode, phone, code });
    if (!sent) return mockFallback(env, mockCode, phone);
    return json({ sent: true, mode: "aliyun" });
  }
  if (provider === "tencent") {
    const sid = env.TENCENT_SECRET_ID, skey = env.TENCENT_SECRET_KEY;
    const sdkappid = env.TENCENT_SDKAPPID, signName = env.TENCENT_SIGN_NAME, tplId = env.TENCENT_TEMPLATE_ID;
    if (!sid || !skey || !sdkappid || !signName || !tplId) return mockFallback(env, mockCode, phone);
    const sent = await sendTencent({ sid, skey, sdkappid, signName, tplId, phone, code });
    if (!sent) return mockFallback(env, mockCode, phone);
    return json({ sent: true, mode: "tencent" });
  }
  return mockFallback(env, mockCode, phone);
}, "onRequestPost");
function mockFallback(env, mockCode, phone) {
  return json({
    sent: true,
    mode: "mock",
    devCode: mockCode,
    msg: "\u77ED\u4FE1\u670D\u52A1\u672A\u914D\u7F6E\u6216\u53D1\u9001\u5931\u8D25\uFF0C\u5DF2\u56DE\u9000\u5F00\u53D1\u9A8C\u8BC1\u7801\uFF1A" + mockCode
  });
}
__name(mockFallback, "mockFallback");
async function sendAliyun({ akId, akSecret, signName, tplCode, phone, code }) {
  try {
    const params = {
      AccessKeyId: akId,
      Action: "SendSms",
      Format: "JSON",
      RegionId: "cn-hangzhou",
      SignatureMethod: "HMAC-SHA1",
      SignatureNonce: crypto.randomUUID(),
      SignatureVersion: "1.0",
      Timestamp: (/* @__PURE__ */ new Date()).toISOString().replace(/\.\d+Z$/, "Z"),
      Version: "2017-05-25",
      PhoneNumbers: phone,
      SignName: signName,
      TemplateCode: tplCode,
      TemplateParam: JSON.stringify({ code })
    };
    const sorted = Object.keys(params).sort();
    const qs = sorted.map((k) => `${percent(k)}=${percent(params[k])}`).join("&");
    const stringToSign = "POST&%2F&" + percent(qs);
    const hmacKey2 = await crypto.subtle.importKey("raw", enc2(akSecret + "&"), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
    const sig = await crypto.subtle.sign("HMAC", hmacKey2, enc2(stringToSign));
    const signature = percent(btoa(String.fromCharCode(...new Uint8Array(sig))));
    const url = "https://dysmsapi.aliyuncs.com/?" + qs + "&Signature=" + signature;
    const resp = await fetch(url, { method: "POST" });
    const r = await resp.json();
    return r.Code === "OK";
  } catch {
    return false;
  }
}
__name(sendAliyun, "sendAliyun");
function enc2(s) {
  return new TextEncoder().encode(s);
}
__name(enc2, "enc");
function percent(s) {
  return encodeURIComponent(s).replace(/\+/g, "%20").replace(/\*/g, "%2A").replace(/%7E/g, "~");
}
__name(percent, "percent");
async function sendTencent({ sid, skey, sdkappid, signName, tplId, phone, code }) {
  try {
    const host = "sms.tencentcloudapi.com";
    const action = "SendSms";
    const version = "2021-01-11";
    const service = "sms";
    const ts = Math.floor(Date.now() / 1e3);
    const date = new Date(ts * 1e3).toISOString().slice(0, 10);
    const payload = JSON.stringify({
      PhoneNumberSet: [phone],
      SmsSdkAppId: String(sdkappid),
      SignName: signName,
      TemplateId: String(tplId),
      TemplateParamSet: [String(code)]
    });
    const h = /* @__PURE__ */ __name((algo, data) => crypto.subtle.digest(algo, enc2(data)), "h");
    const canonicalHeaders = `content-type:application/json; charset=utf-8
host:${host}
x-tc-action:${action.toLowerCase()}
`;
    const signedHeaders = "content-type;host;x-tc-action";
    const canonicalRequest = `POST
/

${canonicalHeaders}
${signedHeaders}
${b2h(await h("SHA-256", payload))}`;
    const credentialScope = `${date}/${service}/tc3_request`;
    const stringToSign = `TC3-HMAC-SHA256
${ts}
${credentialScope}
${b2h(await h("SHA-256", canonicalRequest))}`;
    const secretDate = await hmac(enc2("TC3" + skey), enc2(date));
    const secretService = await hmac(secretDate, enc2(service));
    const secretSigning = await hmac(secretService, enc2("tc3_request"));
    const signature = b2h(await hmac(secretSigning, enc2(stringToSign)));
    const auth = `TC3-HMAC-SHA256 Credential=${sid}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
    const resp = await fetch(`https://${host}`, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8", Authorization: auth, Host: host, "X-TC-Action": action, "X-TC-Timestamp": String(ts), "X-TC-Version": version },
      body: payload
    });
    const r = await resp.json();
    return r.Response && r.Response.Error ? false : true;
  } catch {
    return false;
  }
}
__name(sendTencent, "sendTencent");
async function hmac(key, data) {
  return crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]).then((k) => crypto.subtle.sign("HMAC", k, data));
}
__name(hmac, "hmac");
function b2h(buf) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(b2h, "b2h");

// api/settings.js
var KEYS = [
  "show_platform",
  "show_shop",
  "show_item",
  "show_amount",
  "show_buyer_account",
  "show_buyer_name",
  "show_real_phone",
  "show_virtual_phone",
  "show_address",
  "show_tracking",
  "show_refund_count",
  "show_refund_amount"
];
var onRequestGet7 = /* @__PURE__ */ __name(async ({ env, request }) => {
  const user = await authFromRequest(env, request);
  if (!user) return error("\u8BF7\u5148\u767B\u5F55", 401);
  const { results } = await env.DB.prepare("SELECT * FROM display_settings WHERE user_id = ?").bind(user.id).all();
  return json({ settings: results[0] || {} });
}, "onRequestGet");
var onRequestPut3 = /* @__PURE__ */ __name(async ({ env, request }) => {
  const user = await authFromRequest(env, request);
  if (!user) return error("\u8BF7\u5148\u767B\u5F55", 401);
  const body = await readBody(request);
  const set = {};
  for (const k of KEYS) {
    if (body[k] !== void 0) set[k] = body[k] ? 1 : 0;
  }
  const cols = Object.keys(set);
  if (!cols.length) return error("\u6CA1\u6709\u53EF\u66F4\u65B0\u7684\u8BBE\u7F6E\u9879");
  const assigns = cols.map((k) => `${k} = ?`).join(", ");
  await env.DB.prepare(
    `UPDATE display_settings SET ${assigns}, updated_at = datetime('now','localtime') WHERE user_id = ?`
  ).bind(...cols.map((k) => set[k]), user.id).run();
  return json({ updated: true, settings: set });
}, "onRequestPut");

// ../.wrangler/tmp/pages-J4VHAd/functionsRoutes-0.49005876455624864.mjs
var routes = [
  {
    routePath: "/api/admin/users/:id/role",
    mountPath: "/api/admin/users/:id",
    method: "PUT",
    middlewares: [],
    modules: [onRequestPut]
  },
  {
    routePath: "/api/admin/users/:id",
    mountPath: "/api/admin/users",
    method: "DELETE",
    middlewares: [],
    modules: [onRequestDelete]
  },
  {
    routePath: "/api/admin/posts",
    mountPath: "/api/admin",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet]
  },
  {
    routePath: "/api/admin/stats",
    mountPath: "/api/admin",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet2]
  },
  {
    routePath: "/api/admin/users",
    mountPath: "/api/admin",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet3]
  },
  {
    routePath: "/api/posts/:id",
    mountPath: "/api/posts",
    method: "DELETE",
    middlewares: [],
    modules: [onRequestDelete2]
  },
  {
    routePath: "/api/posts/:id",
    mountPath: "/api/posts",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet5]
  },
  {
    routePath: "/api/posts/:id",
    mountPath: "/api/posts",
    method: "PUT",
    middlewares: [],
    modules: [onRequestPut2]
  },
  {
    routePath: "/api/export",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost2]
  },
  {
    routePath: "/api/login",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost3]
  },
  {
    routePath: "/api/me",
    mountPath: "/api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet6]
  },
  {
    routePath: "/api/posts",
    mountPath: "/api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet4]
  },
  {
    routePath: "/api/posts",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost]
  },
  {
    routePath: "/api/register",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost4]
  },
  {
    routePath: "/api/send-code",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost5]
  },
  {
    routePath: "/api/settings",
    mountPath: "/api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet7]
  },
  {
    routePath: "/api/settings",
    mountPath: "/api",
    method: "PUT",
    middlewares: [],
    modules: [onRequestPut3]
  }
];

// C:/Users/Administrator/AppData/Roaming/npm/node_modules/wrangler/node_modules/path-to-regexp/dist.es2015/index.js
function lexer(str) {
  var tokens = [];
  var i = 0;
  while (i < str.length) {
    var char = str[i];
    if (char === "*" || char === "+" || char === "?") {
      tokens.push({ type: "MODIFIER", index: i, value: str[i++] });
      continue;
    }
    if (char === "\\") {
      tokens.push({ type: "ESCAPED_CHAR", index: i++, value: str[i++] });
      continue;
    }
    if (char === "{") {
      tokens.push({ type: "OPEN", index: i, value: str[i++] });
      continue;
    }
    if (char === "}") {
      tokens.push({ type: "CLOSE", index: i, value: str[i++] });
      continue;
    }
    if (char === ":") {
      var name = "";
      var j = i + 1;
      while (j < str.length) {
        var code = str.charCodeAt(j);
        if (
          // `0-9`
          code >= 48 && code <= 57 || // `A-Z`
          code >= 65 && code <= 90 || // `a-z`
          code >= 97 && code <= 122 || // `_`
          code === 95
        ) {
          name += str[j++];
          continue;
        }
        break;
      }
      if (!name)
        throw new TypeError("Missing parameter name at ".concat(i));
      tokens.push({ type: "NAME", index: i, value: name });
      i = j;
      continue;
    }
    if (char === "(") {
      var count = 1;
      var pattern = "";
      var j = i + 1;
      if (str[j] === "?") {
        throw new TypeError('Pattern cannot start with "?" at '.concat(j));
      }
      while (j < str.length) {
        if (str[j] === "\\") {
          pattern += str[j++] + str[j++];
          continue;
        }
        if (str[j] === ")") {
          count--;
          if (count === 0) {
            j++;
            break;
          }
        } else if (str[j] === "(") {
          count++;
          if (str[j + 1] !== "?") {
            throw new TypeError("Capturing groups are not allowed at ".concat(j));
          }
        }
        pattern += str[j++];
      }
      if (count)
        throw new TypeError("Unbalanced pattern at ".concat(i));
      if (!pattern)
        throw new TypeError("Missing pattern at ".concat(i));
      tokens.push({ type: "PATTERN", index: i, value: pattern });
      i = j;
      continue;
    }
    tokens.push({ type: "CHAR", index: i, value: str[i++] });
  }
  tokens.push({ type: "END", index: i, value: "" });
  return tokens;
}
__name(lexer, "lexer");
function parse(str, options) {
  if (options === void 0) {
    options = {};
  }
  var tokens = lexer(str);
  var _a = options.prefixes, prefixes = _a === void 0 ? "./" : _a, _b = options.delimiter, delimiter = _b === void 0 ? "/#?" : _b;
  var result = [];
  var key = 0;
  var i = 0;
  var path = "";
  var tryConsume = /* @__PURE__ */ __name(function(type) {
    if (i < tokens.length && tokens[i].type === type)
      return tokens[i++].value;
  }, "tryConsume");
  var mustConsume = /* @__PURE__ */ __name(function(type) {
    var value2 = tryConsume(type);
    if (value2 !== void 0)
      return value2;
    var _a2 = tokens[i], nextType = _a2.type, index = _a2.index;
    throw new TypeError("Unexpected ".concat(nextType, " at ").concat(index, ", expected ").concat(type));
  }, "mustConsume");
  var consumeText = /* @__PURE__ */ __name(function() {
    var result2 = "";
    var value2;
    while (value2 = tryConsume("CHAR") || tryConsume("ESCAPED_CHAR")) {
      result2 += value2;
    }
    return result2;
  }, "consumeText");
  var isSafe = /* @__PURE__ */ __name(function(value2) {
    for (var _i = 0, delimiter_1 = delimiter; _i < delimiter_1.length; _i++) {
      var char2 = delimiter_1[_i];
      if (value2.indexOf(char2) > -1)
        return true;
    }
    return false;
  }, "isSafe");
  var safePattern = /* @__PURE__ */ __name(function(prefix2) {
    var prev = result[result.length - 1];
    var prevText = prefix2 || (prev && typeof prev === "string" ? prev : "");
    if (prev && !prevText) {
      throw new TypeError('Must have text between two parameters, missing text after "'.concat(prev.name, '"'));
    }
    if (!prevText || isSafe(prevText))
      return "[^".concat(escapeString(delimiter), "]+?");
    return "(?:(?!".concat(escapeString(prevText), ")[^").concat(escapeString(delimiter), "])+?");
  }, "safePattern");
  while (i < tokens.length) {
    var char = tryConsume("CHAR");
    var name = tryConsume("NAME");
    var pattern = tryConsume("PATTERN");
    if (name || pattern) {
      var prefix = char || "";
      if (prefixes.indexOf(prefix) === -1) {
        path += prefix;
        prefix = "";
      }
      if (path) {
        result.push(path);
        path = "";
      }
      result.push({
        name: name || key++,
        prefix,
        suffix: "",
        pattern: pattern || safePattern(prefix),
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    var value = char || tryConsume("ESCAPED_CHAR");
    if (value) {
      path += value;
      continue;
    }
    if (path) {
      result.push(path);
      path = "";
    }
    var open = tryConsume("OPEN");
    if (open) {
      var prefix = consumeText();
      var name_1 = tryConsume("NAME") || "";
      var pattern_1 = tryConsume("PATTERN") || "";
      var suffix = consumeText();
      mustConsume("CLOSE");
      result.push({
        name: name_1 || (pattern_1 ? key++ : ""),
        pattern: name_1 && !pattern_1 ? safePattern(prefix) : pattern_1,
        prefix,
        suffix,
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    mustConsume("END");
  }
  return result;
}
__name(parse, "parse");
function match(str, options) {
  var keys = [];
  var re = pathToRegexp(str, keys, options);
  return regexpToFunction(re, keys, options);
}
__name(match, "match");
function regexpToFunction(re, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.decode, decode = _a === void 0 ? function(x) {
    return x;
  } : _a;
  return function(pathname) {
    var m = re.exec(pathname);
    if (!m)
      return false;
    var path = m[0], index = m.index;
    var params = /* @__PURE__ */ Object.create(null);
    var _loop_1 = /* @__PURE__ */ __name(function(i2) {
      if (m[i2] === void 0)
        return "continue";
      var key = keys[i2 - 1];
      if (key.modifier === "*" || key.modifier === "+") {
        params[key.name] = m[i2].split(key.prefix + key.suffix).map(function(value) {
          return decode(value, key);
        });
      } else {
        params[key.name] = decode(m[i2], key);
      }
    }, "_loop_1");
    for (var i = 1; i < m.length; i++) {
      _loop_1(i);
    }
    return { path, index, params };
  };
}
__name(regexpToFunction, "regexpToFunction");
function escapeString(str) {
  return str.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");
}
__name(escapeString, "escapeString");
function flags(options) {
  return options && options.sensitive ? "" : "i";
}
__name(flags, "flags");
function regexpToRegexp(path, keys) {
  if (!keys)
    return path;
  var groupsRegex = /\((?:\?<(.*?)>)?(?!\?)/g;
  var index = 0;
  var execResult = groupsRegex.exec(path.source);
  while (execResult) {
    keys.push({
      // Use parenthesized substring match if available, index otherwise
      name: execResult[1] || index++,
      prefix: "",
      suffix: "",
      modifier: "",
      pattern: ""
    });
    execResult = groupsRegex.exec(path.source);
  }
  return path;
}
__name(regexpToRegexp, "regexpToRegexp");
function arrayToRegexp(paths, keys, options) {
  var parts = paths.map(function(path) {
    return pathToRegexp(path, keys, options).source;
  });
  return new RegExp("(?:".concat(parts.join("|"), ")"), flags(options));
}
__name(arrayToRegexp, "arrayToRegexp");
function stringToRegexp(path, keys, options) {
  return tokensToRegexp(parse(path, options), keys, options);
}
__name(stringToRegexp, "stringToRegexp");
function tokensToRegexp(tokens, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.strict, strict = _a === void 0 ? false : _a, _b = options.start, start = _b === void 0 ? true : _b, _c = options.end, end = _c === void 0 ? true : _c, _d = options.encode, encode = _d === void 0 ? function(x) {
    return x;
  } : _d, _e = options.delimiter, delimiter = _e === void 0 ? "/#?" : _e, _f = options.endsWith, endsWith = _f === void 0 ? "" : _f;
  var endsWithRe = "[".concat(escapeString(endsWith), "]|$");
  var delimiterRe = "[".concat(escapeString(delimiter), "]");
  var route = start ? "^" : "";
  for (var _i = 0, tokens_1 = tokens; _i < tokens_1.length; _i++) {
    var token = tokens_1[_i];
    if (typeof token === "string") {
      route += escapeString(encode(token));
    } else {
      var prefix = escapeString(encode(token.prefix));
      var suffix = escapeString(encode(token.suffix));
      if (token.pattern) {
        if (keys)
          keys.push(token);
        if (prefix || suffix) {
          if (token.modifier === "+" || token.modifier === "*") {
            var mod = token.modifier === "*" ? "?" : "";
            route += "(?:".concat(prefix, "((?:").concat(token.pattern, ")(?:").concat(suffix).concat(prefix, "(?:").concat(token.pattern, "))*)").concat(suffix, ")").concat(mod);
          } else {
            route += "(?:".concat(prefix, "(").concat(token.pattern, ")").concat(suffix, ")").concat(token.modifier);
          }
        } else {
          if (token.modifier === "+" || token.modifier === "*") {
            throw new TypeError('Can not repeat "'.concat(token.name, '" without a prefix and suffix'));
          }
          route += "(".concat(token.pattern, ")").concat(token.modifier);
        }
      } else {
        route += "(?:".concat(prefix).concat(suffix, ")").concat(token.modifier);
      }
    }
  }
  if (end) {
    if (!strict)
      route += "".concat(delimiterRe, "?");
    route += !options.endsWith ? "$" : "(?=".concat(endsWithRe, ")");
  } else {
    var endToken = tokens[tokens.length - 1];
    var isEndDelimited = typeof endToken === "string" ? delimiterRe.indexOf(endToken[endToken.length - 1]) > -1 : endToken === void 0;
    if (!strict) {
      route += "(?:".concat(delimiterRe, "(?=").concat(endsWithRe, "))?");
    }
    if (!isEndDelimited) {
      route += "(?=".concat(delimiterRe, "|").concat(endsWithRe, ")");
    }
  }
  return new RegExp(route, flags(options));
}
__name(tokensToRegexp, "tokensToRegexp");
function pathToRegexp(path, keys, options) {
  if (path instanceof RegExp)
    return regexpToRegexp(path, keys);
  if (Array.isArray(path))
    return arrayToRegexp(path, keys, options);
  return stringToRegexp(path, keys, options);
}
__name(pathToRegexp, "pathToRegexp");

// C:/Users/Administrator/AppData/Roaming/npm/node_modules/wrangler/templates/pages-template-worker.ts
var escapeRegex = /[.+?^${}()|[\]\\]/g;
function* executeRequest(request) {
  const requestPath = new URL(request.url).pathname;
  for (const route of [...routes].reverse()) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult) {
      for (const handler of route.middlewares.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: mountMatchResult.path
        };
      }
    }
  }
  for (const route of routes) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: true
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult && route.modules.length) {
      for (const handler of route.modules.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: matchResult.path
        };
      }
      break;
    }
  }
}
__name(executeRequest, "executeRequest");
var pages_template_worker_default = {
  async fetch(originalRequest, env, workerContext) {
    let request = originalRequest;
    const handlerIterator = executeRequest(request);
    let data = {};
    let isFailOpen = false;
    const next = /* @__PURE__ */ __name(async (input, init) => {
      if (input !== void 0) {
        let url = input;
        if (typeof input === "string") {
          url = new URL(input, request.url).toString();
        }
        request = new Request(url, init);
      }
      const result = handlerIterator.next();
      if (result.done === false) {
        const { handler, params, path } = result.value;
        const context = {
          request: new Request(request.clone()),
          functionPath: path,
          next,
          params,
          get data() {
            return data;
          },
          set data(value) {
            if (typeof value !== "object" || value === null) {
              throw new Error("context.data must be an object");
            }
            data = value;
          },
          env,
          waitUntil: workerContext.waitUntil.bind(workerContext),
          passThroughOnException: /* @__PURE__ */ __name(() => {
            isFailOpen = true;
          }, "passThroughOnException")
        };
        const response = await handler(context);
        if (!(response instanceof Response)) {
          throw new Error("Your Pages function should return a Response");
        }
        return cloneResponse(response);
      } else if ("ASSETS") {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      } else {
        const response = await fetch(request);
        return cloneResponse(response);
      }
    }, "next");
    try {
      return await next();
    } catch (error2) {
      if (isFailOpen) {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      }
      throw error2;
    }
  }
};
var cloneResponse = /* @__PURE__ */ __name((response) => (
  // https://fetch.spec.whatwg.org/#null-body-status
  new Response(
    [101, 204, 205, 304].includes(response.status) ? null : response.body,
    response
  )
), "cloneResponse");
export {
  pages_template_worker_default as default
};
