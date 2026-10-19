// 后台：论坛敏感词管理
//   GET  /api/admin/forum/banned-words   列表
//   POST /api/admin/forum/banned-words   添加 { word }
import { json, error, readBody, authFromRequest, isAdmin, logAdmin } from '../../_utils.js';

export const onRequestGet = async ({ env, request }) => {
  const u = await authFromRequest(env, request);
  if (!isAdmin(u) && u.role !== 'supermod') return error('需要管理权限', 403);
  const { results } = await env.DB.prepare('SELECT * FROM forum_banned_words ORDER BY id DESC').all();
  return json({ list: results });
};

export const onRequestPost = async ({ env, request }) => {
  const u = await authFromRequest(env, request);
  if (!isAdmin(u) && u.role !== 'supermod') return error('需要管理权限', 403);
  const body = await readBody(request);
  const word = String(body.word || '').trim();
  if (!word) return error('请填写敏感词');
  await env.DB.prepare('INSERT OR IGNORE INTO forum_banned_words (word) VALUES (?)').bind(word).run();
  await logAdmin(env, u.id, '添加敏感词', word);
  return json({ created: true }, 201);
};
