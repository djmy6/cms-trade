# Dianshi TVBox 配置 · Cloudflare Pages 部署包

将本目录部署到 Cloudflare Pages，即可获得一个可订阅的 TVBox 影视聚合配置地址。

## 目录内容

```
dianshi-pages/
├─ index.html      # 订阅引导页（含地址复制 + 配置概览 + 部署指引）
├─ dianshi.json    # TVBox 配置源（订阅的实质文件）
├─ README.md       # 本说明
├─ tv.txt          # 直播源列表（2313 频道 / 39 分类，已合并多个公开源）
├─ jar/spider.jar  # 爬虫核心 jar
├─ lib/drpy2.min.js# 脚本源运行时库
├─ js/             # 脚本源（24 个：drpy/新闪雷/茶杯狐/优酷/腾云驾雾 等）
├─ py/             # Python 源（7 个：华数/华谊/OleLive/Ncat 等）
└─ json/           # 内置数据（4 个：少儿/小学/初中/高中课堂）
```

> `lib/ js/ py/ json/ jar/ tv.txt` 均已随站自包含，与 `dianshi.json` 内的 `./` 相对引用一一对应（38/38），保持相对结构即可被客户端解析。

## 部署方法（二选一）

### 方式一：网页直传（最快）
1. 打开 <https://dash.cloudflare.com> → **Workers & Pages** → **创建** → **Pages** → **上传资产**。
2. 把本目录整个拖入上传框（或选择目录）。
3. 部署完成即得域名，例如 `https://dianshi.pages.dev`。

### 方式二：连接 Git
1. 把本目录推到一个 Git 仓库（根目录包含 `index.html` 和 `dianshi.json`）。
2. 在 Cloudflare Pages 创建项目并连接该仓库。
3. **框架预设选「无」、构建命令留空、输出目录留空**（纯静态），保存即可。

## 订阅用法

部署后，将下面的地址填入 TVBox 类客户端的「订阅地址」：

```
https://<你的项目名>.pages.dev/dianshi.json
```

- 引导页：`https://<你的项目名>.pages.dev/`（可选，非必须）
- 若想用自定义域名，在 Cloudflare Pages 项目 → 自定义域 里绑定即可。

## 说明

- 配置来自 `dianshi.json`（**49 个源** / 7 个直播源 / 1 条规则）。
- 以 **fantaiying7/EXT 系**配置为基础重新生成的完整版：全部为内置 `csp_*` / 远程脚本源（含玩偶哥哥 4K 弹幕、光影/厂长/海绵/多线/动漫/直播/网盘/儿童课堂等），**无需本地脚本库**，远程依赖均已校验可达。
- `tv.txt` 已填充 2313 个直播频道（39 分类，央视/卫视/地方台/iptv-org 公共源 + 虎牙·斗鱼·YY 轮播），已在配置 lives 中挂载；如需追加频道，按 TVBox 格式（`分组,#genre#` + `频道,#url#`）续写即可。
- 站点为纯静态，无后端、无构建、无数据库，因此可免费部署在 Cloudflare Pages。
