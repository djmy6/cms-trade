// 后台：论坛回复操作（删除进回收站/恢复、审核）+ 硬删除
//   PUT    /api/admin/forum/replies/:id   body: { deleted, approved }
//   DELETE /api/admin/forum/replies/:id   硬删除
//   权限：管理员/超版全量；版主仅自己名下板块
import { json, error, readBody, authFromRequest, canManageBoard, logAdmin } from '../../_utils.js';

export const onRequestPut = async ({ env, request, params }) => {
  const u = await authFromRequest(env, request);
  if (!u) return error('请先登录', 401);
  const id = parseInt(params.id, 10);
  const body = await readBody(request);
  const { results } = await env.DB.prepare(
    `SELECT r.id, t.board_id, b.moderator_ids FROM forum_replies r
     LEFT JOIN forum_topics t ON t.id = r.topic_id
     LEFT JOIN forum_boards b ON b.id = t.board_id WHERE r.id = ?`
  ).bind(id).all();
  if (!results.length) return error('回复不存在', 404);
  if (!canManageBoard(u, results[0])) return error('需要论坛管理权限', 403);
  const sets = [], vals = [];
  if (body.deleted !== undefined) { sets.push('deleted = ?'); vals.push(body.deleted ? 1 : 0); }
  if (body.approved !== undefined) { sets.push('approved = ?'); vals.push(body.approved ? 1 : 0); }
  if (!sets.length) return error('没有可更新的字段');
  vals.push(id);
  await env.DB.prepare('UPDATE forum_replies SET ' + sets.join(', ') + ' WHERE id = ?').bind(...vals).run();
  await logAdmin(env, u.id, '管理回复', '回复#' + id, JSON.stringify(body));
  return json({ updated: true, id });
};

export const onRequestDelete = async ({ env, request, params }) => {
  const u = await authFromRequest(env, request);
  if (!u) return error('请先登录', 401);
  const id = parseInt(params.id, 10);
  const { results } = await env.DB.prepare(
    `SELECT t.board_id, b.moderator_ids FROM forum_replies r
     LEFT JOIN forum_topics t ON t.id = r.topic_id
     LEFT JOIN forum_boards b ON b.id = t.board_id WHERE r.id = ?`
  ).bind(id).all();
  if (!results.length) return error('回复不存在', 404);
  if (!canManageBoard(u, results[0])) return error('需要论坛管理权限', 403);
  await env.DB.prepare('DELETE FROM forum_replies WHERE id = ?').bind(id).run();
  await logAdmin(env, u.id, '硬删除回复', '回复#' + id);
  return json({ deleted: true, id });
};
