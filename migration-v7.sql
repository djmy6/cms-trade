-- ===== v7：纯邮箱注册模式（2026-10）=====
-- phone 字段从 NOT NULL 改为允许 NULL（纯邮箱注册时手机号为空）
-- SQLite 不支持直接改列约束，需要新建表复制数据
-- 执行前请备份数据库！

CREATE TABLE IF NOT EXISTS users_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  name TEXT DEFAULT '',
  role TEXT DEFAULT 'user',
  email TEXT DEFAULT '',
  avatar TEXT DEFAULT '',
  signature TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now', 'localtime'))
);

INSERT OR IGNORE INTO users_new (id, phone, password_hash, salt, name, role, email, avatar, signature, created_at)
  SELECT id, phone, password_hash, salt, name, role, email, avatar, signature, created_at FROM users;

DROP TABLE users;

ALTER TABLE users_new RENAME TO users;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL AND email != '';
