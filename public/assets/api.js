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
  register: (payload) => Api.post('/api/register', payload),
  login: (phone, password) => Api.post('/api/login', { phone, password }),
  me: () => Api.get('/api/me'),

  // 帖子
  posts: (params) => Api.get('/api/posts?' + new URLSearchParams(params)),
  post: (id) => Api.get('/api/posts/' + id),
  createPost: (p) => Api.post('/api/posts', p),
  updatePost: (id, p) => Api.put('/api/posts/' + id, p),
  deletePost: (id) => Api.del('/api/posts/' + id),

  // 设置
  settings: () => Api.get('/api/settings'),
  saveSettings: (s) => Api.put('/api/settings', s),

  // 后台
  admin: (seg) => Api.get('/api/admin/' + seg),
  setRole: (id, role) => Api.put('/api/admin/users/' + id + '/role', { role }),
  deleteUser: (id) => Api.del('/api/admin/users/' + id),

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
