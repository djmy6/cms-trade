// 阿里云号码认证（dypnsapi）RPC OpenAPI 调用
// endpoint: https://dypnsapi.aliyuncs.com/  (RegionId: cn-hangzhou)
// 公共参数 HMAC-SHA1 签名，兼容 Cloudflare Workers（Web Crypto）

const enc = new TextEncoder();

// RFC3986 percent-encode（阿里云签名规范）
function percentEncode(str) {
  return encodeURIComponent(str)
    .replace(/\+/g, '%20')
    .replace(/\*/g, '%2A')
    .replace(/%7E/g, '~');
}

async function hmacSha1Base64(akSecret, stringToSign) {
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(akSecret + '&'),
    { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(stringToSign));
  const bytes = new Uint8Array(sig);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

export function aliyunPnsConfigured(env) {
  return !!(env.ALIYUN_PNVS_AK_ID && env.ALIYUN_PNVS_AK_SECRET);
}

// 调用阿里云 OpenAPI（GET + Query），返回解析后的 JSON
export async function aliyunPnsRpc(env, action, businessParams = {}) {
  const akId = env.ALIYUN_PNVS_AK_ID;
  const akSecret = env.ALIYUN_PNVS_AK_SECRET;
  if (!akId || !akSecret) throw new Error('阿里云 AccessKey 未配置（ALIYUN_PNVS_AK_ID / ALIYUN_PNVS_AK_SECRET）');

  const params = {
    Action: action,
    Version: '2017-05-25',
    AccessKeyId: akId,
    Format: 'JSON',
    SignatureMethod: 'HMAC-SHA1',
    SignatureVersion: '1.0',
    SignatureNonce: crypto.randomUUID(),
    Timestamp: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
    RegionId: env.ALIYUN_PNVS_REGION || 'cn-hangzhou',
    ...businessParams,
  };

  const keys = Object.keys(params).sort();
  const q = keys
    .map((k) => percentEncode(k) + '=' + percentEncode(String(params[k])))
    .join('&');

  const stringToSign = 'GET&%2F&' + percentEncode(q);
  const signature = await hmacSha1Base64(akSecret, stringToSign);

  const url = 'https://dypnsapi.aliyuncs.com/?' + q + '&' + percentEncode('Signature') + '=' + percentEncode(signature);
  const resp = await fetch(url);
  const text = await resp.text();
  try { return JSON.parse(text); } catch { return { Code: resp.status, Message: '响应解析失败: ' + text.slice(0, 200) }; }
}
