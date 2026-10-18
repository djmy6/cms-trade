// GET /api/admin/users   后台：用户列表（含帖数）
import { json, error, authFromRequest } from '../_utils.js';

export const onRequestGet = async ({ env, request }) => {
  const user = await authFromRequest(env, request);
  if (!user || user.role !== 'admin') return error('需要管理员权限', 403);
  const { results } = await env.DB.prepare(
    `SELECT u.id, u.phone, u.name, u.role, u.created_at,
       (SELECT COUNT(*) FROM posts p WHERE p.user_id = u.id) AS post_count
     FROM users u ORDER BY u.id DESC`
  ).all();
  return json({ list: results });
};
