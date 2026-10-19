// POST /api/forum/topics/:id/report  {reason}  举报主题（待审核）
import { json, error, readBody, authFromRequest } from '../../../_utils.js';

export const onRequestPost = async ({ env, request, params }) => {
  const u = await authFromRequest(env, request);
  if (!u) return error('请先登录', 401);
  const id = parseInt(params.id, 10);
  const body = await readBody(request);
  const reason = String(body.reason || '').trim();
  if (!reason) return error('请填写举报理由');
  const { results: t } = await env.DB.prepare('SELECT id FROM forum_topics WHERE id = ?').bind(id).all();
  if (!t.length) return error('主题不存在', 404);
  const { results: ex } = await env.DB.prepare('SELECT 1 FROM topic_reports WHERE topic_id = ? AND user_id = ? AND status = 0').bind(id, u.id).all();
  if (ex.length) return error('你已举报过该主题，等待处理');
  await env.DB.prepare('INSERT INTO topic_reports (topic_id, user_id, reason) VALUES (?, ?, ?)').bind(id, u.id, reason).run();
  return json({ reported: true }, 201);
};
