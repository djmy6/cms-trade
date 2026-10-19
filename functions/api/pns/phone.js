// POST /api/pns/phone  用一键登录 spToken 换取手机号，并自动注册/登录
// body: { spToken }
import { json, error, readBody, generateSalt, hashPassword, signToken } from '../_utils.js';
import { aliyunPnsRpc } from './_aliyun.js';

const PHONE_RE = /^1[3-9]\d{9}$/;

export const onRequestPost = async ({ request, env }) => {
  const body = await readBody(request);
  const spToken = String(body.spToken || '').trim();
  if (!spToken) return error('缺少 spToken');

  let r;
  try {
    r = await aliyunPnsRpc(env, 'GetPhoneWithToken', { SpToken: spToken });
  } catch (e) {
    return error('取号失败：' + e.message);
  }
  if (r.Code !== 'OK') return error('取号失败：' + (r.Message || r.Code));

  const phone = String(r.Data && r.Data.Mobile || '').trim();
  if (!PHONE_RE.test(phone)) return error('取号失败：手机号异常');

  // 已注册 → 直接登录；未注册 → 自动注册（一键登录，密码随机、邮箱留空）
  const exist = await env.DB.prepare('SELECT id, name, role, email FROM users WHERE phone = ?').bind(phone).all();
  let uid, user;
  if (exist.results.length) {
    const row = exist.results[0];
    uid = row.id;
    user = { id: uid, phone, name: row.name, role: row.role, email: row.email || '' };
  } else {
    const salt = generateSalt();
    const hash = await hashPassword('PNS_' + phone + '_' + Math.random().toString(36).slice(2), salt);
    const name = '用户' + phone.slice(-4);
    await env.DB.prepare(
      'INSERT INTO users (phone, email, password_hash, salt, name, role) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(phone, '', hash, salt, name, 'user').run();
    const us = await env.DB.prepare('SELECT id FROM users WHERE phone = ?').bind(phone).all();
    uid = us.results[0].id;
    await env.DB.prepare('INSERT OR IGNORE INTO display_settings (user_id) VALUES (?)').bind(uid).run();
    user = { id: uid, phone, name, role: 'user', email: '' };
  }

  const token = await signToken({ uid, role: user.role, exp: Math.floor(Date.now() / 1000) + 7 * 24 * 3600 }, env.SECRET_KEY);
  return json({ token, user });
};
