// GET/POST /api/me/follow
//   GET : 我的关注列表
//   POST: {user_id} 关注 / 取消（toggle）
import { json, error, readBody, authFromRequest } from '../_utils.js';

export const onRequestGet = async ({ env, request }) => {
  const u = await authFromRequest(env, request);
  if (!u) return error('请先登录', 401);
  const { results } = await env.DB.prepare(
    `SELECT f.following_id, f.created_at, u.name, u.avatar, u.signature,
       (SELECT COUNT(*) FROM follows x WHERE x.follower_id = f.following_id) AS followers
     FROM follows f LEFT JOIN users u ON u.id = f.following_id
     WHERE f.follower_id = ? ORDER BY f.id DESC`
  ).bind(u.id).all();
  return json({ list: results });
};

export const onRequestPost = async ({ env, request }) => {
  const u = await authFromRequest(env, request);
  if (!u) return error('请先登录', 401);
  const body = await readBody(request);
  const target = parseInt(body.user_id, 10) || 0;
  if (!target) return error('请填写关注对象');
  if (target === u.id) return error('不能关注自己');
  const { results: ex } = await env.DB.prepare('SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?').bind(u.id, target).all();
  let following;
  if (ex.length) {
    await env.DB.prepare('DELETE FROM follows WHERE follower_id = ? AND following_id = ?').bind(u.id, target).run();
    following = false;
  } else {
    await env.DB.prepare('INSERT INTO follows (follower_id, following_id) VALUES (?, ?)').bind(u.id, target).run();
    following = true;
  }
  return json({ following });
};
