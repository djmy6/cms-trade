// 自定义字段管理（管理员）
//   GET  /api/admin/fields         字段列表
//   POST /api/admin/fields         新增字段 {label,field_key,field_type,options,required,sort_order}
import { json, error, readBody, authFromRequest } from '../_utils.js';

export const onRequestGet = async ({ env, request }) => {
  const u = await authFromRequest(env, request);
  if (!u || u.role !== 'admin') return error('需要管理员权限', 403);
  const { results } = await env.DB.prepare('SELECT * FROM custom_fields ORDER BY sort_order, id').all();
  return json({ list: results });
};

export const onRequestPost = async ({ env, request }) => {
  const u = await authFromRequest(env, request);
  if (!u || u.role !== 'admin') return error('需要管理员权限', 403);
  const body = await readBody(request);
  const label = String(body.label || '').trim();
  const key = String(body.field_key || '').trim();
  if (!label) return error('请填写字段名称');
  if (!key) return error('请填写字段标识（英文/数字/下划线）');
  if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(key)) return error('字段标识需以字母开头，仅含字母数字下划线');
  const type = ['text', 'number', 'select', 'textarea'].includes(body.field_type) ? body.field_type : 'text';
  const options = String(body.options || '');
  if (type === 'select' && !options) return error('下拉字段请填写选项（用逗号分隔）');
  const required = body.required ? 1 : 0;
  const sort = parseInt(body.sort_order, 10) || 0;
  const ex = await env.DB.prepare('SELECT id FROM custom_fields WHERE field_key = ?').bind(key).all();
  if (ex.results.length) return error('字段标识已存在');
  await env.DB.prepare(
    'INSERT INTO custom_fields (label, field_key, field_type, options, required, sort_order, active) VALUES (?, ?, ?, ?, ?, ?, 1)'
  ).bind(label, key, type, options, required, sort).run();
  return json({ created: true }, 201);
};
