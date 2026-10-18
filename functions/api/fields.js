// GET /api/fields   公开：发布页使用的激活自定义字段定义
import { json } from './_utils.js';

export const onRequestGet = async ({ env }) => {
  const { results } = await env.DB.prepare(
    'SELECT id, label, field_key, field_type, options, required FROM custom_fields WHERE active = 1 ORDER BY sort_order, id'
  ).all();
  return json({ list: results });
};
