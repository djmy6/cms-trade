// POST /api/login
// body: { phone, password }
import { json, error, readBody, verifyPassword, signToken } from './_utils.js';

export const onRequestPost = async ({ request, env }) => {
  const body = await readBody(request);
  const phone = String(body.phone || '').trim();
  const password = String(body.password || '');

  const { results } = await env.DB.prepare(
    'SELECT id, phone, password_hash, salt, name, role FROM users WHERE phone = ?'
  ).bind(phone).all();
  const user = results[0];
  if (!user) return error('手机号未注册');
  const ok = await verifyPassword(password, user.salt, user.password_hash);
  if (!ok) return error('密码错误');

  const token = await signToken({ uid: user.id, role: user.role, exp: Math.floor(Date.now() / 1000) + 7 * 24 * 3600 }, env.SECRET_KEY);
  return json({ token, user: { id: user.id, phone: user.phone, name: user.name, role: user.role } });
};
