// 后台：论坛数据统计
//   GET /api/admin/forum/stats   会员数 / 主题 / 回复 / 板块分布 / 待审 / 回收站等
import { json, error, authFromRequest, isAdmin } from '../../_utils.js';

export const onRequestGet = async ({ env, request }) => {
  const u = await authFromRequest(env, request);
  if (!u || (!isAdmin(u) && u.role !== 'supermod')) return error('需要管理权限', 403);

  const q = async (sql, ...bind) => (await env.DB.prepare(sql).bind(...bind).all()).results[0].c;
  const users = await q('SELECT COUNT(*) AS c FROM users');
  const topics = await q('SELECT COUNT(*) AS c FROM forum_topics WHERE deleted = 0');
  const replies = await q('SELECT COUNT(*) AS c FROM forum_replies WHERE deleted = 0');
  const boards = await q('SELECT COUNT(*) AS c FROM forum_boards');
  const bannedWords = await q('SELECT COUNT(*) AS c FROM forum_banned_words');
  const notices = await q('SELECT COUNT(*) AS c FROM forum_notices WHERE active = 1');
  const pending = await q('SELECT COUNT(*) AS c FROM forum_topics WHERE approved = 0 AND deleted = 0');
  const trashed = await q('SELECT COUNT(*) AS c FROM forum_topics WHERE deleted = 1');
  // v6 指标
  const reportsPending = await q('SELECT COUNT(*) AS c FROM topic_reports WHERE status = 0');
  const signTotal = await q('SELECT COUNT(*) AS c FROM sign_log');
  const totalPoints = await q('SELECT COALESCE(SUM(points),0) AS c FROM user_stats');
  const signedToday = await q('SELECT COUNT(*) AS c FROM user_stats WHERE last_sign_at = ?', new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10));

  const { results: boardDist } = await env.DB.prepare(
    `SELECT b.name, b.icon, (SELECT COUNT(*) FROM forum_topics t WHERE t.board_id = b.id AND t.deleted = 0) AS topic_count
     FROM forum_boards b ORDER BY topic_count DESC LIMIT 15`
  ).all();

  return json({ stats: { users, topics, replies, boards, bannedWords, notices, pending, trashed, boardDist, reports_pending: reportsPending, sign_total: signTotal, total_points: totalPoints, signed_today: signedToday } });
};
