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
  buyer_address TEXT DEFAULT '',     -- 买家地址
  tracking_no TEXT DEFAULT '',       -- 快递单号
  refund_count INTEGER DEFAULT 0,    -- 仅退款次数
  refund_amount TEXT DEFAULT '',     -- 仅退款金额
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
