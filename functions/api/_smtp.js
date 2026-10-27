// 极简 SMTP 客户端（Cloudflare Workers 运行时专用）
// 基于 cloudflare:sockets 的 TCP Socket 实现，支持：
//   ssl  → 465 端口直连 TLS（secureTransport: 'on'，连接建立即 TLS 握手）
//   tls  → 587 端口 STARTTLS 升级（先明文 EHLO，再 socket.startTls() 升级）
//   none → 25 端口明文
// 认证：AUTH LOGIN（授权码/密码场景，兼容 QQ/163/Gmail 等）

const enc = new TextEncoder();
const dec = new TextDecoder();
const CRLF = '\r\n';

function b64u8(s) {
  let bin = '';
  for (const b of enc.encode(s)) bin += String.fromCharCode(b);
  return btoa(bin);
}

// 带超时的 Promise race，promise 结束后自动清理 timer（防止泄漏）
function withTimeout(p, ms, msg) {
  let timer;
  const timeout = new Promise((_, rej) => {
    timer = setTimeout(() => rej(new Error(msg)), ms);
  });
  return Promise.race([
    p.finally(() => clearTimeout(timer)),
    timeout,
  ]);
}

// RFC 2047 编码 Subject（非 ASCII 时用 =?UTF-8?B?...?=）
function encodeSubject(s) {
  if (/^[\x20-\x7E]*$/.test(s)) return s;
  return '=?UTF-8?B?' + b64u8(s) + '?=';
}

// SMTP DATA 点转义：每行开头的 . 变为 ..，防止服务器提前结束邮件
function escapeData(text) {
  return text.replace(/\r\n/g, '\n').replace(/^\./gm, '..');
}

// 从邮箱地址提取域名作为 EHLO 主机名（很多服务器拒绝 EHLO localhost）
function ehloHostFromUser(user) {
  const at = user.lastIndexOf('@');
  if (at >= 0 && at < user.length - 1) return user.slice(at + 1);
  return 'mail.local';
}

// 核心 SMTP 会话
export async function smtpConversation(transport, cfg, { to, subject, text }) {
  const user = (cfg.smtp_user || '').trim();
  const pass = cfg.smtp_pass || '';
  if (!user) throw new Error('发件邮箱账号为空');

  const ehloHost = ehloHostFromUser(user);

  const readLine = () => transport.readLine(45000);
  const write = (line) => transport.write(line + CRLF);

  // 读多行响应：250-xxx 继续，250 xxx 结束
  async function cmd(line) {
    await write(line);
    let r = await readLine();
    if (r.length >= 4 && r[3] === '-') {
      for (;;) {
        const n = await readLine();
        if (n.length < 4 || n[3] !== '-') break;
      }
    }
    return r;
  }

  // 1) 读 220 问候
  let r = await readLine();
  if (!/^2\d\d/.test(r)) throw new Error('SMTP 连接失败: ' + r.trim());

  // 2) EHLO（用发件邮箱域名，不用 localhost）
  r = await cmd('EHLO ' + ehloHost);
  if (!/^2\d\d/.test(r)) throw new Error('EHLO 失败: ' + r.trim());

  // 3) STARTTLS（仅 tls/587 模式）
  if (cfg.smtp_secure === 'tls') {
    if (typeof transport.startTls !== 'function') throw new Error('当前环境不支持 STARTTLS');
    r = await cmd('STARTTLS');
    if (!/^2\d\d/.test(r)) throw new Error('STARTTLS 失败: ' + r.trim());
    transport = await transport.startTls();
    // TLS 升级后必须重新 EHLO
    await cmd('EHLO ' + ehloHost);
  }

  // 4) AUTH LOGIN
  r = await cmd('AUTH LOGIN');
  if (!/^3\d\d/.test(r)) throw new Error('服务器不支持 AUTH LOGIN: ' + r.trim());
  await write(b64u8(user));
  r = await readLine();
  if (!/^3\d\d/.test(r)) throw new Error('SMTP 认证失败（账号被拒）: ' + r.trim());
  await write(b64u8(pass));
  r = await readLine();
  if (!/^2\d\d/.test(r)) throw new Error('SMTP 认证失败（密码/授权码错误）: ' + r.trim());

  // 5) 发信（MAIL FROM 优先用 smtp_from_email，兼容 Brevo 等认证账号与发件人不同的平台）
  const from = (cfg.smtp_from_email || user || '').trim();
  const fromName = (cfg.smtp_from || '').trim();
  r = await cmd('MAIL FROM:<' + from + '>');
  if (!/^2\d\d/.test(r)) throw new Error('MAIL FROM 被拒: ' + r.trim());
  r = await cmd('RCPT TO:<' + to + '>');
  if (!/^2\d\d/.test(r)) throw new Error('收件人被拒: ' + r.trim());

  r = await cmd('DATA');
  if (!/^3\d\d/.test(r)) throw new Error('DATA 被拒: ' + r.trim());
  const fromHeader = fromName ? `${fromName} <${from}>` : `<${from}>`;
  const msg =
    'From: ' + fromHeader + CRLF +
    'To: <' + to + '>' + CRLF +
    'Subject: ' + encodeSubject(subject) + CRLF +
    'MIME-Version: 1.0' + CRLF +
    'Content-Type: text/plain; charset=utf-8' + CRLF +
    'Content-Transfer-Encoding: 8bit' + CRLF +
    CRLF +
    escapeData(text) + CRLF +
    '.' + CRLF;
  await transport.write(msg);
  r = await readLine();
  if (!/^2\d\d/.test(r)) throw new Error('邮件发送失败: ' + r.trim());

  try { await cmd('QUIT'); } catch { /* 忽略 */ }
  try { await transport.close(); } catch { /* 忽略 */ }
  return { ok: true };
}

