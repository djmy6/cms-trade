// POST /api/send-code
// body: { phone, purpose: 'register'|'login' }
// 验证码策略：
//   SMS_PROVIDER=mock（默认）→ 不真正发送，直接返回测试验证码（生产前请替换）
//   SMS_PROVIDER=aliyun/tencent → 调用短信服务商发送；密钥未配置时回退 mock
import { json, error, readBody } from './_utils.js';

function genCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

const PHONE_RE = /^1[3-9]\d{9}$/;

export const onRequestPost = async ({ request, env }) => {
  const body = await readBody(request);
  const phone = String(body.phone || '').trim();
  const purpose = body.purpose === 'login' ? 'login' : 'register';

  if (!PHONE_RE.test(phone)) return error('手机号格式不正确');
  if (purpose === 'register') {
    const { results } = await env.DB.prepare('SELECT id FROM users WHERE phone = ?').bind(phone).all();
    if (results.length) return error('该手机号已注册，请直接登录');
  }

  // 限流：同一手机号 60 秒内只能发一次
  const now = Date.now();
  const recent = await env.DB.prepare(
    'SELECT expires_at FROM sms_codes WHERE phone = ? AND used = 0 ORDER BY id DESC LIMIT 1'
  ).bind(phone).all();
  if (recent.results[0] && recent.results[0].expires_at > now - 45000) {
    return error('发送太频繁，请稍后再试');
  }

  const code = genCode();
  const expiresAt = now + 5 * 60 * 1000; // 5 分钟有效
  await env.DB.prepare(
    'INSERT INTO sms_codes (phone, code, purpose, used, expires_at) VALUES (?, ?, ?, 0, ?)'
  ).bind(phone, code, purpose, expiresAt).run();

  const provider = (env.SMS_PROVIDER || 'mock').toLowerCase();
  const mockCode = env.MOCK_CODE || '123456';

  // --- mock 模式：不真正发短信，返回测试码（供开发/测试） ---
  if (provider === 'mock') {
    // 为方便联调，mock 模式下统一使用 MOCK_CODE 并直接回显
    await env.DB.prepare(
      'UPDATE sms_codes SET code = ? WHERE phone = ? AND used = 0 ORDER BY id DESC LIMIT 1'
    ).bind(mockCode, phone).run();
    return json({ sent: true, mode: 'mock', devCode: mockCode, msg: '开发模式：验证码为 ' + mockCode });
  }

  // --- 阿里云短信 ---
  if (provider === 'aliyun') {
    const akId = env.ALIYUN_ACCESS_KEY_ID, akSecret = env.ALIYUN_ACCESS_KEY_SECRET;
    const signName = env.ALIYUN_SIGN_NAME, tplCode = env.ALIYUN_TEMPLATE_CODE;
    if (!akId || !akSecret || !signName || !tplCode) return mockFallback(env, mockCode, phone);
    const sent = await sendAliyun({ akId, akSecret, signName, tplCode, phone, code });
    if (!sent) return mockFallback(env, mockCode, phone);
    return json({ sent: true, mode: 'aliyun' });
  }

  // --- 腾讯云短信 ---
  if (provider === 'tencent') {
    const sid = env.TENCENT_SECRET_ID, skey = env.TENCENT_SECRET_KEY;
    const sdkappid = env.TENCENT_SDKAPPID, signName = env.TENCENT_SIGN_NAME, tplId = env.TENCENT_TEMPLATE_ID;
    if (!sid || !skey || !sdkappid || !signName || !tplId) return mockFallback(env, mockCode, phone);
    const sent = await sendTencent({ sid, skey, sdkappid, signName, tplId, phone, code });
    if (!sent) return mockFallback(env, mockCode, phone);
    return json({ sent: true, mode: 'tencent' });
  }

  return mockFallback(env, mockCode, phone);
};

function mockFallback(env, mockCode, phone) {
  // 短信服务未正确配置 → 回退 mock 并提示
  return json({
    sent: true, mode: 'mock',
    devCode: mockCode,
    msg: '短信服务未配置或发送失败，已回退开发验证码：' + mockCode,
  });
}

