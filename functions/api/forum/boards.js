// 论坛板块
//   GET  /api/forum/boards   板块列表（含主题数）
//   POST /api/forum/boards   新建板块（管理员）
import { json, error, readBody, authFromRequest } from '../_utils.js';

export const onRequestGet = async ({ env }) => {
  const { results } = await env.DB.prepare(
    `SELECT b.*, (SELECT COUNT(*) FROM forum_topics t WHERE t.board_id = b.id) AS topic_count
     FROM forum_boards b ORDER BY b.sort_order, b.id`
  ).all();
  return json({ list: results });
};

export const onRequestPost = async ({ env, request }) => {
  const u = await authFromRequest(env, request);
  if (!u || u.role !== 'admin') return error('需要管理员权限', 403);
  const body = await readBody(request);
  const name = String(body.name || '').trim();
  if (!name) return error('请填写板块名称');
  const desc = String(body.description || '').trim();
  const sort = parseInt(body.sort_order, 10) || 0;
  await env.DB.prepare('INSERT INTO forum_boards (name, description, sort_order) VALUES (?, ?, ?)').bind(name, desc, sort).run();
  return json({ created: true }, 201);
};
