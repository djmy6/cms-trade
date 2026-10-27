// Brevo 事务性邮件 API（纯 HTTPS，不经过 SMTP 端口）
// 免费版：300 封/天
// API: POST https://api.brevo.com/v3/smtp/email
// 鉴权: api-key 请求头
export async function sendBrevoEmail(cfg, { to, subject, text }) {
  const apiKey = (cfg.smtp_pass || '').trim();
  const fromEmail = (cfg.smtp_from_email || cfg.smtp_user || '').trim();
  const fromName = (cfg.smtp_from || '').trim() || '交易记录CMS';
  if (!apiKey) throw new Error('未配置 Brevo API Key（填在授权码栏）');
  if (!fromEmail) throw new Error('未配置发件人邮箱');

  const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sender: { name: fromName, email: fromEmail },
      to: [{ email: to }],
      subject,
      textContent: text,
    }),
  });
  if (!resp.ok) {
    let msg = 'Brevo 发送失败 (' + resp.status + ')';
    try {
      const j = await resp.json();
      if (j && j.message) msg = 'Brevo: ' + j.message;
      else if (j && j.code) msg = 'Brevo: ' + j.code;
    } catch { /* 忽略 */ }
    throw new Error(msg);
  }
  return { ok: true, mode: 'brevo' };
}
