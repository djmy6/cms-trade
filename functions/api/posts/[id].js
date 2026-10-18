// /api/posts/[id]
// GET 详情 | PUT 编辑(作者/管理员) | DELETE 删除(作者/管理员)
import { json, error, readBody, authFromRequest } from '../_utils.js';
import { FIELDS } from '../posts.js';

export const onRequestGet = async ({ env, request, params }) => {
  const id = parseInt(params.id, 10);
  const viewer = await authFromRequest(env, request);
  const isAdmin = !!(viewer && viewer.role === 'admin');
  const { results } = await env.DB.prepare(
    `SELECT p.*, u.name AS author_name FROM posts p LEFT JOIN users u ON u.id = p.user_id WHERE p.id = ?`
  ).bind(id).all();
  if (!results[0]) return error('帖子不存在', 404);
  const post = results[0];
  if (!isAdmin) {
    const { results: ss } = await env.DB.prepare('SELECT * FROM display_settings WHERE user_id = ?').bind(post.user_id).all();
    const settings = ss[0] || {};
    const map = {
      platform: 'show_platform', shop_name: 'show_shop', item: 'show_item', amount: 'show_amount',
      buyer_account: 'show_buyer_account', buyer_name: 'show_buyer_name',
      buyer_real_phone: 'show_real_phone', buyer_virtual_phone: 'show_virtual_phone',
      buyer_address: 'show_address', tracking_no: 'show_tracking',
      refund_count: 'show_refund_count', refund_amount: 'show_refund_amount',
    };
    for (const f of FIELDS) if (map[f] && settings[map[f]] === 0) post[f] = '';
  }
  return json({ post });
};

export const onRequestPut = async ({ env, request, params }) => {
  const user = await authFromRequest(env, request);
  if (!user) return error('请先登录', 401);
  const id = parseInt(params.id, 10);
  const { results } = await env.DB.prepare('SELECT user_id FROM posts WHERE id = ?').bind(id).all();
  if (!results[0]) return error('帖子不存在', 404);
  if (user.role !== 'admin' && results[0].user_id !== user.id) return error('无权编辑该帖子', 403);
  const body = await readBody(request);
  const p = {};
  for (const f of FIELDS) p[f] = body[f] !== undefined ? String(body[f]).trim() : '';
  if (typeof p.refund_count === 'string') p.refund_count = parseInt(p.refund_count, 10) || 0;
  const addrParts = ['address_province', 'address_city', 'address_district', 'address_street', 'address_detail']
    .map((k) => String(body[k] || '').trim()).filter(Boolean);
  if (addrParts.length) p.buyer_address = addrParts.join('');
  const aProv = String(body.address_province || '').trim();
  const aCity = String(body.address_city || '').trim();
  const aDist = String(body.address_district || '').trim();
  const aStreet = String(body.address_street || '').trim();
  const aDetail = String(body.address_detail || '').trim();
  const extra = {};
  for (const k of Object.keys(body)) if (k.startsWith('cf_')) extra[k.slice(3)] = String(body[k] ?? '');
  const extraJson = JSON.stringify(extra);
  await env.DB.prepare(
    `UPDATE posts SET platform=?, shop_name=?, item=?, amount=?, buyer_account=?, buyer_name=?,
       buyer_real_phone=?, buyer_virtual_phone=?, buyer_address=?, tracking_no=?, refund_count=?, refund_amount=?,
       address_province=?, address_city=?, address_district=?, address_street=?, address_detail=?, extra_fields=?
     WHERE id=?`
  ).bind(p.platform, p.shop_name, p.item, p.amount, p.buyer_account, p.buyer_name,
    p.buyer_real_phone, p.buyer_virtual_phone, p.buyer_address, p.tracking_no, p.refund_count, p.refund_amount,
    aProv, aCity, aDist, aStreet, aDetail, extraJson, id).run();
  return json({ updated: true });
};

export const onRequestDelete = async ({ env, request, params }) => {
  const user = await authFromRequest(env, request);
  if (!user) return error('请先登录', 401);
  const id = parseInt(params.id, 10);
  const { results } = await env.DB.prepare('SELECT user_id FROM posts WHERE id = ?').bind(id).all();
  if (!results[0]) return error('帖子不存在', 404);
  if (user.role !== 'admin' && results[0].user_id !== user.id) return error('无权删除该帖子', 403);
  await env.DB.prepare('DELETE FROM posts WHERE id = ?').bind(id).run();
  return json({ deleted: true });
};
