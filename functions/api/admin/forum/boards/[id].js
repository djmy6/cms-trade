// 后台：论坛板块编辑 / 删除（仅管理员）
//   PUT    /api/admin/forum/boards/:id   更新板块（名称/父板块/图标/颜色/版主/开放发帖回帖/排序）
//   DELETE /api/admin/forum/boards/:id   删除板块（须无子版块且无主题）
import { json, error, readBody, authFromRequest, isAdmin, logAdmin } from '../../../_utils.js';

export const onRequestPut = async ({ env, request, params }) => {
  const u = await authFromRequest(env, request);
  if (!isAdmin(u)) return error('需要管理员权限', 403);
  const id = parseInt(params.id, 10);
  const body = await readBody(request);
  const name = String(body.name || '').trim();
  if (!name) return error('请填写板块名称');
  const parentId = parseInt(body.parent_id, 10) || 0;
  const description = String(body.description || '').trim();
  const icon = String(body.icon || '').trim();
  const color = String(body.color || '').trim();
  const moderatorIds = String(body.moderator_ids || '').trim();
  const allowPost = body.allow_post === 0 ? 0 : 1;
  const allowReply = body.allow_reply === 0 ? 0 : 1;
  const sort = parseInt(body.sort_order, 10) || 0;
  await env.DB.prepare(
    'UPDATE forum_boards SET parent_id=?, name=?, description=?, icon=?, color=?, moderator_ids=?, allow_post=?, allow_reply=?, sort_order=? WHERE id=?'
  ).bind(parentId, name, description, icon, color, moderatorIds, allowPost, allowReply, sort, id).run();
  await logAdmin(env, u.id, '编辑板块', '板块#' + id + ' ' + name);
  return json({ updated: true, id });
};

export const onRequestDelete = async ({ env, request, params }) => {
  const u = await authFromRequest(env, request);
  if (!isAdmin(u)) return error('需要管理员权限', 403);
  const id = parseInt(params.id, 10);
  const { results: kids } = await env.DB.prepare('SELECT COUNT(*) AS c FROM forum_boards WHERE parent_id = ?').bind(id).all();
  if (kids[0].c > 0) return error('请先删除该板块下的子版块');
  const { results: tp } = await env.DB.prepare('SELECT COUNT(*) AS c FROM forum_topics WHERE board_id = ?').bind(id).all();
  if (tp[0].c > 0) return error('该板块下仍有主题，请先清理');
  await env.DB.prepare('DELETE FROM forum_boards WHERE id = ?').bind(id).run();
  await logAdmin(env, u.id, '删除板块', '板块#' + id);
  return json({ deleted: true, id });
};
