// POST /api/forum/topics/:id/vote  {value:1|-1}  顶/踩（给作者 +1 / -1 积分）
import { json, error, readBody, authFromRequest, addPoints } from '../../../_utils.js';

export const onRequestPost = async ({ env, request, params }) => {
  const u = await authFromRequest(env, request);
  if (!u) return error('请先登录', 401);
  const id = parseInt(params.id, 10);
  const body = await readBody(request);
  const value = parseInt(body.value, 10) === -1 ? -1 : 1;
  const { results: t } = await env.DB.prepare('SELECT user_id FROM forum_topics WHERE id = ?').bind(id).all();
  if (!t.length) return error('主题不存在', 404);
  if (t[0].user_id === u.id) return error('不能给自己的主题投票');
  const { results: ex } = await env.DB.prepare('SELECT value FROM topic_votes WHERE topic_id = ? AND user_id = ?').bind(id, u.id).all();
  if (ex.length) {
    if (ex[0].value === value) return error('你已经投过票了');
    await env.DB.prepare("UPDATE topic_votes SET value = ?, created_at = datetime('now','localtime') WHERE topic_id = ? AND user_id = ?").bind(value, id, u.id).run();
    await addPoints(env, t[0].user_id, ex[0].value === 1 ? -1 : 1, '主题被改票', id).catch(() => {});
    await addPoints(env, t[0].user_id, value === 1 ? 1 : -1, value === 1 ? '主题被点赞' : '主题被点踩', id).catch(() => {});
  } else {
    await env.DB.prepare('INSERT INTO topic_votes (topic_id, user_id, value) VALUES (?, ?, ?)').bind(id, u.id, value).run();
    await addPoints(env, t[0].user_id, value === 1 ? 1 : -1, value === 1 ? '主题被点赞' : '主题被点踩', id).catch(() => {});
  }
  const { results: cu } = await env.DB.prepare('SELECT COUNT(*) AS c FROM topic_votes WHERE topic_id = ? AND value = 1').bind(id).all();
  const { results: cd } = await env.DB.prepare('SELECT COUNT(*) AS c FROM topic_votes WHERE topic_id = ? AND value = -1').bind(id).all();
  return json({ voted: value, votes_up: cu[0].c, votes_down: cd[0].c });
};
