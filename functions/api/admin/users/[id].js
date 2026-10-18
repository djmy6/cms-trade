// DELETE /api/admin/users/:id   后台：删除用户（其帖子一并删除）
import { json, error, authFromRequest } from '../../_utils.js';

export const onRequestDelete = async ({ env, request, params }) => {
  const user = await authFromRequest(env, request);
  if (!user || user.role !== 'admin') return error('需要管理员权限', 403);
  const id = parseInt(params.id, 10);
  if (id === user.id) return error('不能删除自己');
  await env.DB.prepare('DELETE FROM posts WHERE user_id = ?').bind(id).run();
  await env.DB.prepare('DELETE FROM display_settings WHERE user_id = ?').bind(id).run();
  await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(id).run();
  return json({ deleted: true, id });
};
