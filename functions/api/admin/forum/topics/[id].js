// 后台：论坛主题操作（置顶/精华/锁定/审核/移动/回收站）+ 硬删除
//   PUT    /api/admin/forum/topics/:id   body: { sticky, digest, locked, approved, deleted, move_to }
//   DELETE /api/admin/forum/topics/:id   硬删除
//   权限：管理员/超版全量；版主仅自己名下板块
import { json, error, readBody, authFromRequest, canManageBoard, logAdmin } from '../../_utils.js';

export const onRequestPut = async ({ env, request, params }) => {
  const u = await authFromRequest(env, request);
  if (!u) return error('请先登录', 401);
  const id = parseInt(params.id, 10);
  const body = await readBody(request);
  const { results } = await env.DB.prepare(
    `SELECT t.board_id, b.moderator_ids FROM forum_topics t
     LEFT JOIN forum_boards b ON b.id = t.board_id WHERE t.id = ?`
  ).bind(id).all();
  if (!results.length) return error('主题不存在', 404);
  const board = results[0];
  if (!canManageBoard(u, board)) return error('需要论坛管理权限', 403);

  const sets = [], vals = [];
  const f = (k) => { if (body[k] !== undefined) { sets.push(k + ' = ?'); vals.push(body[k] ? 1 : 0); } };
  f('sticky'); f('digest'); f('locked'); f('approved'); f('deleted');
  if (body.move_to !== undefined) {
    sets.push('board_id = ?'); vals.push(parseInt(body.move_to, 10) || 0);
    sets.push('moved_from = ?'); vals.push(board.board_id);
  }
  if (!sets.length) return error('没有可更新的字段');
  vals.push(id);
  await env.DB.prepare('UPDATE forum_topics SET ' + sets.join(', ') + ' WHERE id = ?').bind(...vals).run();
  await logAdmin(env, u.id, '管理主题', '主题#' + id, JSON.stringify(body));
  return json({ updated: true, id });
};

export const onRequestDelete = async ({ env, request, params }) => {
  const u = await authFromRequest(env, request);
  if (!u) return error('请先登录', 401);
  const id = parseInt(params.id, 10);
  const { results } = await env.DB.prepare(
    `SELECT t.board_id, b.moderator_ids FROM forum_topics t
     LEFT JOIN forum_boards b ON b.id = t.board_id WHERE t.id = ?`
  ).bind(id).all();
  if (!results.length) return error('主题不存在', 404);
  if (!canManageBoard(u, results[0])) return error('需要论坛管理权限', 403);
  await env.DB.prepare('DELETE FROM forum_replies WHERE topic_id = ?').bind(id).run();
  await env.DB.prepare('DELETE FROM forum_topics WHERE id = ?').bind(id).run();
  await logAdmin(env, u.id, '硬删除主题', '主题#' + id);
  return json({ deleted: true, id });
};
