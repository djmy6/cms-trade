// GET /api/admin/users?keyword=   后台：用户列表（含帖数）
import { json, error, authFromRequest, isAdmin } from '../_utils.js';

export const onRequestGet = async ({ env, request }) => {
  const user = await authFromRequest(env, request);
  if (!isAdmin(user) && user.role !== 'supermod') return error('需要管理权限', 403);
  const url = new URL(request.url);
  const kw = (url.searchParams.get('keyword') || '').trim();
  let where = '', bind = [];
  if (kw) { where = 'WHERE u.phone LIKE ? OR u.name LIKE ?'; bind = ['%' + kw + '%', '%' + kw + '%']; }
  const { results } = await env.DB.prepare(
    `SELECT u.id, u.phone, u.name, u.role, u.created_at,
       (SELECT COUNT(*) FROM posts p WHERE p.user_id = u.id) AS post_count
     FROM users u ${where} ORDER BY u.id DESC`
  ).bind(...bind).all();
  return json({ list: results });
};
