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
