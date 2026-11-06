# Firecrawl 网页文字提取完整指南

## 📖 概述

Firecrawl 是一个强大的网页抓取和文字提取工具，本项目已集成 Firecrawl SDK，提供了完整的 API 接口和使用示例。

## 🚀 快速开始

### 1. 环境配置

首先需要获取 Firecrawl API Key：

1. 访问 [Firecrawl 官网](https://firecrawl.dev)
2. 注册账号并获取 API Key
3. 在项目根目录创建 `.env` 文件（如果不存在）
4. 添加以下配置：

```bash
# Firecrawl API 配置
FIRECRAWL_API_KEY=your_api_key_here
```

### 2. 启动服务

```bash
# 安装依赖（如果还未安装）
pnpm install

# 启动开发服务器
pnpm run dev
```

服务启动后，API 将在 `http://localhost:3000/api/firecrawl` 可用。

## 📋 API 接口文档

### 基础 URL
```
http://localhost:3000/api/firecrawl
```

### 1. 健康检查

**GET** `/health`

检查 Firecrawl 服务状态。

**响应示例：**
```json
{
  "status": "ok",
  "service": "firecrawl",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 2. 提取网页文字

**POST** `/extract-text`

提取指定网页的纯文字内容。

**请求体：**
```json
{
  "url": "https://example.com",
  "cleanText": true  // 可选，是否清理文字格式
}
```

**响应示例：**
```json
{
  "text": "网页的纯文字内容...",
  "wordCount": 1250,
  "metadata": {
    "title": "网页标题",
    "description": "网页描述",
    "url": "https://example.com"
  }
}
```

### 3. 抓取网页内容

**POST** `/scrape`

抓取网页的完整内容，包括 HTML 和 Markdown 格式。

**请求体：**
```json
{
  "url": "https://example.com",
  "options": {
    "formats": ["markdown", "html"],
    "onlyMainContent": true,
    "excludeTags": ["script", "style", "nav", "footer"]
  }
}
```

**响应示例：**
```json
{
  "success": true,
  "url": "https://example.com",
  "data": {
    "markdown": "# 标题\n\n内容...",
    "html": "<h1>标题</h1><p>内容...</p>",
    "metadata": {
      "title": "网页标题",
      "description": "网页描述",
      "sourceURL": "https://example.com"
    }
  }
}
```

### 4. 获取网站地图

**POST** `/map`

获取网站的所有可访问页面列表。

**请求体：**
```json
{
  "url": "https://example.com"
}
```

**响应示例：**
```json
{
  "success": true,
  "totalUrls": 25,
  "urls": [
    "https://example.com",
    "https://example.com/about",
    "https://example.com/contact"
  ]
}
```

### 5. 爬取整个网站

**POST** `/crawl`

启动网站爬取任务，异步处理多个页面。

**请求体：**
```json
{
  "url": "https://example.com",
  "options": {
    "limit": 10,
    "maxDepth": 2,
    "formats": ["markdown"]
  }
}
```

**响应示例：**
```json
{
  "success": true,
  "jobId": "crawl_123456789",
  "url": "https://example.com"
}
```

### 6. 查询爬取状态

**GET** `/crawl/:jobId/status`

查询爬取任务的进度和结果。

**响应示例：**
```json
{
  "status": "completed",
  "total": 10,
  "completed": 10,
  "creditsUsed": 10,
  "expiresAt": "2024-01-01T01:00:00.000Z",
  "data": [
    {
      "markdown": "# 页面内容...",
      "metadata": {
        "title": "页面标题",
        "sourceURL": "https://example.com/page1"
      }
    }
  ]
}
```

### 7. 批量提取文字

**POST** `/batch-extract`

批量提取多个网页的文字内容。

**请求体：**
```json
{
  "urls": [
    "https://example.com",
    "https://example.org"
  ],
  "options": {
    "cleanText": true,
    "concurrency": 3
  }
}
```

**响应示例：**
```json
{
  "success": true,
  "totalWords": 2500,
  "results": [
    {
      "url": "https://example.com",
      "text": "网页内容...",
      "wordCount": 1250,
      "metadata": {
        "title": "网页标题"
      }
    },
    {
      "url": "https://example.org",
      "error": "无法访问该网页"
    }
  ]
}
```

## 💻 使用示例

### 1. 命令行示例

项目提供了完整的 TypeScript 示例文件：

```bash
# 运行示例代码
cd examples
node --loader ts-node/esm firecrawl-usage.ts
```

### 2. 网页演示

打开 `examples/firecrawl-demo.html` 文件，在浏览器中体验可视化的文字提取功能。

### 3. cURL 示例

```bash
# 提取网页文字
curl -X POST http://localhost:3000/api/firecrawl/extract-text \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com", "cleanText": true}'

# 抓取网页内容
curl -X POST http://localhost:3000/api/firecrawl/scrape \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "options": {
      "formats": ["markdown"],
      "onlyMainContent": true
    }
  }'
