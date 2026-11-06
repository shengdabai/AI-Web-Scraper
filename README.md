# AI信息抓取 — 开发者友好的网页数据提取 API

> **一行代码提取任意网页的结构化数据** — 基于 Firecrawl 的智能网页抓取服务，提供 RESTful API + Chrome 扩展。

[![CI](https://github.com/shengdabai/ai-web-scraper/actions/workflows/ci.yml/badge.svg)](https://github.com/shengdabai/ai-web-scraper/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-MIT-green)]()
[![Node](https://img.shields.io/badge/node-20+-brightgreen)]()

## 产品简介

AI信息抓取是一个基于 Firecrawl SDK 封装的 REST API 服务，为开发者和内容创作者提供开箱即用的网页数据提取能力。支持单页抓取、整站爬取、批量提取、智能搜索和站点地图发现。

**适合谁用：**
- 独立开发者：快速集成网页抓取能力到自己的应用
- 内容创作者：批量提取竞品网站内容用于分析
- 数据分析师：结构化采集公开网页数据
- 研究人员：追踪网站变化和监控信息更新

## 核心功能

### API 端点

| 端点 | 功能 | 说明 |
|------|------|------|
| `POST /api/firecrawl/scrape` | 单页抓取 | 指定 URL 抓取内容，支持 Markdown/HTML 输出 |
| `POST /api/firecrawl/extract-text` | 文字提取 | 自动清理网页噪音，提取纯文本 |
| `POST /api/firecrawl/crawl` | 整站爬取 | 自动发现并抓取目标网站所有页面 |
| `GET /api/firecrawl/crawl/:jobId` | 任务状态 | 查询异步爬取任务进度 |
| `POST /api/firecrawl/batch-extract` | 批量提取 | 一次提交最多 50 个 URL |
| `POST /api/firecrawl/search` | 智能搜索 | 基于关键词搜索相关网页 |
| `POST /api/firecrawl/map` | 站点地图 | 发现网站所有可访问的 URL |
| `GET /api/firecrawl/health` | 健康检查 | 服务状态探针 |

### Chrome 扩展

附带 NotebookLM 笔记下载器 Chrome 扩展(MV3)，一键导出 NotebookLM 笔记到本地。

## 快速开始

### 1. 安装依赖

```bash
pnpm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env`，填入你的 Firecrawl API Key：

```env
FIRECRAWL_API_KEY=your_firecrawl_api_key_here
PORT=3000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
```

### 3. 启动服务

```bash
pnpm dev
```

服务运行在 `http://localhost:3000`，所有 8 个 API 端点立即可用。

### 4. 调用示例

```bash
# 单页抓取
curl -X POST http://localhost:3000/api/firecrawl/scrape \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com", "formats": ["markdown"]}'

# 批量提取
curl -X POST http://localhost:3000/api/firecrawl/batch-extract \
  -H "Content-Type: application/json" \
  -d '{"urls": ["https://example1.com", "https://example2.com"]}'
```

## 技术架构

```
API (Express 5.1 + TypeScript strict)
  ↓
Service Layer (Firecrawl SDK 封装)
  ↓
Firecrawl Cloud API
```

- TypeScript 5.9 + 12 项严格检查
- Express 5.1 + Helmet 安全头 + CORS + Morgan 日志
- 分层架构：routes → services → utils
- Chrome Extension MV3

## 定价计划

| 计划 | 价格 | 功能 |
|------|------|------|
| 免费版 | ¥0 | 每日 100 次 API 调用，单页抓取 |
| 专业版 | ¥99/月 | 每日 5000 次，批量提取 + 整站爬取 |
| 企业版 | ¥499/月 | 无限调用 + 优先支持 + 私有部署 |

> 当前为开源免费使用阶段，定价计划在验证用户规模后生效。

## 开发

```bash
# 类型检查
pnpm check

# 代码检查
pnpm lint

# 构建
pnpm build

# 生产启动
pnpm start
```

## 部署指南

### Vercel（前端 Landing Page）

```bash
vercel --prod
```

### Railway（后端 API）

1. 在 Railway 创建新项目
2. 连接 GitHub 仓库
3. Railway 自动检测 `railway.json` 和 `Dockerfile`
4. 设置环境变量 `FIRECRAWL_API_KEY`
5. 设置环境变量 `SCRAPER_API_TOKEN`（至少 24 个随机字符）。所有抓取接口都要求 `Authorization: Bearer <token>`；
   未设置时服务只接受本机直连请求（回环地址、`Host` 为 localhost/127.0.0.1/[::1]、无转发头），其余一律返回 503，
   避免服务端 Firecrawl 额度被匿名消耗。设置了但短于 24 字符视为配置错误，所有抓取接口返回 503。
   **经反向代理部署（含同机 nginx/Caddy）必须配置 token**：不添加转发头的同机代理在应用层无法与本机客户端区分。
6. 可选：`SCRAPER_RATE_LIMIT_PER_MINUTE`（默认 30）与 `SCRAPER_DAILY_BUDGET`（默认 500）按请求成本限额
  （批量按 URL 数、crawl 按 `limit` 计）。计数保存在进程内存中，重启清零、多实例不共享。
   单次成本超过容量的请求（例如默认配置下 crawl `limit` > 30）返回 400 `COST_EXCEEDS_LIMIT`，需调高额度或减小请求。
5. 部署后 Railway 提供公网 URL

### Docker

```bash
docker build -t ai-web-scraper .
docker run -p 3000:3000 -e FIRECRAWL_API_KEY=your_key ai-web-scraper
```

## 项目结构

```
AI信息抓取/
├── api/
│   ├── routes/firecrawl.ts     # 8 个 API 端点
│   ├── services/firecrawlService.ts
│   └── server.ts               # Express 入口
├── extension/                  # Chrome 扩展 (MV3)
├── public/                     # Landing Page (SEO + OG)
├── docs/
│   └── firecrawl-guide.md      # 详细使用指南
├── __tests__/                  # 单元测试 + 集成测试
├── examples/                   # 调用示例
├── Dockerfile                  # 生产镜像
├── railway.json                # Railway 部署配置
└── .github/
    ├── FUNDING.yml             # GitHub 赞助
    └── workflows/ci.yml        # CI 自动化
```

## 环境要求

- Node.js >= 18.0.0
- TypeScript >= 5.0.0
- Firecrawl API Key (免费额度 500 次/月)

## 支持项目

如果这个工具对你有帮助，欢迎 [赞助支持](https://github.com/sponsors/shengdabai) ☕

---

**AI信息抓取** — 一行代码提取任意网页的结构化数据
