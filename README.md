# 交易记录 CMS（Cloudflare Pages）

一个可直接部署到 **Cloudflare Pages** 的定制交易记录管理系统，前端静态页 + Cloudflare Pages Functions 后端 + Cloudflare **D1**（SQLite）数据库。

## 功能清单

- **账号注册**：手机号 + 验证码核验（见下方「短信验证码」），密码加密存储（PBKDF2）
- **登录**：手机号 + 密码，JWT 会话
- **发布交易记录帖**，字段（12 项）：
  交易平台、店铺名称、购买物品、物品金额、买家账号、买家姓名、买家真实号码、买家虚拟号码、买家地址、快递单号、仅退款次数、仅退款金额
- **后台管理**（管理员）：用户列表 / 帖子全览 / 统计 / 设置或取消管理员 / 删除用户与帖子
- **对外显示内容设置**：每个用户可控制自己帖子的哪些字段对他人可见（买家真实号码、地址等敏感字段默认关闭）
- **搜索（精确匹配他人内容）**：只能搜索**他人发布**的内容（自动排除你自己上传的记录）；按 买家姓名 / 收货地址 / 订单号后四位 三个字段**完全匹配**（任一项相等即命中），命中的记录**完整显示**其全部字段，用于核对是否为同一买家
- **合并导出**：按当前搜索条件，把**完全匹配**的他人记录合并导出为 CSV 下载

## 目录结构

```
cms-trade/
├── public/                 # 前端（Pages 静态目录）
│   ├── index.html          # 首页：帖子列表 / 搜索 / 导出
│   ├── login.html          # 登录
│   ├── register.html       # 注册（手机验证码）
│   ├── publish.html        # 发布 / 编辑交易记录
│   ├── post.html           # 帖子详情
│   ├── admin.html          # 后台管理（管理员）
│   ├── settings.html       # 对外显示设置
│   └── assets/             # api.js / style.css
├── functions/api/          # Pages Functions 后端接口
│   ├── _utils.js           # 认证 / 密码哈希 / JWT 工具
│   ├── send-code.js        # 发送验证码（mock / 阿里云 / 腾讯云）
│   ├── register.js         # 注册
│   ├── login.js            # 登录
│   ├── me.js               # 当前用户
│   ├── posts.js            # 帖子列表 / 搜索 / 发布
│   ├── posts/[id].js       # 帖子详情 / 编辑 / 删除
│   ├── settings.js         # 对外显示设置
│   ├── export.js           # 合并导出 CSV
│   └── admin/[...].js      # 后台管理
├── wrangler.toml           # Pages / D1 配置
├── schema.sql              # 数据库表结构
└── package.json
```

## 部署到 Cloudflare Pages

### 1. 推送代码
把 `cms-trade/` 整个目录推到一个 GitHub（或 GitLab）仓库。

### 2. 创建 D1 数据库
在 Cloudflare Dashboard → **Workers & Pages → D1**，创建数据库 `cms-trade-db`，复制它的 **Database ID**。

### 3. 配置 `wrangler.toml`
把 `wrangler.toml` 里的 `database_id = "YOUR_D1_DATABASE_ID"` 换成上一步复制的 ID。

### 4. 初始化表结构
本地安装并登录 wrangler 后执行：
```bash
npm install -g wrangler
wrangler login
wrangler d1 execute cms-trade-db --file=./schema.sql --remote
```

### 5. 在 Cloudflare Pages 部署
Dashboard → **Workers & Pages → Create → Pages → Import from Git**：
- 选择仓库
- Build command 留空或 `npm install`
- Build output directory：`public`
- **Root directory**：`cms-trade`（仓库子目录，视仓库根而定）

部署完成后，在项目 **Settings → Functions → D1 database bindings** 绑定 `cms-trade-db` 到变量名 **`DB`**。

### 6. 配置环境变量 / Secrets
在项目 **Settings → Environment variables**：
- `SECRET_KEY`：JWT 签名密钥，任意长随机串（如 `openssl rand -hex 32`）
- `SMS_PROVIDER`：`mock`（默认）| `aliyun` | `tencent`

### 7. 设置管理员
第一个管理员用注册接口注册后，在 D1 手动提升：
```sql
UPDATE users SET role='admin' WHERE phone='你的手机号';
```
或直接执行：
```bash
wrangler d1 execute cms-trade-db --command="UPDATE users SET role='admin' WHERE phone='xxx'" --remote
```

## 短信验证码

`send-code.js` 支持三种模式，由环境变量 `SMS_PROVIDER` 控制：

| 模式 | 行为 |
|---|---|
| `mock`（默认） | 不真正发送短信，注册页直接显示测试验证码（`MOCK_CODE`，默认 `123456`），用于开发测试 |
| `aliyun` | 调用阿里云短信，需配置 `ALIYUN_ACCESS_KEY_ID / ALIYUN_ACCESS_KEY_SECRET / ALIYUN_SIGN_NAME / ALIYUN_TEMPLATE_CODE` |
| `tencent` | 调用腾讯云短信，需配置 `TENCENT_SECRET_ID / TENCENT_SECRET_KEY / TENCENT_SDKAPPID / TENCENT_SIGN_NAME / TENCENT_TEMPLATE_ID` |

短信服务密钥未配置或发送失败时，自动回退 `mock`（避免无法登录）。**生产上线请务必配置真实短信服务并把 `SMS_PROVIDER` 设为 `aliyun`/`tencent`。**

短信模板变量统一用 `code`，例如阿里云模板正文：`您的验证码为 ${code}，5 分钟内有效。`

## 隐私说明

系统收集买家真实号码、姓名、地址等个人敏感信息，用于交易/退款记录管理与对账。**合规建议**：
- 仅在有合法用途（如交易纠纷核验、风险对账）时收集与使用；
- 前端已默认关闭敏感字段对外展示；
- **完全匹配命中他人记录时会完整显示其全部字段**（这是「核对是否同一买家」的核心用途），请严格控制账号使用范围与管理员权限。

## 本地开发

```bash
npm install -g wrangler
wrangler pages dev   # 本地模拟 Pages + Functions，需本地 D1
```
