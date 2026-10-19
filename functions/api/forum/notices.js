// 前台：论坛公告（公开）
//   GET /api/forum/notices   有效公告
import { json } from '../_utils.js';

export const onRequestGet = async ({ env }) => {
  const { results } = await env.DB.prepare(
    "SELECT id, content, created_at FROM forum_notices WHERE active = 1 ORDER BY id DESC LIMIT 20"
  ).all();
  return json({ list: results });
};
