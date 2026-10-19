// GET /api/me/notifications  导航未读红点（私信 + @提醒）
import { json, error, authFromRequest } from '../_utils.js';

export const onRequestGet = async ({ env, request }) => {
  const u = await authFromRequest(env, request);
  if (!u) return json({ unread_messages: 0, unread_mentions: 0 });
  const { results: m } = await env.DB.prepare('SELECT COUNT(*) AS c FROM messages WHERE to_id = ? AND is_read = 0').bind(u.id).all();
  const { results: n } = await env.DB.prepare('SELECT COUNT(*) AS c FROM mentions WHERE to_id = ? AND is_read = 0').bind(u.id).all();
  return json({ unread_messages: m[0].c, unread_mentions: n[0].c });
};
