// 论坛主题详情 / 删除
//   GET    /api/forum/topics/:id   主题详情 + 回帖列表
//   DELETE /api/forum/topics/:id   删除主题（作者 / 管理员）
import { json, error, authFromRequest } from '../../_utils.js';

export const onRequestGet = async ({ env, params }) => {
  const id = parseInt(params.id, 10);
  await env.DB.prepare('UPDATE forum_topics SET views = views + 1 WHERE id = ?').bind(id).run();
  const { results: t } = await env.DB.prepare(
    `SELECT t.*, b.name AS board_name, u.name AS author_name, u.phone AS author_phone
     FROM forum_topics t
     LEFT JOIN forum_boards b ON b.id = t.board_id
     LEFT JOIN users u ON u.id = t.user_id
     WHERE t.id = ?`
  ).bind(id).all();
  if (!t.length) return error('主题不存在', 404);
  const topic = t[0];
  const { results: replies } = await env.DB.prepare(
    `SELECT r.*, u.name AS author_name, u.phone AS author_phone
     FROM forum_replies r LEFT JOIN users u ON u.id = r.user_id
     WHERE r.topic_id = ? ORDER BY r.id ASC`
  ).bind(id).all();
  return json({ topic, replies });
};

export const onRequestDelete = async ({ env, request, params }) => {
  const u = await authFromRequest(env, request);
  if (!u) return error('请先登录', 401);
  const id = parseInt(params.id, 10);
  const { results } = await env.DB.prepare('SELECT user_id FROM forum_topics WHERE id = ?').bind(id).all();
  if (!results.length) return error('主题不存在', 404);
  if (results[0].user_id !== u.id && u.role !== 'admin') return error('无权删除', 403);
  await env.DB.prepare('DELETE FROM forum_replies WHERE topic_id = ?').bind(id).run();
  await env.DB.prepare('DELETE FROM forum_topics WHERE id = ?').bind(id).run();
  return json({ deleted: true, id });
};
