// GET /api/admin/stats   后台：统计
import { json, error, authFromRequest } from '../_utils.js';

export const onRequestGet = async ({ env, request }) => {
  const user = await authFromRequest(env, request);
  if (!user || user.role !== 'admin') return error('需要管理员权限', 403);
  const u = await env.DB.prepare('SELECT COUNT(*) AS c FROM users').all();
  const p = await env.DB.prepare('SELECT COUNT(*) AS c, COALESCE(SUM(refund_amount), 0) AS ra FROM posts').all();
  const admin = await env.DB.prepare("SELECT COUNT(*) AS c FROM users WHERE role='admin'").all();
  return json({ stats: { users: u.results[0].c, posts: p.results[0].c, refundAmount: p.results[0].ra, admins: admin.results[0].c } });
};
