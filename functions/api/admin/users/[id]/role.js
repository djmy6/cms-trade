// PUT /api/admin/users/:id/role   后台：设置用户角色
import { json, error, readBody, authFromRequest } from '../../../_utils.js';

export const onRequestPut = async ({ env, request, params }) => {
  const user = await authFromRequest(env, request);
  if (!user || user.role !== 'admin') return error('需要管理员权限', 403);
  const id = parseInt(params.id, 10);
  const body = await readBody(request);
  const role = body.role === 'admin' ? 'admin' : 'user';
  if (id === user.id && role !== 'admin') return error('不能撤销自己的管理员权限');
  await env.DB.prepare('UPDATE users SET role = ? WHERE id = ?').bind(role, id).run();
  return json({ updated: true, id, role });
};
