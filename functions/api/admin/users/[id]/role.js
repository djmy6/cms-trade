// PUT /api/admin/users/:id/role   后台：设置用户角色（管理员/超级版主/版主/用户/禁言）
import { json, error, readBody, authFromRequest, isAdmin, roleLabel, logAdmin } from '../../../_utils.js';

const ROLE_WHITELIST = ['admin', 'supermod', 'moderator', 'user', 'banned'];

export const onRequestPut = async ({ env, request, params }) => {
  const user = await authFromRequest(env, request);
  if (!isAdmin(user)) return error('需要管理员权限', 403);
  const id = parseInt(params.id, 10);
  const body = await readBody(request);
  const role = ROLE_WHITELIST.includes(body.role) ? body.role : 'user';
  if (id === user.id && role !== 'admin') return error('不能撤销自己的管理员权限');
  await env.DB.prepare('UPDATE users SET role = ? WHERE id = ?').bind(role, id).run();
  await logAdmin(env, user.id, '设置角色', '用户#' + id + ' → ' + roleLabel(role));
  return json({ updated: true, id, role });
};
