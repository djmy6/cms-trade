// POST /api/forum/topics/:id/favorite  收藏 / 取消收藏（toggle）
import { json, error, authFromRequest } from '../../../_utils.js';

export const onRequestPost = async ({ env, request, params }) => {
  const u = await authFromRequest(env, request);
  if (!u) return error('请先登录', 401);
  const id = parseInt(params.id, 10);
  const { results: t } = await env.DB.prepare('SELECT id FROM forum_topics WHERE id = ?').bind(id).all();
  if (!t.length) return error('主题不存在', 404);
  const { results: ex } = await env.DB.prepare('SELECT 1 FROM topic_favorites WHERE topic_id = ? AND user_id = ?').bind(id, u.id).all();
  let favorited;
  if (ex.length) {
    await env.DB.prepare('DELETE FROM topic_favorites WHERE topic_id = ? AND user_id = ?').bind(id, u.id).run();
    favorited = false;
  } else {
    await env.DB.prepare('INSERT INTO topic_favorites (topic_id, user_id) VALUES (?, ?)').bind(id, u.id).run();
    favorited = true;
  }
  const { results: c } = await env.DB.prepare('SELECT COUNT(*) AS c FROM topic_favorites WHERE topic_id = ?').bind(id).all();
  return json({ favorited, favorites_count: c[0].c });
};
