// GET /api/settings  查看当前用户对外显示设置
// PUT /api/settings  更新对外显示设置（哪些字段对外可见）
import { json, error, readBody, authFromRequest } from './_utils.js';

const KEYS = [
  'show_platform', 'show_shop', 'show_item', 'show_amount',
  'show_buyer_account', 'show_buyer_name', 'show_real_phone', 'show_virtual_phone',
  'show_address', 'show_tracking', 'show_refund_count', 'show_refund_amount',
];

export const onRequestGet = async ({ env, request }) => {
  const user = await authFromRequest(env, request);
  if (!user) return error('请先登录', 401);
  const { results } = await env.DB.prepare('SELECT * FROM display_settings WHERE user_id = ?').bind(user.id).all();
  return json({ settings: results[0] || {} });
};

export const onRequestPut = async ({ env, request }) => {
  const user = await authFromRequest(env, request);
  if (!user) return error('请先登录', 401);
  const body = await readBody(request);
  const set = {};
  for (const k of KEYS) {
    if (body[k] !== undefined) set[k] = body[k] ? 1 : 0;
  }
  const cols = Object.keys(set);
  if (!cols.length) return error('没有可更新的设置项');
  const assigns = cols.map((k) => `${k} = ?`).join(', ');
  await env.DB.prepare(
    `UPDATE display_settings SET ${assigns}, updated_at = datetime('now','localtime') WHERE user_id = ?`
  ).bind(...cols.map((k) => set[k]), user.id).run();
  return json({ updated: true, settings: set });
};
