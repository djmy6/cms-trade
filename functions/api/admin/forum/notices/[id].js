// 后台：编辑/删除公告
//   PUT    /api/admin/forum/notices/:id   body: { content, active }
//   DELETE /api/admin/forum/notices/:id
import { json, error, readBody, authFromRequest, isAdmin, logAdmin } from '../../_utils.js';

export const onRequestPut = async ({ env, request, params }) => {
  const u = await authFromRequest(env, request);
  if (!isAdmin(u) && u.role !== 'supermod') return error('需要管理权限', 403);
  const id = parseInt(params.id, 10);
  const body = await readBody(request);
  const content = String(body.content || '').trim();
  if (!content) return error('请填写公告内容');
  const active = body.active === 0 ? 0 : 1;
  await env.DB.prepare('UPDATE forum_notices SET content = ?, active = ? WHERE id = ?').bind(content, active, id).run();
  await logAdmin(env, u.id, '编辑公告', '#' + id);
  return json({ updated: true, id });
};

export const onRequestDelete = async ({ env, request, params }) => {
  const u = await authFromRequest(env, request);
  if (!isAdmin(u) && u.role !== 'supermod') return error('需要管理权限', 403);
  const id = parseInt(params.id, 10);
  await env.DB.prepare('DELETE FROM forum_notices WHERE id = ?').bind(id).run();
  await logAdmin(env, u.id, '删除公告', '#' + id);
  return json({ deleted: true, id });
};
