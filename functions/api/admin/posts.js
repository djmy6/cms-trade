// GET /api/admin/posts   后台：全部帖子
import { json, error, authFromRequest } from '../_utils.js';

export const onRequestGet = async ({ env, request }) => {
  const user = await authFromRequest(env, request);
  if (!user || user.role !== 'admin') return error('需要管理员权限', 403);
  const { results } = await env.DB.prepare(
    `SELECT p.*, u.name AS author_name, u.phone AS author_phone
     FROM posts p LEFT JOIN users u ON u.id = p.user_id ORDER BY p.id DESC`
  ).all();
  return json({ list: results });
};
