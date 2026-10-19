// GET/POST/PUT /api/me/messages
//   GET : 我的私信列表（收 + 发，含对方信息）+ 未读数
//   POST: {to_user, content} 发私信（to_user 支持用户 id 或昵称）
//   PUT : {ids:[...]} 标记已读
import { json, error, readBody, authFromRequest } from '../_utils.js';

export const onRequestGet = async ({ env, request }) => {
  const u = await authFromRequest(env, request);
  if (!u) return error('请先登录', 401);
  const { results } = await env.DB.prepare(
    `SELECT m.*, f.name AS from_name, f.avatar AS from_avatar, t.name AS to_name
     FROM messages m
     LEFT JOIN users f ON f.id = m.from_id
     LEFT JOIN users t ON t.id = m.to_id
     WHERE m.from_id = ? OR m.to_id = ? ORDER BY m.id DESC LIMIT 100`
  ).bind(u.id, u.id).all();
  const { results: unread } = await env.DB.prepare('SELECT COUNT(*) AS c FROM messages WHERE to_id = ? AND is_read = 0').bind(u.id).all();
  return json({ list: results, unread: unread[0].c });
};

export const onRequestPost = async ({ env, request }) => {
  const u = await authFromRequest(env, request);
  if (!u) return error('请先登录', 401);
  const body = await readBody(request);
  const content = String(body.content || '').trim();
  const toUser = String(body.to_user || '').trim();
  if (!content) return error('请填写私信内容');
  if (!toUser) return error('请填写收件人');
  const toId = parseInt(toUser, 10) || 0;
  let { results } = await env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(toId).all();
  if (!results.length) {
    results = (await env.DB.prepare('SELECT id FROM users WHERE name = ?').bind(toUser).all()).results;
  }
  if (!results.length) return error('收件人不存在');
  const target = results[0].id;
  if (target === u.id) return error('不能给自己发私信');
  await env.DB.prepare('INSERT INTO messages (from_id, to_id, content) VALUES (?, ?, ?)').bind(u.id, target, content).run();
  return json({ sent: true }, 201);
};

export const onRequestPut = async ({ env, request }) => {
  const u = await authFromRequest(env, request);
  if (!u) return error('请先登录', 401);
  const body = await readBody(request);
  const ids = Array.isArray(body.ids) ? body.ids.map((x) => parseInt(x, 10)).filter((x) => x) : [];
  if (ids.length) {
    const ph = ids.map(() => '?').join(',');
    await env.DB.prepare('UPDATE messages SET is_read = 1 WHERE to_id = ? AND id IN (' + ph + ')').bind(u.id, ...ids).run();
  }
  return json({ updated: true });
};
