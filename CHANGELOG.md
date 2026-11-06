# Changelog

All notable changes to AI信息抓取 will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.1.0] - 2026-05-16

### Added
- Railway 部署配置 (`railway.json`)
- 多阶段 Dockerfile，生产镜像仅包含运行依赖
- Landing Page (SEO + OG tags + JSON-LD structured data)
- API 集成测试 (`__tests__/server.test.ts`)
- CI 新增部署阶段（lint + typecheck + test）
- CHANGELOG.md

### Changed
- README 增加部署指南（Vercel + Railway）
- CI 增加 test job 并行执行

## [1.0.0] - 2026-05-07

### Added
- 8 个 Firecrawl API 端点
- Zod 请求校验（7 个 schema + validateWith 中间件）
- Chrome Extension MV3（NotebookLM 笔记下载器）
- 24 个 vitest 单元测试
- GitHub Actions CI（lint + typecheck + test）
- FUNDING.yml（GitHub 赞助）
- 完整 API 文档 (`docs/firecrawl-guide.md`)
- 定价计划（免费版/专业版¥99/月/企业版¥499/月）
