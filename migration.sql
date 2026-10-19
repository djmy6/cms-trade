-- 迁移脚本：为已部署的数据库补齐 v2 能力（地址分段 / 自定义字段 / 论坛 / 默认管理员）
-- 已全新建库的（schema.sql 已含全部）无需执行本文件
-- 用法：wrangler d1 execute cms-trade-db --file=./migration.sql --remote
-- 注意：重复执行时若 ALTER 报 duplicate column，属正常，说明列已存在，可忽略继续

-- 1) posts 表补齐 v2 列
ALTER TABLE posts ADD COLUMN address_province TEXT DEFAULT '';
ALTER TABLE posts ADD COLUMN address_city TEXT DEFAULT '';
ALTER TABLE posts ADD COLUMN address_district TEXT DEFAULT '';
ALTER TABLE posts ADD COLUMN address_street TEXT DEFAULT '';
ALTER TABLE posts ADD COLUMN address_detail TEXT DEFAULT '';
ALTER TABLE posts ADD COLUMN extra_fields TEXT DEFAULT '';

-- 2) 默认管理员账号（djmy / 000000）
INSERT OR IGNORE INTO users (phone, password_hash, salt, name, role)
VALUES ('djmy', 'HM-0a9qw_pN-_mkCaPmKuK0VY8S5F3Es4E9AdKMD0uM', '55TTrv8B6vnJHfSJTlV90w', '管理员', 'admin');

-- 3) 自定义字段表
CREATE TABLE IF NOT EXISTS custom_fields (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  label TEXT NOT NULL,
  field_key TEXT NOT NULL,
  field_type TEXT DEFAULT 'text',
  options TEXT DEFAULT '',
  required INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now', 'localtime'))
);

-- 4) 论坛板块 / 主题 / 回帖表
CREATE TABLE IF NOT EXISTS forum_boards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS forum_topics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  board_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  content TEXT DEFAULT '',
  views INTEGER DEFAULT 0,
  reply_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS forum_replies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  topic_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now', 'localtime'))
);

-- ===== v3：Discuz! 风格论坛管理扩展（2026-10）=====
-- 注意：重复执行时 ALTER 报 duplicate column 属正常，可忽略继续

-- 板块表：二级分类 / 图标颜色 / 版主 / 开放发帖回帖
ALTER TABLE forum_boards ADD COLUMN parent_id INTEGER DEFAULT 0;
ALTER TABLE forum_boards ADD COLUMN icon TEXT DEFAULT '';
ALTER TABLE forum_boards ADD COLUMN color TEXT DEFAULT '';
ALTER TABLE forum_boards ADD COLUMN moderator_ids TEXT DEFAULT '';
ALTER TABLE forum_boards ADD COLUMN allow_post INTEGER DEFAULT 1;
ALTER TABLE forum_boards ADD COLUMN allow_reply INTEGER DEFAULT 1;

-- 主题表：置顶 / 精华 / 锁定 / 审核 / 回收站 / 移动
ALTER TABLE forum_topics ADD COLUMN sticky INTEGER DEFAULT 0;
ALTER TABLE forum_topics ADD COLUMN digest INTEGER DEFAULT 0;
ALTER TABLE forum_topics ADD COLUMN locked INTEGER DEFAULT 0;
ALTER TABLE forum_topics ADD COLUMN approved INTEGER DEFAULT 1;
ALTER TABLE forum_topics ADD COLUMN deleted INTEGER DEFAULT 0;
ALTER TABLE forum_topics ADD COLUMN deleted_at TEXT DEFAULT '';
ALTER TABLE forum_topics ADD COLUMN moved_from INTEGER DEFAULT 0;

-- 回帖表：审核 / 回收站
ALTER TABLE forum_replies ADD COLUMN approved INTEGER DEFAULT 1;
ALTER TABLE forum_replies ADD COLUMN deleted INTEGER DEFAULT 0;
ALTER TABLE forum_replies ADD COLUMN deleted_at TEXT DEFAULT '';

-- 敏感词表
CREATE TABLE IF NOT EXISTS forum_banned_words (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  word TEXT UNIQUE NOT NULL,
  created_at TEXT DEFAULT (datetime('now', 'localtime'))
);

-- 公告表
CREATE TABLE IF NOT EXISTS forum_notices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content TEXT NOT NULL,
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now', 'localtime'))
);

-- 管理日志表
CREATE TABLE IF NOT EXISTS forum_admin_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_id INTEGER NOT NULL,
  action TEXT DEFAULT '',
  target TEXT DEFAULT '',
  detail TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now', 'localtime'))
);

-- ===== v4：注册邮箱验证（2026-10）=====
-- 用户表加邮箱列
ALTER TABLE users ADD COLUMN email TEXT DEFAULT '';

-- 邮箱验证码表
CREATE TABLE IF NOT EXISTS email_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  purpose TEXT DEFAULT 'register',
  used INTEGER DEFAULT 0,
  expires_at INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now', 'localtime'))
);

-- 邮箱唯一（部分索引，避免空串冲突）
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL AND email != '';
