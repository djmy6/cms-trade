// POST /api/export  按搜索条件合并导出 CSV（精确匹配他人内容）
// body: { name_exact, address_exact, tracking4 }
// 规则与列表搜索一致：只导「他人发布的内容」，任一项完全匹配才命中，命中导出完整字段
import { error, readBody, authFromRequest } from './_utils.js';

const COLS = [
  ['id', 'ID'], ['platform', '交易平台'], ['shop_name', '店铺名称'], ['item', '购买物品'],
  ['amount', '物品金额'], ['buyer_account', '买家账号'], ['buyer_name', '买家姓名'],
  ['buyer_real_phone', '买家真实号码'], ['buyer_virtual_phone', '买家虚拟号码'],
  ['buyer_address', '买家地址'], ['tracking_no', '快递单号'],
  ['refund_count', '仅退款次数'], ['refund_amount', '仅退款金额'], ['created_at', '创建时间'],
];

export const onRequestPost = async ({ env, request }) => {
  const user = await authFromRequest(env, request);
  if (!user) return error('请先登录，才能搜索并导出他人内容', 401);

  const body = await readBody(request);
  const name = String(body.name_exact || '').trim();
  const addr = String(body.address_exact || '').trim();
  const trk = String(body.tracking4 || '').trim();

  const conds = [];
  const values = [];
  if (name) { conds.push('buyer_name = ?'); values.push(name); }
  if (addr) { conds.push('buyer_address = ?'); values.push(addr); }
  if (trk) { conds.push('substr(tracking_no, -4) = ?'); values.push(trk); }
  if (!conds.length) return error('请至少填写一项：买家姓名 / 收货地址 / 订单号后四位');

  // 只导出他人发布的内容，任一项完全匹配才命中
  const whereSql = 'WHERE user_id != ? AND (' + conds.join(' OR ') + ')';
  const bind = [user.id, ...values];

  const { results } = await env.DB.prepare(
    `SELECT * FROM posts ${whereSql} ORDER BY id DESC`
  ).bind(...bind).all();

  const esc = (v) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const csv = '\uFEFF' + COLS.map(([, h]) => esc(h)).join(',') + '\n' +
    results.map((r) => COLS.map(([f]) => esc(r[f])).join(',')).join('\n');

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="matched_export_${Date.now()}.csv"`,
    },
  });
};
