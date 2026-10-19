// POST /api/login
// body: { account, password }  或 { phone, password } / { email, password }
// 支持手机号或邮箱作为登录账号
import { json, error, readBody, verifyPassword, signToken } from './_utils.js';

export const onRequestPost = async ({ request, env }) => {
  const body = await readBody(request);
  const account = String(body.account || body.phone || body.email || '').trim().toLowerCase();
  const password = String(body.password || '');

  const { results } = await env.DB.prepare(
    'SELECT id, phone, email, password_hash, salt, name, role FROM users WHERE phone = ? OR email = ?'
  ).bind(account, account).all();
  const user = results[0];
  if (!user) return error('账号未注册');
  const ok = await verifyPassword(password, user.salt, user.password_hash);
  if (!ok) return error('密码错误');

  const token = await signToken({ uid: user.id, role: user.role, exp: Math.floor(Date.now() / 1000) + 7 * 24 * 3600 }, env.SECRET_KEY);
  return json({ token, user: { id: user.id, phone: user.phone, email: user.email, name: user.name, role: user.role } });
};
