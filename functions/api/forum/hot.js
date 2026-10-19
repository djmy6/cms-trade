// GET /api/forum/hot  人气榜（热帖 + 活跃用户）
import { json } from '../_utils.js';

export const onRequestGet = async ({ env }) => {
  const { results: hotTopics } = await env.DB.prepare(
    `SELECT t.id, t.title, t.reply_count, t.views,
       (SELECT COUNT(*) FROM topic_votes v WHERE v.topic_id = t.id AND v.value = 1) AS votes_up,
       u.name AS author_name
     FROM forum_topics t LEFT JOIN users u ON u.id = t.user_id
     WHERE t.approved = 1 AND t.deleted = 0
     ORDER BY (t.reply_count * 3 + t.views) DESC LIMIT 8`
  ).all();
  const { results: hotUsers } = await env.DB.prepare(
    `SELECT s.user_id, s.points, s.level, u.name, u.avatar
     FROM user_stats s LEFT JOIN users u ON u.id = s.user_id
     ORDER BY s.points DESC LIMIT 8`
  ).all();
  return json({ hot_topics: hotTopics, hot_users: hotUsers });
};
