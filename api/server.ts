import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import firecrawlRoutes from './routes/firecrawl.js';
import { FirecrawlUnconfiguredError } from './services/firecrawlService.js';

// 加载环境变量
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件配置
app.use(helmet()); // 安全头部
app.use(morgan('combined')); // 日志记录
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true
}));
// 请求体只有 URL 列表与少量选项；10mb 上限只会放大滥用面。
app.use(express.json({ limit: '256kb' }));
app.use(express.urlencoded({ extended: true, limit: '256kb' }));

// 路由配置
app.use('/api/firecrawl', firecrawlRoutes);

// 健康检查端点
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'AI Web Scraper'
  });
});

// 根路径
app.get('/', (req, res) => {
  res.json({
    message: '欢迎使用 AI 网页信息抓取服务',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      firecrawl: '/api/firecrawl'
    }
  });
});

// 错误处理中间件
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err instanceof FirecrawlUnconfiguredError) {
    res.status(503).json({
      success: false,
      code: err.code,
      error: 'Firecrawl API key is not configured on the server'
    });
    return;
  }
  if (err?.type === 'entity.parse.failed' || err?.type === 'entity.too.large') {
    res.status(err.status ?? 400).json({ success: false, error: 'Invalid request body' });
    return;
  }
  console.error('服务器错误:', err);
  res.status(500).json({
    error: '内部服务器错误',
    message: process.env.NODE_ENV === 'development' ? err.message : '服务暂时不可用'
  });
});

// 404 处理
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// 启动服务器（被测试导入时不监听端口）
if (!process.env.VITEST) {
  app.listen(PORT, () => {
    console.log(`🚀 AI 网页抓取服务已启动`);
    console.log(`📡 服务地址: http://localhost:${PORT}`);
    console.log(`🔧 环境: ${process.env.NODE_ENV || 'development'}`);
    if (!process.env.FIRECRAWL_API_KEY) {
      console.warn('⚠️ 未配置 FIRECRAWL_API_KEY：抓取接口将返回 503');
    }
    const tokenLength = process.env.SCRAPER_API_TOKEN?.trim().length ?? 0;
    if (tokenLength === 0) {
      console.warn('⚠️ 未配置 SCRAPER_API_TOKEN：只接受本机直连请求；经反向代理部署必须配置 token');
    } else if (tokenLength < 24) {
      console.warn('⚠️ SCRAPER_API_TOKEN 短于 24 字符：视为配置错误，抓取接口将返回 503');
    }
  });
}

export default app;