// Workers 传输层（cloudflare:sockets）
async function workersTransport(host, port, secureTransport) {
  const { connect } = await import('cloudflare:sockets');
  let socket = connect({ hostname: host, port, secureTransport });
  let reader = socket.readable.getReader();
  let writer = socket.writable.getWriter();
  let buf = '';

  const transport = {
    async readLine(timeoutMs) {
      const deadline = Date.now() + timeoutMs;
      while (!buf.includes('\n')) {
        const remain = deadline - Date.now();
        if (remain <= 0) throw new Error('SMTP 响应超时');
        const { value, done } = await withTimeout(reader.read(), remain, 'SMTP 响应超时');
        // done=true 表示对端关闭了连接；附带已收到的部分数据便于排查
        if (done) {
          const hint = buf ? '（已收到部分数据: ' + JSON.stringify(buf.slice(-300)) + '）' : '';
          throw new Error('SMTP 连接被对端关闭' + hint);
        }
        buf += dec.decode(value);
      }
      const i = buf.indexOf('\n');
      const line = buf.slice(0, i).replace(/\r$/, '');
      buf = buf.slice(i + 1);
      return line;
    },
    async write(line) {
      await writer.write(enc.encode(line));
    },
    async startTls() {
      // 必须先释放旧 reader/writer 的 lock，否则 socket.startTls() 会失败
      try { reader.releaseLock(); } catch {}
      try { writer.releaseLock(); } catch {}
      // 升级为 TLS，返回新的 Socket
      let tls = socket.startTls();
      if (tls && typeof tls.then === 'function') tls = await tls;
      socket = tls;
      reader = socket.readable.getReader();
      writer = socket.writable.getWriter();
      buf = '';
      return transport;
    },
    async close() {
      try { await writer.close(); } catch {}
      try { reader.releaseLock(); } catch {}
      try { socket.close(); } catch {}
    },
  };
  return transport;
}

// 对外入口：cfg 为 SMTP 配置对象（smtp_host/smtp_port/smtp_secure/smtp_user/smtp_pass/smtp_from）
export async function sendEmail(cfg, mail) {
  const host = (cfg.smtp_host || '').trim();
  const port = parseInt(cfg.smtp_port, 10);
  const secure = (cfg.smtp_secure || 'ssl').toLowerCase();
  if (!host || !port || port <= 0 || port > 65535) throw new Error('SMTP 配置不完整：请填写服务器和端口');
  if (!['ssl', 'tls', 'none'].includes(secure)) throw new Error('SMTP 加密方式无效');
  // ssl(465) → secureTransport:'on'（连接建立即 TLS 握手，隐式 SSL）
  // tls(587) → secureTransport:'starttls'（允许后续调用 socket.startTls() 升级）
  // none(25) → secureTransport:'off'（明文）
  const secureTransport = secure === 'ssl' ? 'on' : (secure === 'tls' ? 'starttls' : 'off');
  const transport = await workersTransport(host, port, secureTransport);
  return smtpConversation(transport, cfg, mail);
}
