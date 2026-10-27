// POST /api/admin/send-test-email  测试发件邮箱配置（仅管理员/超级版主）
// body: mail_provider + 对应字段 + to（测试收件邮箱）；敏感字段未携带时使用已保存的值
import { json, error, readBody, authFromRequest, isAdmin } from '../_utils.js';
import { readMailConfig } from '../site-config.js';
import { sendEmail } from '../_smtp.js';
import { sendResendEmail } from '../_resend.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const onRequestPost = async ({ request, env }) => {
  const user = await authFromRequest(env, request);
  if (!user) return error('请先登录', 401);
  if (!isAdmin(user) && user.role !== 'supermod') return error('需要管理权限', 403);

  const body = await readBody(request);
  const to = String(body.to || '').trim().toLowerCase();
  if (!EMAIL_RE.test(to)) return error('测试收件邮箱格式不正确');

  // 表单带的值用表单值（刚填写/刚测试），未带的（如 api_key/smtp_pass）用已保存配置
  const stored = await readMailConfig(env);
  const provider = body.mail_provider !== undefined ? String(body.mail_provider) : stored.mail_provider;

  if (provider === 'resend') {
    const cfg = {
      resend_api_key: (body.resend_api_key !== undefined && String(body.resend_api_key) !== '')
        ? String(body.resend_api_key)
        : (stored.resend_api_key || ''),
      resend_domain: (body.resend_domain !== undefined ? String(body.resend_domain) : stored.resend_domain).trim().toLowerCase().replace(/^[a-z]+:\/\//, '').replace(/[/.]+$/, ''),
      resend_from_name: body.resend_from_name !== undefined ? String(body.resend_from_name) : stored.resend_from_name,
    };
    if (!cfg.resend_domain) return error('请先填写发件域名（需已在 Resend 验证）');
    if (!cfg.resend_api_key) return error('请先填写 Resend API Key（re_ 开头）');
    try {
      await sendResendEmail(cfg, {
        to,
        subject: '【交易记录CMS】邮箱配置测试',
        text: '这是一封测试邮件，说明你的内置邮箱服务（Resend）已生效。\n\n收件人：' + to + '\n发件域名：' + cfg.resend_domain,
      });
      return json({ ok: true, sent: true, mode: 'resend', domain: cfg.resend_domain });
    } catch (e) {
      return error('发送失败：' + (e && e.message ? e.message : String(e)), 400);
    }
  }

  // 默认：手动 SMTP
  const cfg = {
    smtp_host: (body.smtp_host !== undefined ? String(body.smtp_host) : stored.smtp_host).trim(),
    smtp_port: body.smtp_port !== undefined ? String(body.smtp_port) : stored.smtp_port,
    smtp_secure: body.smtp_secure !== undefined ? String(body.smtp_secure) : stored.smtp_secure,
    smtp_user: (body.smtp_user !== undefined ? String(body.smtp_user) : stored.smtp_user).trim(),
    smtp_from_email: (body.smtp_from_email !== undefined ? String(body.smtp_from_email) : stored.smtp_from_email || '').trim(),
    smtp_from: body.smtp_from !== undefined ? String(body.smtp_from) : stored.smtp_from,
    smtp_pass: (body.smtp_pass !== undefined && String(body.smtp_pass) !== '')
      ? String(body.smtp_pass)
      : (stored.smtp_pass || ''),
  };
  if (!cfg.smtp_host || !cfg.smtp_port) return error('请先填写 SMTP 服务器和端口');
  if (!cfg.smtp_user) return error('请先填写发件邮箱账号');

  try {
    await sendEmail(cfg, {
      to,
      subject: '【交易记录CMS】邮箱配置测试',
      text: '这是一封测试邮件，说明你的发件邮箱配置已生效。\n\n收件人：' + to + '\n发件服务器：' + cfg.smtp_host + ':' + cfg.smtp_port + '\n加密方式：' + cfg.smtp_secure,
    });
    return json({ ok: true, sent: true, mode: 'smtp', host: cfg.smtp_host, port: cfg.smtp_port });
  } catch (e) {
    return error('发送失败：' + (e && e.message ? e.message : String(e)), 400);
  }
};
