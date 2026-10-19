# 交易记录 CMS（Cloudflare Pages）

一个可直接部署到 **Cloudflare Pages** 的定制交易记录管理系统，前端静态页 + Cloudflare Pages Functions 后端 + Cloudflare **D1**（SQLite）数据库。

## 功能清单

- **账号注册**：手机号 + 验证码核验（见下方「短信验证码」），密码加密存储（PBKDF2）
- **登录 / 管理员入口**：手机号 + 密码，JWT 会话；默认管理员账号 `djmy` / 密码 `000000`，登录页有一键填入
- **发布交易记录帖**，字段（12 项）：
  交易平台、店铺名称、购买物品、物品金额、买家账号、买家姓名、买家真实号码、买家虚拟号码、买家地址、快递单号、仅退款次数、仅退款金额
- **买家地址级联选择**：省 → 市 → 县/区 → 乡镇/街道（按民政部行政区划代码全量数据）+ 详细地址自行填写
- **自定义字段**（管理员在后台定义）：发布页动态渲染，文本 / 数字 / 下拉 / 多行文本
- **后台管理**（管理员/超级版主/版主）：用户（用户组分级：管理员 / 超级版主 / 版主 / 用户 / 禁言）、帖子、统计、自定义字段、版块（二级分类 / 版主 / 开放开关）
- **Discuz! 风格论坛管理**：主题置顶 / 精华 / 锁定 / 审核 / 回收站 / 移版 / 硬删，回复审核 / 回收 / 硬删，敏感词自动替换为 `*`，公告管理，管理日志留痕
- **普通交流论坛**：顶部公告条 + 板块树（分类 / 子版块 / 版主名），主题带「置顶 / 精华 / 锁定」徽章且置顶优先，锁定主题仅可浏览，版主可管理自己名下板块的主题与回复
- **对外显示内容设置**：每个用户可控制自己帖子的哪些字段对他人可见（买家真实号码、地址等敏感字段默认关闭）
- **搜索（命中他人内容）**：只能搜索**他人发布**的内容（自动排除你自己上传的记录）；按 买家姓名（完全匹配）/ 收货地址（关键词包含匹配，匹配到乡镇街道即完整显示）/ 订单号后四位（完全匹配）三个维度，任一命中即完整显示对方全部字段，用于核对是否为同一买家
- **合并导出**：按当前搜索条件，把命中的他人记录合并导出为 CSV 下载

## 目录结构

```
cms-trade/
├── public/                 # 前端（Pages 静态目录）
│   ├── index.html          # 首页：帖子列表 / 搜索 / 导出
│   ├── login.html          # 登录（含管理员入口）
│   ├── register.html       # 注册（手机验证码）
│   ├── publish.html        # 发布 / 编辑交易记录（地址级联 + 自定义字段）
│   ├── post.html           # 帖子详情
│   ├── admin.html          # 后台管理（概览 / 用户 / 帖子 / 字段 / 版块 / 主题 / 回复 / 敏感词 / 公告）
│   ├── settings.html       # 对外显示设置
│   ├── forum.html          # Discuz! 风格论坛（公告条 + 板块树 + 置顶精华锁定 + 版主管理）
│   └── assets/             # api.js / style.css / regions.js（行政区划数据）
├── functions/api/          # Pages Functions 后端接口
│   ├── _utils.js           # 认证 / 密码哈希 / JWT / 权限 / 敏感词 / 管理日志工具
│   ├── send-code.js        # 发送验证码（mock / 阿里云 / 腾讯云）
│   ├── register.js         # 注册
│   ├── login.js            # 登录
│   ├── me.js               # 当前用户
│   ├── posts.js            # 帖子列表 / 搜索 / 发布
│   ├── posts/[id].js       # 帖子详情 / 编辑 / 删除
│   ├── settings.js         # 对外显示设置
│   ├── export.js           # 合并导出 CSV
│   ├── fields.js           # 公开自定义字段
│   ├── admin/[...path].js  # 后台管理
│   ├── admin/fields.js     # 自定义字段管理（管理员）
│   ├── admin/fields/[id].js# 自定义字段编辑/删除（管理员）
│   ├── forum/              # 论坛接口（boards / topics / reply / notices）
│   └── admin/forum/        # Discuz! 风格论坛管理接口（版块/主题/回复/敏感词/公告/统计）
├── schema.sql              # 数据库表结构（全新库，含 v3 论坛管理）
├── migration.sql           # 已部署库迁移（v2 + v3 补齐）
└── package.json
```
> 说明：**仓库根不含 `wrangler.toml`**。D1 绑定采用 Cloudflare Dashboard **Settings → Bindings** 手动添加 `DB` → `cms-trade-db`；若仓库出现 `wrangler.toml` 会抢占绑定、导致接口报 `1101`（`env.DB undefined`）。

## 部署到 Cloudflare Pages

### 1. 推送代码
把 `cms-trade/` 整个目录推到一个 GitHub（或 GitLab）仓库。

### 2. 创建 D1 数据库
在 Cloudflare Dashboard → **Workers & Pages → D1**，创建数据库 `cms-trade-db`，复制它的 **Database ID**。

### 3. 绑定 D1（Dashboard 手动，不使用 wrangler.toml）
本项目**不在仓库放 `wrangler.toml`**。代码推到仓库、在 Pages 创建项目后，在项目 **Settings → Bindings → Add binding** 添加：**Variable name `DB`** → D1 **`cms-trade-db`**，保存后 **Retry deployment**。仓库根一旦出现 `wrangler.toml` 会抢占绑定导致 `1101`，务必删除并重新 push。

### 4. 初始化表结构
本地安装并登录 wrangler 后执行。**全新数据库**执行 `schema.sql`（已含默认管理员和 v2+v3 全部表）；**已部署过旧版的库**执行 `migration.sql` 补齐 v2+v3（重复执行的 `ALTER` 报 `duplicate column` 属正常可忽略）：
```bash
npm install -g wrangler
wrangler login
wrangler d1 execute cms-trade-db --file=./schema.sql --remote      # 全新库
# 或（已部署旧库补齐 v2+v3）：
wrangler d1 execute cms-trade-db --file=./migration.sql --remote
```

### 5. 在 Cloudflare Pages 部署
Dashboard → **Workers & Pages → Create → Pages → Import from Git**：
- 选择仓库
- Build command 留空或 `npm install`
- Build output directory：`public`
- **Root directory**：`cms-trade`（仓库子目录，视仓库根而定）

部署完成后，在项目 **Settings → Bindings** 确认已绑定 `cms-trade-db` 到变量名 **`DB`**（见第 3 步）。

### 6. 配置环境变量 / Secrets
在项目 **Settings → Environment variables**：
- `SECRET_KEY`：JWT 签名密钥，任意长随机串（如 `openssl rand -hex 32`）
- `SMS_PROVIDER`：`mock`（默认）| `aliyun` | `tencent`

### 7. 管理员
默认管理员账号 **`djmy` / 密码 `000000`**（建库时自动创建，登录页可一键填入）。如需把其他注册用户提升为管理员：
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
