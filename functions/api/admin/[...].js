// /api/admin/*  后台管理（需 admin）
//   GET  /api/admin/users             用户列表（含帖数）
//   GET  /api/admin/posts             全部帖子
//   GET  /api/admin/stats             统计
//   PUT  /api/admin/users/:id/role    设置角色 {role:'admin'|'user'}
//   DELETE /api/admin/users/:id       删除用户（其帖子一并删除）
import { json, error, readBody, authFromRequest } from './_utils.js';

export const onRequestGet = async ({ env, request, params }) => {
  const user = await authFromRequest(env, request);
  if (!user || user.role !== 'admin') return error('需要管理员权限', 403);
  const path = Array.isArray(params.path) ? params.path : [params.path];
  const seg = (path[0] || '').toLowerCase();

  if (seg === 'users') {
    const { results } = await env.DB.prepare(
      `SELECT u.id, u.phone, u.name, u.role, u.created_at,
         (SELECT COUNT(*) FROM posts p WHERE p.user_id = u.id) AS post_count
       FROM users u ORDER BY u.id DESC`
    ).all();
    return json({ list: results });
  }
  if (seg === 'posts') {
    const { results } = await env.DB.prepare(
      `SELECT p.*, u.name AS author_name, u.phone AS author_phone FROM posts p LEFT JOIN users u ON u.id = p.user_id ORDER BY p.id DESC`
    ).all();
    return json({ list: results });
  }
  if (seg === 'stats') {
    const u = await env.DB.prepare('SELECT COUNT(*) AS c FROM users').all();
    const p = await env.DB.prepare('SELECT COUNT(*) AS c, COALESCE(SUM(refund_amount), 0) AS ra FROM posts').all();
    const admin = await env.DB.prepare("SELECT COUNT(*) AS c FROM users WHERE role='admin'").all();
    return json({ stats: { users: u.results[0].c, posts: p.results[0].c, refundAmount: p.results[0].ra, admins: admin.results[0].c } });
  }
  return error('未知后台接口', 404);
};

export const onRequestPut = async ({ env, request, params }) => {
  const user = await authFromRequest(env, request);
  if (!user || user.role !== 'admin') return error('需要管理员权限', 403);
  const path = Array.isArray(params.path) ? params.path : [params.path];
  // users/:id/role
  if (path[0] === 'users' && path.length >= 3 && path[2] === 'role') {
    const id = parseInt(path[1], 10);
    const body = await readBody(request);
    const role = body.role === 'admin' ? 'admin' : 'user';
    if (id === user.id && role !== 'admin') return error('不能撤销自己的管理员权限');
    await env.DB.prepare('UPDATE users SET role = ? WHERE id = ?').bind(role, id).run();
    return json({ updated: true, id, role });
  }
  return error('未知操作', 404);
};

export const onRequestDelete = async ({ env, request, params }) => {
  const user = await authFromRequest(env, request);
  if (!user || user.role !== 'admin') return error('需要管理员权限', 403);
  const path = Array.isArray(params.path) ? params.path : [params.path];
  if (path[0] === 'users' && path.length >= 2) {
    const id = parseInt(path[1], 10);
    if (id === user.id) return error('不能删除自己');
    await env.DB.prepare('DELETE FROM posts WHERE user_id = ?').bind(id).run();
    await env.DB.prepare('DELETE FROM display_settings WHERE user_id = ?').bind(id).run();
    await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(id).run();
    return json({ deleted: true, id });
  }
  return error('未知操作', 404);
};
