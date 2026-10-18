# cms-trade 详细部署教程（Cloudflare Pages）

本文档带你从零把 `cms-trade` 部署到 Cloudflare Pages，含数据库、接口、域名、管理员、短信配置，全程保姆级步骤。预计用时 20–30 分钟。

---

## 0. 你需要准备

| 项 | 说明 |
|---|---|
| Cloudflare 账号 | 免费即可，https://dash.cloudflare.com 注册 |
| GitHub（或 GitLab）账号 | 用来存放源码、触发 Pages 部署 |
| Node.js | 本地装 LTS 版本（18 及以上），用于 wrangler 命令 |
| 域名（可选） | 不必须；部署后自带 `xxxx.pages.dev` 免费域名 |

检查本地 Node 是否装好（打开命令行 / PowerShell）：

```bash
node -v
npm -v
```

能打印版本号即可继续。

---

## 1. 解压源码

把 `cms-trade.zip` 解压到本地一个目录，例如 `D:\cms-trade`。确认里面有：

```
cms-trade/
├── public/           前端
├── functions/        后端接口
├── wrangler.toml     配置文件
├── schema.sql        数据库表结构
├── package.json
└── README.md
```

---

## 2. 安装 wrangler 并登录 Cloudflare

wrangler 是 Cloudflare 官方命令行工具，用来管理 D1 数据库、部署等。

```bash
npm install -g wrangler
wrangler login
```

`wrangler login` 会打开浏览器，登录 Cloudflare 账号并授权。看到「Successfully logged in」即成功。

> 不想全局安装也可以，后面所有 `wrangler` 命令换成 `npx wrangler`。

---

## 3. 创建 D1 数据库

D1 是 Cloudflare 的 SQLite 数据库，用来存用户、帖子、验证码等数据。

**方式 A（推荐，网页操作）：**
1. 登录 Cloudflare 控制台 https://dash.cloudflare.com
2. 左侧 → **Workers & Pages → D1** → **Create database**
3. 名称填：`cms-trade-db` → **Create**
4. 创建完成后，**复制它的 Database ID**（一串字母数字，形如 `xxxxxxxx-xxxx-...`）

**方式 B（命令行）：**
```bash
wrangler d1 create cms-trade-db
```
输出里会显示 `database_id`，复制保存。

---

## 4. 修改 wrangler.toml 填入数据库 ID

用记事本 / VS Code 打开 `wrangler.toml`，找到：

```toml
[[d1_databases]]
binding = "DB"
database_name = "cms-trade-db"
database_id = "YOUR_D1_DATABASE_ID"
```

把 `database_id` 的值替换成你第 3 步复制的 ID，例如：

```toml
database_id = "f3a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5"
```

保存。

---

## 5. 初始化数据库表结构

在源码目录（`wrangler.toml` 所在目录）执行：

```bash
cd D:\cms-trade
wrangler d1 execute cms-trade-db --file=./schema.sql --remote
```

看到成功信息（创建的几张表）即完成。这会一次性在远程 D1 上建好 `users`、`sms_codes`、`posts`、`display_settings` 四张表。

> 另一种方式：在 Cloudflare 控制台 D1 → 点数据库名 → **Console**，把 `schema.sql` 全文粘贴进去执行，效果一样。

---

## 6. 把代码推到 Git 仓库

Cloudflare Pages 通过「连接 Git 仓库」来部署，每次 push 自动构建发布。

**用 GitHub 为例：**

```bash
cd D:\cms-trade
git init
git add .
git commit -m "init cms-trade"
git branch -M main
git remote add origin https://github.com/<你的用户名>/cms-trade.git
git push -u origin main
```

> 仓库根目录直接放 `cms-trade` 的全部文件（`public/`、`functions/`、`wrangler.toml` 都在仓库根）。不要在仓库里再套一层 `cms-trade` 文件夹。

---

## 7. 在 Cloudflare Pages 创建项目

1. 控制台 https://dash.cloudflare.com → 左侧 **Workers & Pages → Create application**
2. 选 **Pages** 标签 → **Connect to Git**
3. 首次需授权 GitHub（授予读取仓库权限），然后选择你刚 push 的 `cms-trade` 仓库
4. **Build settings** 按下面填：
   - **Framework preset**：None（不选）
   - **Build command**：留空（本工程无构建步骤）
   - **Build output directory**：`public`
   - **Root directory**：留空（仓库根即工程根）
5. 点 **Save and Deploy**

等一两分钟，构建完成，会生成一个访问域名，形如：
```
https://cms-trade-xxxxx.pages.dev
```

> 构建日志里如果报错，一般是 `wrangler.toml` 的 `database_id` 没填对或仓库结构不对，按报错修正后重新 push 即可。

---

## 8. 绑定 D1 数据库到 Pages 项目

前端接口要能读写数据库，必须把刚创建的 D1 绑定到 Pages 项目。

1. 进入刚创建的项目 → **Settings → Functions → D1 database bindings**
2. 点 **Add binding**：
   - **Variable name**：`DB`（必须大写 DB，与代码一致）
   - **D1 database**：选择 `cms-trade-db`
3. 保存，然后**重新部署一次**（Deployments → 最新版本 → **Retry deployment**，或再 push 一次），让绑定生效。

> 关键：变量名必须叫 `DB`，否则后端读取不到数据库。

---

## 9. 配置环境变量（密钥）

后端登录/注册需要签名密钥。不配置会报错。

1. 项目 → **Settings → Environment variables → Production**
2. 添加以下变量：

