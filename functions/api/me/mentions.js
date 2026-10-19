// GET/PUT /api/me/mentions
//   GET : 我的 @提及提醒（未读在前）
//   PUT : 标记已读
import { json, error, readBody, authFromRequest } from '../_utils.js';

export const onRequestGet = async ({ env, request }) => {
  const u = await authFromRequest(env, request);
  if (!u) return error('请先登录', 401);
  const { results } = await env.DB.prepare(
    `SELECT m.*, f.name AS from_name, f.avatar AS from_avatar, t.title AS topic_title
     FROM mentions m
     LEFT JOIN users f ON f.id = m.from_id
     LEFT JOIN forum_topics t ON t.id = m.topic_id
     WHERE m.to_id = ? ORDER BY m.is_read ASC, m.id DESC LIMIT 100`
  ).bind(u.id).all();
  const { results: unread } = await env.DB.prepare('SELECT COUNT(*) AS c FROM mentions WHERE to_id = ? AND is_read = 0').bind(u.id).all();
  return json({ list: results, unread: unread[0].c });
};

export const onRequestPut = async ({ env, request }) => {
  const u = await authFromRequest(env, request);
  if (!u) return error('请先登录', 401);
  const body = await readBody(request);
  const ids = Array.isArray(body.ids) ? body.ids.map((x) => parseInt(x, 10)).filter((x) => x) : [];
  if (ids.length) {
    const ph = ids.map(() => '?').join(',');
    await env.DB.prepare('UPDATE mentions SET is_read = 1 WHERE to_id = ? AND id IN (' + ph + ')').bind(u.id, ...ids).run();
  }
  return json({ updated: true });
};
