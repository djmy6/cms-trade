// GET /api/site-config  公开读取注册/登录配置（供登录页、注册页按配置显示/隐藏）
import { json } from './_utils.js';

// 注册/登录配置默认值。开关类值为 '1'/'0'，数值类为字符串数字。
export const SITE_CONFIG_DEFAULTS = {
  phone_register_enabled: '1',   // 手机注册验证登录：1 开（手机号+短信验证码必填校验） / 0 关
  email_register_enabled: '1',   // 邮箱注册验证登录：1 开（邮箱+邮箱验证码） / 0 关
  one_click_login_enabled: '1',  // 本机号码一键登录按钮：1 显示 / 0 隐藏
  require_email: '1',            // 注册是否强制邮箱：1 必填 / 0 可选
  sms_code_expire_min: '5',      // 短信验证码有效期（分钟）
  email_code_expire_min: '5',    // 邮箱验证码有效期（分钟）
  code_resend_seconds: '45',     // 验证码重发间隔（秒）
};

// 发件邮箱（邮件服务）配置默认值。仅后台管理员可见，公开接口（/api/site-config）不返回。
// mail_provider: resend=内置邮箱服务（Resend，绑定自有域名） | smtp=手动 SMTP
export const SITE_MAIL_DEFAULTS = {
  mail_provider: 'smtp',
  // 内置 Resend（绑定自有域名）
  resend_api_key: '',    // Resend API Key（re_ 开头，所有接口不回显）
  resend_domain: '',     // 发件域名（须已在 Resend 验证，如 9dd.cc.cd）
  resend_from_name: '',  // 发件人显示名称（可空）
  // 手动 SMTP
  smtp_enabled: '0',     // 1 启用手动 SMTP 发信 / 0 停用
  smtp_host: '',         // SMTP 服务器，如 smtp.qq.com
  smtp_port: '465',      // 端口：465(ssl) / 587(tls) / 25(none)
  smtp_secure: 'ssl',    // ssl | tls | none
  smtp_user: '',         // 发件邮箱账号（同时作为 From 地址）
  smtp_pass: '',         // 授权码 / 密码（所有接口不回显）
  smtp_from: '',         // 发件人显示名称（可空）
};

// 兼容旧名称（早期版本导出的 SITE_SMTP_DEFAULTS / readSmtpConfig）
export const SITE_SMTP_DEFAULTS = SITE_MAIL_DEFAULTS;

// 从 site_config 表读取邮件配置并合并默认值
export async function readMailConfig(env) {
  const defaults = { ...SITE_MAIL_DEFAULTS };
  try {
    const { results } = await env.DB.prepare('SELECT key, value FROM site_config').all();
    for (const r of results) if (r.key in defaults) defaults[r.key] = r.value;
  } catch {
    // 表不存在时用默认值
  }
  return defaults;
}

// 兼容旧名称
export const readSmtpConfig = readMailConfig;

// 从 site_config 表读取并合并默认值
export async function readSiteConfig(env) {
  const defaults = { ...SITE_CONFIG_DEFAULTS };
  try {
    const { results } = await env.DB.prepare('SELECT key, value FROM site_config').all();
    for (const r of results) if (r.key in defaults) defaults[r.key] = r.value;
  } catch {
    // 表不存在时用默认值（迁移未执行时前端也能工作）
  }
  return defaults;
}

export const onRequestGet = async ({ env }) => {
  return json({ config: await readSiteConfig(env) });
};
