// POST /api/send-email-code
// body: { email, purpose: 'register' }
// 验证码策略（优先级从高到低，失败逐级回退）：
//   内置 Resend（mail_provider=resend 且已配 Key+域名）→ Resend 发送
//   smtp_enabled=1（后台手动配置了发件邮箱）→ 用 SMTP 发送
//   SENDGRID_API_KEY 已配置 → 通过 SendGrid API 发送验证邮件
//   未配置（开发模式）→ 不真正发送，直接返回测试验证码
import { json, error, readBody } from './_utils.js';
import { readSiteConfig, readMailConfig } from './site-config.js';
import { sendEmail } from './_smtp.js';
import { sendResendEmail } from './_resend.js';

function genCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const onRequestPost = async ({ request, env }) => {
  const body = await readBody(request);
  const email = String(body.email || '').trim().toLowerCase();
  const purpose = body.purpose === 'register' ? 'register' : 'register';

  if (!EMAIL_RE.test(email)) return error('邮箱格式不正确');
  if (purpose === 'register') {
    const { results } = await env.DB.prepare(
      'SELECT id FROM users WHERE email = ? AND email != ?'
    ).bind(email, '').all();
    if (results.length) return error('该邮箱已注册，请直接登录');
  }

  const cfg = await readSiteConfig(env);
  const emailExpireMin = Math.max(1, parseInt(cfg.email_code_expire_min, 10) || 5);
  const resendSec = Math.max(10, parseInt(cfg.code_resend_seconds, 10) || 45);

  // 限流：同一邮箱在重发间隔内只能发一次
  const now = Date.now();
  const recent = await env.DB.prepare(
    'SELECT expires_at FROM email_codes WHERE email = ? AND used = 0 ORDER BY id DESC LIMIT 1'
  ).bind(email).all();
  if (recent.results[0] && recent.results[0].expires_at > now - resendSec * 1000) {
    return error('发送太频繁，请稍后再试');
  }

  const code = genCode();
  const expiresAt = now + emailExpireMin * 60 * 1000; // 有效期可配置
  await env.DB.prepare(
    'INSERT INTO email_codes (email, code, purpose, used, expires_at) VALUES (?, ?, ?, 0, ?)'
  ).bind(email, code, purpose, expiresAt).run();

  // --- 内置 Resend（绑定自有域名）→ 优先用 Resend 真发 ---
  const mail = await readMailConfig(env);
  if (mail.mail_provider === 'resend' && (mail.resend_api_key || '').trim() && (mail.resend_domain || '').trim()) {
    try {
      await sendResendEmail(mail, {
        to: email,
        subject: '【交易记录CMS】邮箱验证码',
        text: `您的验证码是：${code}，${emailExpireMin} 分钟内有效。如非本人操作请忽略本邮件。`,
      });
      return json({ sent: true, mode: 'resend' });
    } catch (e) {
      console.error('Resend send failed:', e && e.message ? e.message : e);
    }
  }

  // --- 后台配置了 SMTP（手动发件邮箱）→ 用 SMTP 真发 ---
  if (mail.smtp_enabled === '1' && (mail.smtp_host || '').trim() && (mail.smtp_user || '').trim()) {
    try {
      await sendEmail(mail, {
        to: email,
        subject: '【交易记录CMS】邮箱验证码',
        text: `您的验证码是：${code}，${emailExpireMin} 分钟内有效。如非本人操作请忽略本邮件。`,
      });
      return json({ sent: true, mode: 'smtp' });
    } catch (e) {
      // SMTP 发送失败 → 回退 SendGrid / mock，方便联调与容错
      console.error('SMTP send failed:', e && e.message ? e.message : e);
    }
  }

  // --- SendGrid 已配置 → 真发邮件 ---
  if (env.SENDGRID_API_KEY) {
    const from = env.SENDGRID_FROM || 'noreply@example.com';
    const fromName = env.SENDGRID_FROM_NAME || '交易记录CMS';
    const resp = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + env.SENDGRID_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email }] }],
        from: { email: from, name: fromName },
        subject: '【交易记录CMS】邮箱验证码',
        content: [{ type: 'text/plain', value: `您的验证码是：${code}，${emailExpireMin} 分钟内有效。如非本人操作请忽略本邮件。` }],
      }),
    });
    if (resp.ok) return json({ sent: true, mode: 'sendgrid' });
    // 发送失败 → 回退 mock，方便联调
  }

  // --- 开发模式（未配置 SendGrid）：返回测试码 ---
  const mockCode = env.MOCK_EMAIL_CODE || '654321';
  await env.DB.prepare(
    'UPDATE email_codes SET code = ? WHERE email = ? AND used = 0 ORDER BY id DESC LIMIT 1'
  ).bind(mockCode, email).run();
  return json({ sent: true, mode: 'mock', devCode: mockCode, msg: '开发模式：验证码为 ' + mockCode });
};
