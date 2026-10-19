-- Cloudflare D1 数据库表结构（cms-trade）
-- 创建后执行：wrangler d1 execute cms-trade-db --file=./schema.sql --remote

-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  name TEXT DEFAULT '',
  role TEXT DEFAULT 'user',          -- 'user' 普通用户 / 'admin' 管理员
  created_at TEXT DEFAULT (datetime('now', 'localtime'))
);

-- 短信验证码表
CREATE TABLE IF NOT EXISTS sms_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT NOT NULL,
  code TEXT NOT NULL,
  purpose TEXT DEFAULT 'register',   -- 'register' / 'login'
  used INTEGER DEFAULT 0,
  expires_at INTEGER NOT NULL,       -- unix 毫秒时间戳
  created_at TEXT DEFAULT (datetime('now', 'localtime'))
);

-- 交易记录帖子表
CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  platform TEXT DEFAULT '',          -- 交易平台
  shop_name TEXT DEFAULT '',         -- 店铺名称
  item TEXT DEFAULT '',              -- 购买物品
  amount TEXT DEFAULT '',            -- 物品金额
  buyer_account TEXT DEFAULT '',     -- 买家账号
  buyer_name TEXT DEFAULT '',        -- 买家姓名
  buyer_real_phone TEXT DEFAULT '',  -- 买家真实号码
  buyer_virtual_phone TEXT DEFAULT '', -- 买家虚拟号码
  buyer_address TEXT DEFAULT '',     -- 买家地址（完整拼接）
  tracking_no TEXT DEFAULT '',       -- 快递单号
  refund_count INTEGER DEFAULT 0,    -- 仅退款次数
  refund_amount TEXT DEFAULT '',     -- 仅退款金额
  address_province TEXT DEFAULT '',  -- 省（v2）
  address_city TEXT DEFAULT '',      -- 市（v2）
  address_district TEXT DEFAULT '',  -- 县/区（v2）
  address_street TEXT DEFAULT '',    -- 乡镇/街道（v2）
  address_detail TEXT DEFAULT '',    -- 详细地址（v2）
  extra_fields TEXT DEFAULT '',      -- 自定义字段 JSON（v2）
  created_at TEXT DEFAULT (datetime('now', 'localtime'))
);

-- 对外显示内容设置表（每个用户一份）
CREATE TABLE IF NOT EXISTS display_settings (
  user_id INTEGER PRIMARY KEY,
  show_platform INTEGER DEFAULT 1,
  show_shop INTEGER DEFAULT 1,
  show_item INTEGER DEFAULT 1,
  show_amount INTEGER DEFAULT 1,
  show_buyer_account INTEGER DEFAULT 1,
  show_buyer_name INTEGER DEFAULT 0,
  show_real_phone INTEGER DEFAULT 0,
  show_virtual_phone INTEGER DEFAULT 0,
  show_address INTEGER DEFAULT 0,
  show_tracking INTEGER DEFAULT 0,
  show_refund_count INTEGER DEFAULT 1,
  show_refund_amount INTEGER DEFAULT 1,
  updated_at TEXT DEFAULT (datetime('now', 'localtime'))
);

-- ===== v2 扩展（2026-10）=====

-- 默认管理员账号（djmy / 000000），首次建库自动创建
INSERT OR IGNORE INTO users (phone, password_hash, salt, name, role)
VALUES ('djmy', 'HM-0a9qw_pN-_mkCaPmKuK0VY8S5F3Es4E9AdKMD0uM', '55TTrv8B6vnJHfSJTlV90w', '管理员', 'admin');

-- 自定义字段表（管理员后台定义，发布页动态渲染）
CREATE TABLE IF NOT EXISTS custom_fields (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  label TEXT NOT NULL,
  field_key TEXT NOT NULL,
  field_type TEXT DEFAULT 'text',        -- text / number / select / textarea
  options TEXT DEFAULT '',               -- select 的选项（逗号分隔）
  required INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now', 'localtime'))
);

-- 论坛板块表（v3：支持二级分类、版主、开放发帖/回帖）
CREATE TABLE IF NOT EXISTS forum_boards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  parent_id INTEGER DEFAULT 0,          -- 父版块（0=一级分类/版块）
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  icon TEXT DEFAULT '',                 -- 图标字符（如 📦）
  color TEXT DEFAULT '',                -- 主题色
  moderator_ids TEXT DEFAULT '',        -- 版主 user_id（逗号分隔）
  allow_post INTEGER DEFAULT 1,         -- 是否开放发帖
  allow_reply INTEGER DEFAULT 1,        -- 是否开放回帖
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now', 'localtime'))
);

-- 论坛主题帖表（v3：置顶/精华/锁定/审核/回收站）
CREATE TABLE IF NOT EXISTS forum_topics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  board_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  content TEXT DEFAULT '',
  views INTEGER DEFAULT 0,
  reply_count INTEGER DEFAULT 0,
  sticky INTEGER DEFAULT 0,             -- 置顶
  digest INTEGER DEFAULT 0,             -- 精华
  locked INTEGER DEFAULT 0,             -- 锁定（禁止回帖）
  approved INTEGER DEFAULT 1,           -- 是否通过审核（1=通过 0=待审）
  deleted INTEGER DEFAULT 0,            -- 回收站软删除
  deleted_at TEXT DEFAULT '',
  moved_from INTEGER DEFAULT 0,         -- 移动前版块
  created_at TEXT DEFAULT (datetime('now', 'localtime'))
);

-- 论坛回帖表（v3：审核/回收站）
CREATE TABLE IF NOT EXISTS forum_replies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  topic_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  approved INTEGER DEFAULT 1,           -- 是否通过审核
  deleted INTEGER DEFAULT 0,            -- 回收站软删除
  deleted_at TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now', 'localtime'))
);

-- 论坛敏感词表（v3，发布/回帖时自动替换为 *）
CREATE TABLE IF NOT EXISTS forum_banned_words (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  word TEXT UNIQUE NOT NULL,
  created_at TEXT DEFAULT (datetime('now', 'localtime'))
);

-- 论坛公告表（v3）
CREATE TABLE IF NOT EXISTS forum_notices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content TEXT NOT NULL,
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now', 'localtime'))
);

-- 论坛管理日志表（v3，Discuz! 风格管理留痕）
CREATE TABLE IF NOT EXISTS forum_admin_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_id INTEGER NOT NULL,
  action TEXT DEFAULT '',               -- 如: 置顶/删除主题/封禁
  target TEXT DEFAULT '',               -- 目标描述（主题/用户等）
  detail TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now', 'localtime'))
);

-- 提示：已部署的数据库（posts 表已存在）需执行 migration.sql 补充 posts 表 v2 列
