// 论坛主题
//   GET  /api/forum/topics?board_id=&q=&sort=&page=&size=   主题列表（仅已审核、非回收站）
//        sort: ''默认(置顶优先+新) / new最新 / hot热门(回复+浏览) / digest精华
//   POST /api/forum/topics                           发主题（登录，含敏感词过滤，发帖 +1 积分）
import { json, error, readBody, authFromRequest, isBanned, filterBannedWords, addPoints, parseMentions } from '../_utils.js';

export const onRequestGet = async ({ env, request }) => {
  const url = new URL(request.url);
  const boardId = parseInt(url.searchParams.get('board_id') || '0', 10) || 0;
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
  const size = Math.min(50, Math.max(1, parseInt(url.searchParams.get('size') || '20', 10) || 20));
  const q = String(url.searchParams.get('q') || '').trim();
  const sort = String(url.searchParams.get('sort') || '').trim();
  const offset = (page - 1) * size;
  let where = 'WHERE t.approved = 1 AND t.deleted = 0', bind = [];
  if (boardId) { where += ' AND t.board_id = ?'; bind = [boardId]; }
  if (q) { where += ' AND (t.title LIKE ? OR t.content LIKE ?)'; bind = bind.concat(['%' + q + '%', '%' + q + '%']); }
  let order = 't.sticky DESC, t.id DESC';
  if (sort === 'new') order = 't.id DESC';
  else if (sort === 'hot') order = '(t.reply_count * 3 + t.views) DESC, t.id DESC';
  else if (sort === 'digest') order = 't.digest DESC, t.sticky DESC, t.id DESC';
  const { results: total } = await env.DB.prepare('SELECT COUNT(*) AS c FROM forum_topics t ' + where).bind(...bind).all();
  const count = total[0].c;
  const { results } = await env.DB.prepare(
    `SELECT t.*, b.name AS board_name, u.name AS author_name, u.phone AS author_phone,
       (SELECT COUNT(*) FROM topic_votes v WHERE v.topic_id = t.id AND v.value = 1) AS votes_up,
       (SELECT COUNT(*) FROM topic_votes v WHERE v.topic_id = t.id AND v.value = -1) AS votes_down,
       (SELECT COUNT(*) FROM topic_favorites f WHERE f.topic_id = t.id) AS favorites_count
     FROM forum_topics t
     LEFT JOIN forum_boards b ON b.id = t.board_id
     LEFT JOIN users u ON u.id = t.user_id
     ${where} ORDER BY ${order} LIMIT ? OFFSET ?`
  ).bind(...bind, size, offset).all();
  return json({ total: count, page, size, list: results });
};

export const onRequestPost = async ({ env, request }) => {
  const u = await authFromRequest(env, request);
  if (!u) return error('请先登录', 401);
  if (isBanned(u)) return error('你已被禁言，无法发帖');
  const body = await readBody(request);
  const boardId = parseInt(body.board_id, 10) || 0;
  let title = String(body.title || '').trim();
  let content = String(body.content || '').trim();
  if (!boardId) return error('请选择板块');
  if (!title) return error('请填写标题');
  if (!content) return error('请填写内容');
  const b = await env.DB.prepare('SELECT id, allow_post FROM forum_boards WHERE id = ?').bind(boardId).all();
  if (!b.results.length) return error('板块不存在');
  if (b.results[0].allow_post === 0) return error('该板块已关闭发帖');
  title = await filterBannedWords(env, title);
  content = await filterBannedWords(env, content);
  const r = await env.DB.prepare('INSERT INTO forum_topics (board_id, user_id, title, content) VALUES (?, ?, ?, ?)').bind(boardId, u.id, title, content).run();
  const tid = r.meta.last_row_id || 0;
  await addPoints(env, u.id, 1, '发布主题', tid).catch(() => {});
  await parseMentions(env, title + ' ' + content, u.id, tid).catch(() => {});
  return json({ created: true }, 201);
};
