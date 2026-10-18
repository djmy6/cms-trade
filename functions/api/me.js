// GET /api/me
import { json, authFromRequest } from './_utils.js';

export const onRequestGet = async ({ env, request }) => {
  const user = await authFromRequest(env, request);
  if (!user) return json({ ok: false, error: '未登录' }, 401);
  const { results } = await env.DB.prepare(
    'SELECT show_platform, show_shop, show_item, show_amount, show_buyer_account, show_buyer_name, show_real_phone, show_virtual_phone, show_address, show_tracking, show_refund_count, show_refund_amount FROM display_settings WHERE user_id = ?'
  ).bind(user.id).all();
  return json({ user, display: results[0] || {} });
};
