// 后台：删除敏感词
//   DELETE /api/admin/forum/banned-words/:id
import { json, error, authFromRequest, isAdmin, logAdmin } from '../../../_utils.js';

export const onRequestDelete = async ({ env, request, params }) => {
  const u = await authFromRequest(env, request);
  if (!isAdmin(u) && u.role !== 'supermod') return error('需要管理权限', 403);
  const id = parseInt(params.id, 10);
  await env.DB.prepare('DELETE FROM forum_banned_words WHERE id = ?').bind(id).run();
  await logAdmin(env, u.id, '删除敏感词', '#' + id);
  return json({ deleted: true, id });
};
