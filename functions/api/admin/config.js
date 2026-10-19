// GET/PUT /api/admin/config  后台读写注册/登录配置（仅管理员/超级版主）
import { json, error, readBody, authFromRequest, isAdmin } from '../_utils.js';
import { SITE_CONFIG_DEFAULTS, readSiteConfig } from '../site-config.js';

const KEYS = Object.keys(SITE_CONFIG_DEFAULTS);

export const onRequestGet = async ({ env, request }) => {
  const user = await authFromRequest(env, request);
  if (!isAdmin(user) && user.role !== 'supermod') return error('需要管理权限', 403);
  return json({ config: await readSiteConfig(env) });
};

export const onRequestPut = async ({ env, request }) => {
  const user = await authFromRequest(env, request);
  if (!isAdmin(user) && user.role !== 'supermod') return error('需要管理权限', 403);
  const body = await readBody(request);

  const writes = [];
  for (const k of KEYS) {
    if (body[k] === undefined) continue;
    let v = String(body[k]).trim();
    // 开关类归一化为 '1'/'0'；数值类做整数限制
    if (['phone_register_enabled', 'email_register_enabled', 'one_click_login_enabled', 'require_email'].includes(k)) {
      v = (v === '1' || v === 'true' || v === 'yes' || v === 'on') ? '1' : '0';
    } else {
      const n = parseInt(v, 10);
      if (isNaN(n) || n < 0) return error(`配置项 ${k} 须为非负整数`);
      v = String(n);
    }
    writes.push([k, v]);
  }
  if (!writes.length) return error('没有可更新的配置项');

  for (const [k, v] of writes) {
    await env.DB.prepare(
      "INSERT INTO site_config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now', 'localtime')"
    ).bind(k, v).run();
  }
  return json({ updated: true, config: await readSiteConfig(env) });
};
