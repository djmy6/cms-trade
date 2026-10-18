// POST /api/forum/topics/:id/reply   回帖（登录）
import { json, error, readBody, authFromRequest } from '../../_utils.js';

export const onRequestPost = async ({ env, request, params }) => {
  const u = await authFromRequest(env, request);
  if (!u) return error('请先登录', 401);
  const topicId = parseInt(params.id, 10);
  const body = await readBody(request);
  const content = String(body.content || '').trim();
  if (!content) return error('请填写回复内容');
  const t = await env.DB.prepare('SELECT id FROM forum_topics WHERE id = ?').bind(topicId).all();
  if (!t.results.length) return error('主题不存在', 404);
  await env.DB.prepare('INSERT INTO forum_replies (topic_id, user_id, content) VALUES (?, ?, ?)').bind(topicId, u.id, content).run();
  await env.DB.prepare('UPDATE forum_topics SET reply_count = reply_count + 1 WHERE id = ?').bind(topicId).run();
  return json({ created: true }, 201);
};