| 变量名 | 值 | 说明 |
|---|---|---|
| `SECRET_KEY` | 任意长随机串（见下） | 必填，JWT 签名密钥 |
| `SMS_PROVIDER` | `mock` | 先开发模式，见第 12 节 |

生成 `SECRET_KEY`（任选一种）：
```bash
# 方式一：命令行生成
openssl rand -hex 32
# 方式二：本地 PowerShell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# 方式三：手动随便打一串 32 位以上随机字符
```
把生成的一长串复制进 `SECRET_KEY` 的值。

3. 保存后同样 **Retry deployment** 让变量生效。

---

## 10. 设置管理员

注册功能默认所有人都是一般用户（`role=user`）。你需要把自己设成管理员（`role=admin`）才能用后台管理。

**第一步：先在网页上注册一个账号**
打开你的 `https://cms-trade-xxxxx.pages.dev` → 右上 **登录** → **去注册** → 填手机号 → 点「获取验证码」→ 开发模式下页面直接显示测试验证码（默认 `123456`）→ 填入 → 设密码 → 注册成功。

**第二步：把该账号提升为管理员**

方式一（D1 Console 可视化，推荐）：
1. 控制台 → **Workers & Pages → D1 → cms-trade-db → Console**
2. 执行：
```sql
UPDATE users SET role='admin' WHERE phone='你的注册手机号';
```
3. 再执行下面这条确认已生效（返回一行、role 是 admin）：
```sql
SELECT phone, name, role FROM users;
```

方式二（命令行）：
```bash
wrangler d1 execute cms-trade-db \
  --command="UPDATE users SET role='admin' WHERE phone='你的注册手机号'" \
  --remote
```

完成后，重新登录该账号，顶部会出现「后台管理」入口。

---

## 11. 验证全部功能

部署完成后，用两个手机号各注册一个账号，分别发一条交易记录，然后：

1. **登录账号 A** → 发一条买家信息（姓名/地址/单号）
2. **登录账号 B** → 发一条信息，用 A 的买家姓名或地址或单号后四位去首页搜索
3. 确认：只显示 B 自己以外的、完全匹配的记录，且**完整显示**对方记录全部字段
4. 点「导出命中的他人记录」→ 下载 CSV
5. 用管理员账号进「后台管理」→ 看用户列表、帖子全览、统计

---

## 12. 短信验证码：从开发模式切换到真实发送

默认 `SMS_PROVIDER=mock`，不真正发短信，注册页直接回显测试验证码（`123456`），适合先跑通。

要真正给用户手机发验证码，需把 `SMS_PROVIDER` 改成 `aliyun` 或 `tencent`，并配置对应密钥（都填在 Pages 项目 **Settings → Environment variables → Production**）：

### 阿里云（推荐国内）
| 变量 | 值 |
|---|---|
| `SMS_PROVIDER` | `aliyun` |
| `ALIYUN_ACCESS_KEY_ID` | 阿里云 AccessKeyId |
| `ALIYUN_ACCESS_KEY_SECRET` | 阿里云 AccessKeySecret |
| `ALIYUN_SIGN_NAME` | 短信签名（需在阿里云开通短信服务并申请签名） |
| `ALIYUN_TEMPLATE_CODE` | 短信模板 CODE（模板变量需含 `code`） |

### 腾讯云
| 变量 | 值 |
|---|---|
| `SMS_PROVIDER` | `tencent` |
| `TENCENT_SECRET_ID` | 腾讯云 SecretId |
| `TENCENT_SECRET_KEY` | 腾讯云 SecretKey |
| `TENCENT_SDKAPPID` | 短信应用 SDKAppID |
| `TENCENT_SIGN_NAME` | 短信签名 |
| `TENCENT_TEMPLATE_ID` | 短信模板 ID（模板参数需含 `code`） |

改完保存并 **Retry deployment**。短信服务商密钥没配好时，代码会自动回退到 `mock`（避免无法登录）。

> 短信模板正文变量统一用 `code`。例（阿里云）：`您的验证码为 ${code}，5 分钟内有效。`

---

## 13. 常见问题（FAQ）

| 现象 | 原因 / 解决 |
|---|---|
| 注册/登录提示接口 500 或「Internal Server Error」 | 大多是没有 `SECRET_KEY`，或 D1 没绑定成功。检查第 8、9 步，改完 Retry deployment |
| 前端能打开但接口 404 | Functions 没生效：确认 `functions/` 目录在仓库根，且 build output = `public` |
| 验证码一直不弹 / 报错 | 检查 `SMS_PROVIDER` 是否为空，是否 Retry deployment |
| 后台管理点不开 | 当前账号不是管理员：按第 10 步设置 `role='admin'` |
| 改了代码页面没变化 | push 后等构建完成；看 Deployments 是否有新版本 |
| 想换域名 | 项目 → **Custom domains** → Add custom domain（需域名托管在 Cloudflare） |
| 数据丢失 / 想重置 | 这是正常运行的数据库；要清空可 D1 Console 执行 `DELETE FROM posts;` 等 |
| 部署报「unable to find database」 | `wrangler.toml` 的 `database_id` 填错了，核对第 3、4 步 |

---

## 附：本地调试（可选）

想在本地先跑通再部署：

```bash
cd D:\cms-trade
npm install -g wrangler
wrangler pages dev        # 本地起服务，模拟 Pages + Functions
```
本地模式需要用本地 D1，步骤较繁琐，建议直接按上方线上流程部署测试更省事。
