// GET /api/me/favorites  我的收藏主题列表
import { json, error, authFromRequest } from '../_utils.js';

export const onRequestGet = async ({ env, request }) => {
  const u = await authFromRequest(env, request);
  if (!u) return error('请先登录', 401);
  const { results } = await env.DB.prepare(
    `SELECT f.topic_id, f.created_at AS fav_at, t.title, t.reply_count, t.views,
       b.name AS board_name
     FROM topic_favorites f
     LEFT JOIN forum_topics t ON t.id = f.topic_id
     LEFT JOIN forum_boards b ON b.id = t.board_id
     WHERE f.user_id = ? AND t.deleted = 0 ORDER BY f.id DESC`
  ).bind(u.id).all();
  return json({ list: results });
};
