// 后台：处理举报
//   PUT /api/admin/forum/reports/:id   body:{status, action}
//        status: 0 待处理 / 1 已处理；action:'delete' 同时软删除被举报主题
import { json, error, readBody, authFromRequest, isAdmin, logAdmin } from '../../../_utils.js';

export const onRequestPut = async ({ env, request, params }) => {
  const u = await authFromRequest(env, request);
  if (!u || (!isAdmin(u) && u.role !== 'supermod')) return error('需要管理权限', 403);
  const id = parseInt(params.id, 10) || 0;
  const body = await readBody(request);
  const status = body.status === 0 ? 0 : 1;
  await env.DB.prepare('UPDATE topic_reports SET status = ?, handled_by = ? WHERE id = ?').bind(status, u.id, id).run();
  if (body.action === 'delete') {
    const { results } = await env.DB.prepare('SELECT topic_id FROM topic_reports WHERE id = ?').bind(id).all();
    if (results.length) {
      await env.DB.prepare("UPDATE forum_topics SET deleted = 1, deleted_at = datetime('now','localtime') WHERE id = ?").bind(results[0].topic_id).run();
      await logAdmin(env, u.id, '举报处理-删除主题', '主题#' + results[0].topic_id);
    }
  }
  await logAdmin(env, u.id, '处理举报', '举报#' + id);
  return json({ updated: true });
};
