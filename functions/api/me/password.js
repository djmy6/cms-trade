// PUT /api/me/password  修改当前登录用户的登录密码（须验证旧密码）
import { json, error, readBody, authFromRequest, verifyPassword, generateSalt, hashPassword } from '../_utils.js';

export const onRequestPut = async ({ request, env }) => {
  const u = await authFromRequest(env, request);
  if (!u) return error('请先登录', 401);

  const body = await readBody(request);
  const oldp = String(body.old_password || '');
  const newp = String(body.new_password || '');
  if (!oldp) return error('请填写当前密码');
  if (newp.length < 6) return error('新密码至少 6 位');

  const { results } = await env.DB.prepare(
    'SELECT password_hash, salt FROM users WHERE id = ?'
  ).bind(u.id).all();
  const row = results[0];
  if (!row) return error('用户不存在');

  const ok = await verifyPassword(oldp, row.salt, row.password_hash);
  if (!ok) return error('当前密码不正确');

  const salt = generateSalt();
  const hash = await hashPassword(newp, salt);
  await env.DB.prepare(
    'UPDATE users SET password_hash = ?, salt = ? WHERE id = ?'
  ).bind(hash, salt, u.id).run();

  return json({ ok: true, message: '密码已修改' });
};