```

### 4. JavaScript/TypeScript 示例

```typescript
// 提取网页文字
async function extractWebText(url: string) {
  const response = await fetch('http://localhost:3000/api/firecrawl/extract-text', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ url, cleanText: true })
  });
  
  const result = await response.json();
  console.log('提取的文字:', result.text);
  console.log('字数统计:', result.wordCount);
  return result;
}

// 使用示例
extractWebText('https://example.com');
```

## ⚙️ 配置选项

### 文字提取选项

- `cleanText`: 是否清理文字格式（去除多余空格、换行等）
- `includeMetadata`: 是否包含页面元数据

### 网页抓取选项

- `formats`: 输出格式 `["markdown", "html", "rawHtml"]`
- `onlyMainContent`: 只提取主要内容，过滤导航、广告等
- `excludeTags`: 排除的 HTML 标签列表
- `includeTags`: 只包含的 HTML 标签列表
- `waitFor`: 等待时间（毫秒）

### 爬取选项

- `limit`: 最大页面数量
- `maxDepth`: 最大爬取深度
- `allowedDomains`: 允许的域名列表
- `excludePaths`: 排除的路径模式

## 🔧 故障排除

### 常见问题

1. **API Key 错误**
   - 确保 `.env` 文件中的 `FIRECRAWL_API_KEY` 正确
   - 检查 API Key 是否有效且未过期

2. **网络连接问题**
   - 确保目标网站可以正常访问
   - 检查防火墙和代理设置

3. **内容提取失败**
   - 某些网站可能有反爬虫机制
   - 尝试调整 `waitFor` 参数
   - 检查网站是否需要 JavaScript 渲染

4. **服务器错误**
   - 检查服务器日志
   - 确保所有依赖已正确安装

### 错误代码

- `400`: 请求参数错误
- `401`: API Key 无效
- `403`: 访问被拒绝
- `404`: 页面不存在
- `429`: 请求频率过高
- `500`: 服务器内部错误

## 📊 性能优化

### 批量处理建议

1. **控制并发数量**: 建议并发数不超过 5
2. **设置合理的超时**: 单个请求超时时间 30-60 秒
3. **错误重试机制**: 实现指数退避重试
4. **缓存结果**: 对相同 URL 的结果进行缓存

### 成本控制

1. **使用 `onlyMainContent`**: 减少不必要的内容抓取
2. **合理设置 `limit`**: 避免爬取过多页面
3. **监控 API 使用量**: 定期检查积分消耗

## 🔗 相关链接

- [Firecrawl 官方文档](https://docs.firecrawl.dev)
- [Firecrawl GitHub 仓库](https://github.com/firecrawl/firecrawl)
- [API 参考文档](https://docs.firecrawl.dev/api-reference)

## 📝 更新日志

### v1.0.0 (2024-01-01)
- ✅ 集成 Firecrawl SDK
- ✅ 实现完整的 API 接口
- ✅ 提供使用示例和文档
- ✅ 支持批量处理和异步爬取

---

如有问题或建议，请查看项目文档或联系开发团队。