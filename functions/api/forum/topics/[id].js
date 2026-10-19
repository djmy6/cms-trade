// 论坛主题详情 / 删除
//   GET    /api/forum/topics/:id   主题详情 + 回帖列表（含顶踩/收藏计数与当前用户状态）
//   DELETE /api/forum/topics/:id   软删除进回收站（作者 / 版主 / 管理员）
import { json, error, authFromRequest, canManageBoard, logAdmin } from '../../_utils.js';

export const onRequestGet = async ({ env, params, request }) => {
  const id = parseInt(params.id, 10);
  await env.DB.prepare('UPDATE forum_topics SET views = views + 1 WHERE id = ?').bind(id).run();
  const { results: t } = await env.DB.prepare(
    `SELECT t.*, b.name AS board_name, u.name AS author_name, u.phone AS author_phone,
       (SELECT COUNT(*) FROM topic_votes v WHERE v.topic_id = t.id AND v.value = 1) AS votes_up,
       (SELECT COUNT(*) FROM topic_votes v WHERE v.topic_id = t.id AND v.value = -1) AS votes_down,
       (SELECT COUNT(*) FROM topic_favorites f WHERE f.topic_id = t.id) AS favorites_count
     FROM forum_topics t
     LEFT JOIN forum_boards b ON b.id = t.board_id
     LEFT JOIN users u ON u.id = t.user_id
     WHERE t.id = ?`
  ).bind(id).all();
  if (!t.length) return error('主题不存在', 404);
  const topic = t[0];
  const u = await authFromRequest(env, request);
  let my_vote = 0, favorited = false;
  if (u) {
    const v = await env.DB.prepare('SELECT value FROM topic_votes WHERE topic_id = ? AND user_id = ?').bind(id, u.id).all();
    my_vote = v.results[0] ? v.results[0].value : 0;
    const f = await env.DB.prepare('SELECT 1 FROM topic_favorites WHERE topic_id = ? AND user_id = ?').bind(id, u.id).all();
    favorited = f.results.length > 0;
  }
  const { results: replies } = await env.DB.prepare(
    `SELECT r.*, u.name AS author_name, u.phone AS author_phone
     FROM forum_replies r LEFT JOIN users u ON u.id = r.user_id
     WHERE r.topic_id = ? AND r.approved = 1 AND r.deleted = 0 ORDER BY r.id ASC`
  ).bind(id).all();
  return json({ topic: Object.assign(topic, { my_vote, favorited }), replies });
};

export const onRequestDelete = async ({ env, request, params }) => {
  const u = await authFromRequest(env, request);
  if (!u) return error('请先登录', 401);
  const id = parseInt(params.id, 10);
  const { results } = await env.DB.prepare(
    `SELECT t.user_id, t.board_id, b.moderator_ids
     FROM forum_topics t LEFT JOIN forum_boards b ON b.id = t.board_id WHERE t.id = ?`
  ).bind(id).all();
  if (!results.length) return error('主题不存在', 404);
  const t = results[0];
  const isAuthor = t.user_id === u.id;
  if (!isAuthor && !canManageBoard(u, t)) return error('无权删除', 403);
  await env.DB.prepare("UPDATE forum_topics SET deleted = 1, deleted_at = datetime('now','localtime') WHERE id = ?").bind(id).run();
  await logAdmin(env, u.id, '删除主题(回收站)', '主题#' + id);
  return json({ deleted: true, id });
};
