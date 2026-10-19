// POST /api/register
// body: { phone, code, email, emailCode, password, name }
import { json, error, readBody, generateSalt, hashPassword, signToken } from './_utils.js';

const PHONE_RE = /^1[3-9]\d{9}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const onRequestPost = async ({ request, env }) => {
  const body = await readBody(request);
  const phone = String(body.phone || '').trim();
  const code = String(body.code || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const emailCode = String(body.emailCode || '').trim();
  const password = String(body.password || '');
  const name = String(body.name || '').trim();

  if (!PHONE_RE.test(phone)) return error('手机号格式不正确');
  if (!email) return error('请填写邮箱');
  if (!EMAIL_RE.test(email)) return error('邮箱格式不正确');
  if (password.length < 6) return error('密码至少 6 位');
  if (!code) return error('请填写短信验证码');
  if (!emailCode) return error('请填写邮箱验证码');

  // 校验短信验证码
  const now = Date.now();
  const { results } = await env.DB.prepare(
    `SELECT id, code, expires_at FROM sms_codes
     WHERE phone = ? AND purpose = 'register' AND used = 0
     ORDER BY id DESC LIMIT 1`
  ).bind(phone).all();
  const rec = results[0];
  if (!rec) return error('请先获取短信验证码');
  if (rec.expires_at < now) return error('短信验证码已过期，请重新获取');
  if (rec.code !== code) return error('短信验证码不正确');

  // 校验邮箱验证码
  const ec = await env.DB.prepare(
    `SELECT id, code, expires_at FROM email_codes
     WHERE email = ? AND purpose = 'register' AND used = 0
     ORDER BY id DESC LIMIT 1`
  ).bind(email).all();
  const erec = ec.results[0];
  if (!erec) return error('请先获取邮箱验证码');
  if (erec.expires_at < now) return error('邮箱验证码已过期，请重新获取');
  if (erec.code !== emailCode) return error('邮箱验证码不正确');

  // 手机号是否已注册
  const exist = await env.DB.prepare('SELECT id FROM users WHERE phone = ?').bind(phone).all();
  if (exist.results.length) return error('该手机号已注册，请直接登录');

  // 邮箱是否已注册
  const eexist = await env.DB.prepare('SELECT id FROM users WHERE email = ? AND email != ?').bind(email, '').all();
  if (eexist.results.length) return error('该邮箱已注册，请直接登录');

  // 创建用户
  const salt = generateSalt();
  const hash = await hashPassword(password, salt);
  await env.DB.prepare(
    'INSERT INTO users (phone, email, password_hash, salt, name, role) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(phone, email, hash, salt, name, 'user').run();
  const { results: us } = await env.DB.prepare('SELECT id FROM users WHERE phone = ?').bind(phone).all();
  const uid = us[0].id;

  // 标记两个验证码已用
  await env.DB.prepare('UPDATE sms_codes SET used = 1 WHERE id = ?').bind(rec.id).run();
  await env.DB.prepare('UPDATE email_codes SET used = 1 WHERE id = ?').bind(erec.id).run();
  // 初始化默认显示设置
  await env.DB.prepare(
    'INSERT OR IGNORE INTO display_settings (user_id) VALUES (?)'
  ).bind(uid).run();

  const token = await signToken({ uid, role: 'user', exp: Math.floor(Date.now() / 1000) + 7 * 24 * 3600 }, env.SECRET_KEY);
  return json({ token, user: { id: uid, phone, email, name, role: 'user' } });
};
