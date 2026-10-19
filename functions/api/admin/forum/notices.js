// 后台：论坛公告管理
//   GET  /api/admin/forum/notices   列表（全部）
//   POST /api/admin/forum/notices   添加 { content, active }
import { json, error, readBody, authFromRequest, isAdmin, logAdmin } from '../../_utils.js';

export const onRequestGet = async ({ env, request }) => {
  const u = await authFromRequest(env, request);
  if (!u || (!isAdmin(u) && u.role !== 'supermod')) return error('需要管理权限', 403);
  const { results } = await env.DB.prepare('SELECT * FROM forum_notices ORDER BY id DESC').all();
  return json({ list: results });
};

export const onRequestPost = async ({ env, request }) => {
  const u = await authFromRequest(env, request);
  if (!u || (!isAdmin(u) && u.role !== 'supermod')) return error('需要管理权限', 403);
  const body = await readBody(request);
  const content = String(body.content || '').trim();
  if (!content) return error('请填写公告内容');
  const active = body.active === 0 ? 0 : 1;
  await env.DB.prepare('INSERT INTO forum_notices (content, active) VALUES (?, ?)').bind(content, active).run();
  await logAdmin(env, u.id, '添加公告', content.slice(0, 50));
  return json({ created: true }, 201);
};
