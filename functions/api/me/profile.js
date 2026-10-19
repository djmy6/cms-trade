// PUT /api/me/profile  修改昵称 / 头像 / 个性签名
import { json, error, readBody, authFromRequest } from '../_utils.js';

export const onRequestPut = async ({ env, request }) => {
  const u = await authFromRequest(env, request);
  if (!u) return error('请先登录', 401);
  const body = await readBody(request);
  const name = String(body.name || '').trim();
  const avatar = String(body.avatar || '').trim();
  const signature = String(body.signature || '').trim();
  if (avatar && avatar.length > 200000) return error('头像文件过大');
  if (signature && signature.length > 200) return error('个性签名过长');
  if (name.length > 30) return error('昵称过长');
  await env.DB.prepare('UPDATE users SET name = ?, avatar = ?, signature = ? WHERE id = ?').bind(name, avatar, signature, u.id).run();
  const { results } = await env.DB.prepare('SELECT id, phone, name, role, email, avatar, signature FROM users WHERE id = ?').bind(u.id).all();
  return json({ user: results[0] });
};
