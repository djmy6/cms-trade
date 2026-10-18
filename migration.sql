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