// ---------- 阿里云短信（短信服务 RPC，Dysmsapi 2017-05-25） ----------
async function sendAliyun({ akId, akSecret, signName, tplCode, phone, code }) {
  try {
    const params = {
      AccessKeyId: akId, Action: 'SendSms', Format: 'JSON', RegionId: 'cn-hangzhou',
      SignatureMethod: 'HMAC-SHA1', SignatureNonce: crypto.randomUUID(),
      SignatureVersion: '1.0', Timestamp: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
      Version: '2017-05-25', PhoneNumbers: phone, SignName: signName, TemplateCode: tplCode,
      TemplateParam: JSON.stringify({ code }),
    };
    const sorted = Object.keys(params).sort();
    const qs = sorted.map((k) => `${percent(k)}=${percent(params[k])}`).join('&');
    const stringToSign = 'POST&%2F&' + percent(qs);
    const hmacKey = await crypto.subtle.importKey('raw', enc(akSecret + '&'), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
    const sig = await crypto.subtle.sign('HMAC', hmacKey, enc(stringToSign));
    const signature = percent(btoa(String.fromCharCode(...new Uint8Array(sig))));
    const url = 'https://dysmsapi.aliyuncs.com/?' + qs + '&Signature=' + signature;
    const resp = await fetch(url, { method: 'POST' });
    const r = await resp.json();
    return r.Code === 'OK';
  } catch { return false; }
}
function enc(s) { return new TextEncoder().encode(s); }
function percent(s) {
  return encodeURIComponent(s).replace(/\+/g, '%20').replace(/\*/g, '%2A').replace(/%7E/g, '~');
}

// ---------- 腾讯云短信（SMS 2021-01-11，TC3-HMAC-SHA256 简版：使用 API 3.0） ----------
async function sendTencent({ sid, skey, sdkappid, signName, tplId, phone, code }) {
  try {
    const host = 'sms.tencentcloudapi.com';
    const action = 'SendSms';
    const version = '2021-01-11';
    const service = 'sms';
    const ts = Math.floor(Date.now() / 1000);
    const date = new Date(ts * 1000).toISOString().slice(0, 10);
    const payload = JSON.stringify({
      PhoneNumberSet: [phone], SmsSdkAppId: String(sdkappid), SignName: signName,
      TemplateId: String(tplId), TemplateParamSet: [String(code)],
    });
    const h = (algo, data) => crypto.subtle.digest(algo, enc(data));
    const canonicalHeaders = `content-type:application/json; charset=utf-8\nhost:${host}\nx-tc-action:${action.toLowerCase()}\n`;
    const signedHeaders = 'content-type;host;x-tc-action';
    const canonicalRequest = `POST\n/\n\n${canonicalHeaders}\n${signedHeaders}\n${b2h(await h('SHA-256', payload))}`;
    const credentialScope = `${date}/${service}/tc3_request`;
    const stringToSign = `TC3-HMAC-SHA256\n${ts}\n${credentialScope}\n${b2h(await h('SHA-256', canonicalRequest))}`;
    const secretDate = await hmac(enc('TC3' + skey), enc(date));
    const secretService = await hmac(secretDate, enc(service));
    const secretSigning = await hmac(secretService, enc('tc3_request'));
    const signature = b2h(await hmac(secretSigning, enc(stringToSign)));
    const auth = `TC3-HMAC-SHA256 Credential=${sid}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
    const resp = await fetch(`https://${host}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8', Authorization: auth, Host: host, 'X-TC-Action': action, 'X-TC-Timestamp': String(ts), 'X-TC-Version': version },
      body: payload,
    });
    const r = await resp.json();
    return r.Response && r.Response.Error ? false : true;
  } catch { return false; }
}
async function hmac(key, data) {
  return crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    .then((k) => crypto.subtle.sign('HMAC', k, data));
}
function b2h(buf) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
