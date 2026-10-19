// POST /api/pns/auth  获取阿里云号码认证（H5 一键登录）鉴权 Token
// 返回 { accessToken, jwtToken }，供前端 SDK checkLoginAvailable 使用
import { json, error } from '../_utils.js';
import { aliyunPnsRpc } from './_aliyun.js';

export const onRequestPost = async ({ request, env }) => {
  // Url/Origin 必须与控制台认证方案填写的页面地址一致，用环境变量配置
  const url = env.ALIYUN_PNVS_URL || '';
  const origin = env.ALIYUN_PNVS_ORIGIN || '';
  const sceneCode = env.ALIYUN_PNVS_SCENE_CODE || '';
  if (!url || !origin) return error('请配置 ALIYUN_PNVS_URL / ALIYUN_PNVS_ORIGIN（认证方案页面地址）');
  if (!sceneCode) return error('请配置 ALIYUN_PNVS_SCENE_CODE（认证方案 Code）');

  let r;
  try {
    r = await aliyunPnsRpc(env, 'GetAuthToken', {
      Url: url,
      Origin: origin,
      SceneCode: sceneCode,
      BizType: '1', // 1 = 一键登录
    });
  } catch (e) {
    return error('获取认证 Token 失败：' + e.message);
  }
  if (r.Code !== 'OK') return error('获取认证 Token 失败：' + (r.Message || r.Code));
  return json({ accessToken: r.TokenInfo.AccessToken, jwtToken: r.TokenInfo.JwtToken });
};
