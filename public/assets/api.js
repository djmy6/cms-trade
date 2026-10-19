// 前端 API 封装
const TOKEN_KEY = 'cms_token';
const USER_KEY = 'cms_user';

const Api = {
  get token() { return localStorage.getItem(TOKEN_KEY) || ''; },
  get user() { try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch { return null; } },
  setSession(token, user) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  logout() { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); },

  async req(method, url, body) {
    const headers = { 'Content-Type': 'application/json' };
    if (this.token) headers.Authorization = 'Bearer ' + this.token;
    const opts = { method, headers };
    if (body !== undefined) opts.body = JSON.stringify(body);
    const res = await fetch(url, opts);
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('text/csv')) return { ok: true, csv: await res.text() };
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || '请求失败(' + res.status + ')');
    return data;
  },
  get: (u) => Api.req('GET', u),
  post: (u, b) => Api.req('POST', u, b),
  put: (u, b) => Api.req('PUT', u, b),
  del: (u) => Api.req('DELETE', u),

  // 认证
  sendCode: (phone, purpose) => Api.post('/api/send-code', { phone, purpose }),
  sendEmailCode: (email, purpose) => Api.post('/api/send-email-code', { email, purpose }),
  pnsAuth: () => Api.post('/api/pns/auth', {}),
  pnsPhone: (spToken) => Api.post('/api/pns/phone', { spToken }),
  register: (payload) => Api.post('/api/register', payload),
  login: (phone, password) => Api.post('/api/login', { phone, password }),
  changePassword: (old_password, new_password) => Api.put('/api/me/password', { old_password, new_password }),
  me: () => Api.get('/api/me'),

  // 帖子
  posts: (params) => Api.get('/api/posts?' + new URLSearchParams(params)),
  getPost: (id) => Api.get('/api/posts/' + id),
  createPost: (p) => Api.post('/api/posts', p),
  updatePost: (id, p) => Api.put('/api/posts/' + id, p),
  deletePost: (id) => Api.del('/api/posts/' + id),

  // 设置
  settings: () => Api.get('/api/settings'),
  saveSettings: (s) => Api.put('/api/settings', s),

  // 注册/登录配置（site_config）
  siteConfig: () => Api.get('/api/site-config'),
  adminConfig: () => Api.get('/api/admin/config'),
  updateAdminConfig: (c) => Api.put('/api/admin/config', c),

  // 后台
  admin: (seg) => Api.get('/api/admin/' + seg),
  setRole: (id, role) => Api.put('/api/admin/users/' + id + '/role', { role }),
  deleteUser: (id) => Api.del('/api/admin/users/' + id),

  // 自定义字段
  fields: () => Api.get('/api/fields'),
  adminFields: () => Api.get('/api/admin/fields'),
  createField: (p) => Api.post('/api/admin/fields', p),
  updateField: (id, p) => Api.put('/api/admin/fields/' + id, p),
  deleteField: (id) => Api.del('/api/admin/fields/' + id),

  // 论坛
  boards: () => Api.get('/api/forum/boards'),
  createBoard: (p) => Api.post('/api/forum/boards', p),
  topics: (params) => Api.get('/api/forum/topics?' + new URLSearchParams(params)),
  createTopic: (p) => Api.post('/api/forum/topics', p),
  topic: (id) => Api.get('/api/forum/topics/' + id),
  deleteTopic: (id) => Api.del('/api/forum/topics/' + id),
  reply: (id, content) => Api.post('/api/forum/topics/' + id + '/reply', { content }),
  notices: () => Api.get('/api/forum/notices'),

  // 论坛后台管理
  adminTopics: (params) => Api.get('/api/admin/forum/topics?' + new URLSearchParams(params)),
  manageTopic: (id, body) => Api.put('/api/admin/forum/topics/' + id, body),
  hardDeleteTopic: (id) => Api.del('/api/admin/forum/topics/' + id),
  adminReplies: (params) => Api.get('/api/admin/forum/replies?' + new URLSearchParams(params)),
  manageReply: (id, body) => Api.put('/api/admin/forum/replies/' + id, body),
  hardDeleteReply: (id) => Api.del('/api/admin/forum/replies/' + id),
  updateBoard: (id, p) => Api.put('/api/admin/forum/boards/' + id, p),
  deleteBoard: (id) => Api.del('/api/admin/forum/boards/' + id),
  bannedWords: () => Api.get('/api/admin/forum/banned-words'),
  addBannedWord: (word) => Api.post('/api/admin/forum/banned-words', { word }),
  deleteBannedWord: (id) => Api.del('/api/admin/forum/banned-words/' + id),
  adminNotices: () => Api.get('/api/admin/forum/notices'),
  addNotice: (content) => Api.post('/api/admin/forum/notices', { content }),
  updateNotice: (id, body) => Api.put('/api/admin/forum/notices/' + id, body),
  deleteNotice: (id) => Api.del('/api/admin/forum/notices/' + id),
  forumStats: () => Api.get('/api/admin/forum/stats'),

  // 角色标签
  roleLabel: (r) => ({ admin: '管理员', supermod: '超级版主', moderator: '版主', user: '用户', banned: '禁言' }[r] || r || '用户'),

  // 导出
  exportCsv: async (params) => {
    const r = await Api.req('POST', '/api/export', params);
    return r.csv;
  },
};

function authRequired() {
  if (!Api.token) { location.href = 'login.html'; return false; }
  return true;
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function toast(msg, ok = true) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.className = 'show ' + (ok ? 'ok' : 'err');
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.className = ''; }, 2600);
}

function go(path) { location.href = path; }
