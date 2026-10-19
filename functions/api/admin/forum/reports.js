// 后台：举报列表
//   GET /api/admin/forum/reports   举报列表（待处理在前）+ 待处理数
import { json, error, authFromRequest, isAdmin } from '../../_utils.js';

export const onRequestGet = async ({ env, request }) => {
  const u = await authFromRequest(env, request);
  if (!u || (!isAdmin(u) && u.role !== 'supermod')) return error('需要管理权限', 403);
  const { results } = await env.DB.prepare(
    `SELECT r.*, u.name AS reporter_name, t.title AS topic_title
     FROM topic_reports r
     LEFT JOIN users u ON u.id = r.user_id
     LEFT JOIN forum_topics t ON t.id = r.topic_id
     ORDER BY r.status ASC, r.id DESC LIMIT 100`
  ).all();
  const { results: pending } = await env.DB.prepare('SELECT COUNT(*) AS c FROM topic_reports WHERE status = 0').all();
  return json({ list: results, pending: pending[0].c });
};
