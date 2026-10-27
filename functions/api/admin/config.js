// GET/PUT /api/admin/config  后台读写注册/登录配置 + 发件邮箱（内置 Resend / 手动 SMTP）配置（仅管理员/超级版主）
import { json, error, readBody, authFromRequest, isAdmin } from '../_utils.js';
import { SITE_CONFIG_DEFAULTS, SITE_MAIL_DEFAULTS, readSiteConfig, readMailConfig } from '../site-config.js';

// 全部可写键：注册/登录配置 + 发件邮箱配置
const ALL_KEYS = { ...SITE_CONFIG_DEFAULTS, ...SITE_MAIL_DEFAULTS };
// 开关类：'1'/'0'
const TOGGLE_KEYS = ['phone_register_enabled', 'email_register_enabled', 'one_click_login_enabled', 'require_email', 'smtp_enabled'];
// 整数类：非负整数
const INT_KEYS = ['sms_code_expire_min', 'email_code_expire_min', 'code_resend_seconds', 'smtp_port'];
// 枚举类
const ENUM_KEYS = {
  smtp_secure: ['ssl', 'tls', 'none'],
  mail_provider: ['smtp', 'resend'],
};
// 字符串类：其余键（smtp_host/user/from、resend_api_key/domain/from_name）原样 trim
// 敏感键：smtp_pass / resend_api_key 空值跳过（表示不修改），且所有接口不回显

export const onRequestGet = async ({ env, request }) => {
  const user = await authFromRequest(env, request);
  if (!user) return error('请先登录', 401);
  if (!isAdmin(user) && user.role !== 'supermod') return error('需要管理权限', 403);
  // 合并注册/登录 + 邮件配置；敏感字段不回显（前端留空表示不修改）
  const config = { ...(await readSiteConfig(env)), ...(await readMailConfig(env)) };
  config.smtp_pass = '';
  config.resend_api_key = '';
  return json({ config });
};

export const onRequestPut = async ({ env, request }) => {
  const user = await authFromRequest(env, request);
  if (!user) return error('请先登录', 401);
  if (!isAdmin(user) && user.role !== 'supermod') return error('需要管理权限', 403);
  const body = await readBody(request);

  const writes = [];
  for (const k of Object.keys(ALL_KEYS)) {
    if (body[k] === undefined || body[k] === null) continue;
    let v = String(body[k]).trim();
    if (TOGGLE_KEYS.includes(k)) {
      v = (v === '1' || v === 'true' || v === 'yes' || v === 'on') ? '1' : '0';
    } else if (INT_KEYS.includes(k)) {
      const n = parseInt(v, 10);
      if (isNaN(n) || n < 0) return error(`配置项 ${k} 须为非负整数`);
      v = String(n);
    } else if (ENUM_KEYS[k]) {
      if (!ENUM_KEYS[k].includes(v)) return error(`配置项 ${k} 取值无效（${ENUM_KEYS[k].join('/')}）`);
    } else {
      // 字符串类：原样保存；空敏感值（smtp_pass / resend_api_key）表示不修改
      if ((k === 'smtp_pass' || k === 'resend_api_key') && v === '') continue;
    }
    writes.push([k, v]);
  }
  if (!writes.length) return error('没有可更新的配置项');

  for (const [k, v] of writes) {
    await env.DB.prepare(
      "INSERT INTO site_config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now', 'localtime')"
    ).bind(k, v).run();
  }
  // 返回合并后配置（敏感字段仍掩码）
  const config = { ...(await readSiteConfig(env)), ...(await readMailConfig(env)) };
  config.smtp_pass = '';
  config.resend_api_key = '';
  return json({ updated: true, config });
};
