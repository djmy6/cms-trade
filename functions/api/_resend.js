// 内置邮件服务：Resend（绑定自有域名）
// 免费版：3000 封/月、100 封/日、3 个验证域名（DKIM/SPF/DMARC）
// API: POST https://api.resend.com/emails  （Bearer 鉴权，纯 HTTP，Workers 直接可用）
export async function sendResendEmail(cfg, { to, subject, text }) {
  const apiKey = (cfg.resend_api_key || '').trim();
  const domain = (cfg.resend_domain || '').trim().toLowerCase().replace(/^[a-z]+:\/\//, '').replace(/[/.]+$/, '');
  if (!apiKey) throw new Error('未配置 Resend API Key');
  if (!domain) throw new Error('未配置发件域名');
  const fromName = (cfg.resend_from_name || '').trim() || '交易记录CMS';

  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `${fromName} <noreply@${domain}>`,
      to: [to],
      subject,
      text,
    }),
  });
  if (!resp.ok) {
    let msg = 'Resend 发送失败 (' + resp.status + ')';
    try {
      const j = await resp.json();
      if (j && j.message) msg = 'Resend: ' + j.message;
    } catch { /* 忽略响应解析失败 */ }
    throw new Error(msg);
  }
  return { ok: true, mode: 'resend', domain };
}
