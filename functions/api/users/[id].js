// GET /api/users/:id  用户公开资料（头像/签名/积分/等级/发帖回帖数）
import { json, error, ensureStats } from '../_utils.js';

export const onRequestGet = async ({ env, params }) => {
  const id = parseInt(params.id, 10);
  const { results } = await env.DB.prepare(
    'SELECT id, name, role, avatar, signature, created_at FROM users WHERE id = ?'
  ).bind(id).all();
  if (!results.length) return error('用户不存在', 404);
  const user = results[0];
  await ensureStats(env, id);
  const { results: s } = await env.DB.prepare('SELECT points, level, total_signs, sign_streak FROM user_stats WHERE user_id = ?').bind(id).all();
  const { results: fc } = await env.DB.prepare('SELECT COUNT(*) AS c FROM forum_topics WHERE user_id = ? AND deleted = 0').bind(id).all();
  const { results: rc } = await env.DB.prepare('SELECT COUNT(*) AS c FROM forum_replies WHERE user_id = ? AND deleted = 0').bind(id).all();
  return json({ user, stats: s[0] || {}, topic_count: fc[0].c, reply_count: rc[0].c });
};
