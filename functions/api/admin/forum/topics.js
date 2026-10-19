// 后台：论坛主题管理列表
//   GET /api/admin/forum/topics?board_id=&status=all|pending|deleted&keyword=&page=&size=
//   权限：管理员/超级版主全量；版主仅自己名下板块
import { json, error, authFromRequest } from '../../_utils.js';

async function modBoardIds(env, u) {
  if (u.role === 'admin' || u.role === 'supermod') return null; // null = 全部
  if (u.role === 'moderator') {
    const { results } = await env.DB.prepare('SELECT id FROM forum_boards WHERE moderator_ids LIKE ?').bind('%' + u.id + '%').all();
    return results.map((b) => b.id);
  }
  return [];
}

export const onRequestGet = async ({ env, request }) => {
  const u = await authFromRequest(env, request);
  if (!u) return error('请先登录', 401);
  if (!['admin', 'supermod', 'moderator'].includes(u.role)) return error('需要论坛管理权限', 403);
  const url = new URL(request.url);
  const boardId = parseInt(url.searchParams.get('board_id') || '0', 10) || 0;
  const status = url.searchParams.get('status') || 'all';
  const kw = (url.searchParams.get('keyword') || '').trim();
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
  const size = Math.min(100, Math.max(1, parseInt(url.searchParams.get('size') || '20', 10) || 20));
  const offset = (page - 1) * size;

  let where = 'WHERE 1=1', bind = [];
  const allowed = await modBoardIds(env, u);
  if (allowed !== null) {
    if (!allowed.length) return json({ total: 0, page, size, list: [] });
    where += ' AND t.board_id IN (' + allowed.map(() => '?').join(',') + ')';
    bind = bind.concat(allowed);
  }
  if (boardId) { where += ' AND t.board_id = ?'; bind.push(boardId); }
  if (status === 'pending') where += ' AND t.approved = 0';
  else if (status === 'deleted') where += ' AND t.deleted = 1';
  else where += ' AND t.deleted = 0';
  if (kw) { where += ' AND t.title LIKE ?'; bind.push('%' + kw + '%'); }

  const { results: total } = await env.DB.prepare('SELECT COUNT(*) AS c FROM forum_topics t ' + where).bind(...bind).all();
  const { results } = await env.DB.prepare(
    `SELECT t.*, b.name AS board_name, u.name AS author_name, u.phone AS author_phone
     FROM forum_topics t
     LEFT JOIN forum_boards b ON b.id = t.board_id
     LEFT JOIN users u ON u.id = t.user_id
     ${where} ORDER BY t.id DESC LIMIT ? OFFSET ?`
  ).bind(...bind, size, offset).all();
  return json({ total: total[0].c, page, size, list: results });
};
