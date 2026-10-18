// 自定义字段管理（管理员）：编辑 / 删除
//   PUT    /api/admin/fields/:id   编辑字段
//   DELETE /api/admin/fields/:id   删除字段
import { json, error, readBody, authFromRequest } from '../../_utils.js';

export const onRequestPut = async ({ env, request, params }) => {
  const u = await authFromRequest(env, request);
  if (!u || u.role !== 'admin') return error('需要管理员权限', 403);
  const id = parseInt(params.id, 10);
  const body = await readBody(request);
  const label = String(body.label || '').trim();
  if (!label) return error('请填写字段名称');
  const type = ['text', 'number', 'select', 'textarea'].includes(body.field_type) ? body.field_type : 'text';
  const options = String(body.options || '');
  if (type === 'select' && !options) return error('下拉字段请填写选项（用逗号分隔）');
  const required = body.required ? 1 : 0;
  const sort = parseInt(body.sort_order, 10) || 0;
  const active = body.active ? 1 : 0;
  await env.DB.prepare(
    'UPDATE custom_fields SET label=?, field_type=?, options=?, required=?, sort_order=?, active=? WHERE id=?'
  ).bind(label, type, options, required, sort, active, id).run();
  return json({ updated: true, id });
};

export const onRequestDelete = async ({ env, request, params }) => {
  const u = await authFromRequest(env, request);
  if (!u || u.role !== 'admin') return error('需要管理员权限', 403);
  const id = parseInt(params.id, 10);
  await env.DB.prepare('DELETE FROM custom_fields WHERE id = ?').bind(id).run();
  return json({ deleted: true, id });
};
