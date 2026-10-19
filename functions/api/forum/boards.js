// 论坛板块
//   GET  /api/forum/boards   板块树（一级+子版块，含版主/开放/主题数）
//   POST /api/forum/boards   新建板块（管理员）
import { json, error, readBody, authFromRequest, isAdmin } from '../_utils.js';

export const onRequestGet = async ({ env }) => {
  const { results } = await env.DB.prepare(
    `SELECT b.*, (SELECT COUNT(*) FROM forum_topics t WHERE t.board_id = b.id AND t.deleted = 0 AND t.approved = 1) AS topic_count
     FROM forum_boards b ORDER BY b.sort_order, b.id`
  ).all();
  const { results: users } = await env.DB.prepare('SELECT id, name, phone FROM users').all();
  const nameById = {};
  users.forEach((u) => { nameById[u.id] = u.name || u.phone; });
  const tree = [], childrenMap = {};
  for (const b of results) {
    b.moderator_names = String(b.moderator_ids || '').split(',').map((x) => parseInt(x, 10)).filter((x) => x)
      .map((id) => nameById[id] || '').filter(Boolean);
    b.children = [];
    if (b.parent_id) { (childrenMap[b.parent_id] = childrenMap[b.parent_id] || []).push(b); }
    else tree.push(b);
  }
  for (const root of tree) root.children = childrenMap[root.id] || [];
  return json({ list: tree });
};

export const onRequestPost = async ({ env, request }) => {
  const u = await authFromRequest(env, request);
  if (!isAdmin(u)) return error('需要管理员权限', 403);
  const body = await readBody(request);
  const name = String(body.name || '').trim();
  if (!name) return error('请填写板块名称');
  const parentId = parseInt(body.parent_id, 10) || 0;
  const description = String(body.description || '').trim();
  const icon = String(body.icon || '').trim();
  const color = String(body.color || '').trim();
  const moderatorIds = String(body.moderator_ids || '').trim();
  const allowPost = body.allow_post === 0 ? 0 : 1;
  const allowReply = body.allow_reply === 0 ? 0 : 1;
  const sort = parseInt(body.sort_order, 10) || 0;
  await env.DB.prepare(
    'INSERT INTO forum_boards (parent_id, name, description, icon, color, moderator_ids, allow_post, allow_reply, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(parentId, name, description, icon, color, moderatorIds, allowPost, allowReply, sort).run();
  return json({ created: true }, 201);
};
