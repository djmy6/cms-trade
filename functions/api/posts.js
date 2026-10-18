// GET /api/posts       列表 / 搜索
//   ?q=关键词&field=account|name|address|tracking&platform=xx&page=1&size=20
//   field 省略时在 买家账号/买家姓名/买家地址/快递单号 中模糊搜索
// POST /api/posts      发布交易记录帖（需登录）
import { json, error, readBody, authFromRequest } from './_utils.js';

export const FIELDS = [
  'platform', 'shop_name', 'item', 'amount',
  'buyer_account', 'buyer_name', 'buyer_real_phone', 'buyer_virtual_phone',
  'buyer_address', 'tracking_no', 'refund_count', 'refund_amount',
];

// 展示时按作者对外显示设置隐藏字段
function maskPost(post, settings) {
  if (!settings) return post;
  const map = {
    platform: 'show_platform', shop_name: 'show_shop', item: 'show_item', amount: 'show_amount',
    buyer_account: 'show_buyer_account', buyer_name: 'show_buyer_name',
    buyer_real_phone: 'show_real_phone', buyer_virtual_phone: 'show_virtual_phone',
    buyer_address: 'show_address', tracking_no: 'show_tracking',
    refund_count: 'show_refund_count', refund_amount: 'show_refund_amount',
  };
  const out = { ...post };
  for (const f of FIELDS) {
    if (map[f] && settings[map[f]] === 0) out[f] = '';
  }
  return out;
}

export const onRequestGet = async ({ env, request }) => {
  const url = new URL(request.url);
  const name = (url.searchParams.get('name_exact') || '').trim();      // 买家姓名（完全匹配）
  const addr = (url.searchParams.get('address_exact') || '').trim();   // 收货地址（完全匹配）
  const trk = (url.searchParams.get('tracking4') || '').trim();        // 订单号后四位（完全匹配）
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
  const size = Math.min(100, Math.max(1, parseInt(url.searchParams.get('size') || '20', 10) || 20));
  const offset = (page - 1) * size;

  // 只能搜索「他人发布的内容」：需要登录，且始终排除自己上传的记录
  const viewer = await authFromRequest(env, request);
  if (!viewer) return error('请先登录，才能搜索并查看他人发布的内容', 401);

  const conds = [];
  const values = [];
  if (name) { conds.push('p.buyer_name = ?'); values.push(name); }
  if (addr) { conds.push('p.buyer_address = ?'); values.push(addr); }
  if (trk) { conds.push('substr(p.tracking_no, -4) = ?'); values.push(trk); }
  if (!conds.length) return error('请至少填写一项：买家姓名 / 收货地址 / 订单号后四位');

  // 只有任一项「完全匹配」才命中；只返回他人的内容（排除自己）
  const whereSql = 'WHERE p.user_id != ? AND (' + conds.join(' OR ') + ')';
  const bind = [viewer.id, ...values];

  const { results: total } = await env.DB.prepare(
    `SELECT COUNT(*) AS c FROM posts p ${whereSql}`
  ).bind(...bind).all();
  const count = total[0].c;
  const { results } = await env.DB.prepare(
    `SELECT p.*, u.name AS author_name FROM posts p LEFT JOIN users u ON u.id = p.user_id ${whereSql}
     ORDER BY p.id DESC LIMIT ? OFFSET ?`
  ).bind(...bind, size, offset).all();

  // 命中的他人帖子：完整显示其全部内容（含买家信息等），用于核对是否同一买家
  return json({ total: count, page, size, list: results, matched: true });
};

export const onRequestPost = async ({ env, request }) => {
  const user = await authFromRequest(env, request);
  if (!user) return error('请先登录', 401);
  const body = await readBody(request);
  const p = {};
  for (const f of FIELDS) p[f] = body[f] !== undefined ? String(body[f]).trim() : '';
  if (typeof p.refund_count === 'string') p.refund_count = parseInt(p.refund_count, 10) || 0;
  if (!p.buyer_account && !p.shop_name && !p.item) return error('请至少填写 买家账号 / 店铺名称 / 购买物品 之一');
  const r = await env.DB.prepare(
    `INSERT INTO posts (user_id, platform, shop_name, item, amount, buyer_account, buyer_name,
       buyer_real_phone, buyer_virtual_phone, buyer_address, tracking_no, refund_count, refund_amount)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(user.id, p.platform, p.shop_name, p.item, p.amount, p.buyer_account, p.buyer_name,
    p.buyer_real_phone, p.buyer_virtual_phone, p.buyer_address, p.tracking_no, p.refund_count, p.refund_amount).run();
  return json({ id: r.meta.last_row_id }, 201);
};
