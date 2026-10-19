// POST /api/forum/topics/:id/reply   回帖（登录，含敏感词过滤 / 锁定拦截）
import { json, error, readBody, authFromRequest, isBanned, filterBannedWords } from '../../../_utils.js';

export const onRequestPost = async ({ env, request, params }) => {
  const u = await authFromRequest(env, request);
  if (!u) return error('请先登录', 401);
  if (isBanned(u)) return error('你已被禁言，无法回帖');
  const topicId = parseInt(params.id, 10);
  let content = String((await readBody(request)).content || '').trim();
  if (!content) return error('请填写回复内容');
  const t = await env.DB.prepare(
    `SELECT t.id, t.locked, t.deleted, b.allow_reply
     FROM forum_topics t LEFT JOIN forum_boards b ON b.id = t.board_id WHERE t.id = ?`
  ).bind(topicId).all();
  if (!t.results.length) return error('主题不存在', 404);
  if (t.results[0].deleted) return error('主题已被删除');
  if (t.results[0].locked) return error('该主题已锁定，无法回帖');
  if (t.results[0].allow_reply === 0) return error('该板块已关闭回帖');
  content = await filterBannedWords(env, content);
  await env.DB.prepare('INSERT INTO forum_replies (topic_id, user_id, content) VALUES (?, ?, ?)').bind(topicId, u.id, content).run();
  await env.DB.prepare('UPDATE forum_topics SET reply_count = reply_count + 1 WHERE id = ?').bind(topicId).run();
  return json({ created: true }, 201);
};
