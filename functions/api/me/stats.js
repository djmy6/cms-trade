// GET/POST /api/me/stats
//   GET : 我的成长信息（积分/等级/连续签到/今日是否已签/积分流水）
//   POST: 每日签到（基础 +2，连续满 7 天额外 +5）
import { json, error, authFromRequest, ensureStats, levelFor, cnDate } from '../_utils.js';

export const onRequestGet = async ({ env, request }) => {
  const u = await authFromRequest(env, request);
  if (!u) return error('请先登录', 401);
  await ensureStats(env, u.id);
  const { results } = await env.DB.prepare('SELECT * FROM user_stats WHERE user_id = ?').bind(u.id).all();
  const s = results[0];
  const today = cnDate();
  const { results: log } = await env.DB.prepare('SELECT * FROM sign_log WHERE user_id = ? ORDER BY id DESC LIMIT 20').bind(u.id).all();
  return json({ stats: s, today, signed_today: !!(s && s.last_sign_at === today), log });
};

export const onRequestPost = async ({ env, request }) => {
  const u = await authFromRequest(env, request);
  if (!u) return error('请先登录', 401);
  await ensureStats(env, u.id);
  const { results } = await env.DB.prepare('SELECT * FROM user_stats WHERE user_id = ?').bind(u.id).all();
  const s = results[0];
  const today = cnDate();
  const yesterday = cnDate(-1);
  if (s && s.last_sign_at === today) return error('今天已经签过到啦');
  const streak = s && s.last_sign_at === yesterday ? (s.sign_streak || 0) + 1 : 1;
  const base = 2;
  const bonus = streak >= 7 ? 5 : 0;
  const gain = base + bonus;
  const np = (s && s.points || 0) + gain;
  const nl = levelFor(np);
  await env.DB.prepare(
    'UPDATE user_stats SET points = ?, level = ?, total_signs = total_signs + 1, sign_streak = ?, last_sign_at = ? WHERE user_id = ?'
  ).bind(np, nl, streak, today, u.id).run();
  await env.DB.prepare('INSERT INTO sign_log (user_id, points, reason) VALUES (?, ?, ?)')
    .bind(u.id, gain, '每日签到' + (bonus ? '（连续 ' + streak + ' 天，含连续奖励）' : '')).run();
  return json({ signed: true, points: np, level: nl, streak, base, bonus, gain });
};
