import { Router, Request, Response, RequestHandler } from 'express';
import { firecrawlService } from '../services/firecrawlService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  validateWith,
  scrapeSchema,
  extractTextSchema,
  crawlSchema,
  searchSchema,
  mapSchema,
  batchExtractSchema,
  DEFAULT_CRAWL_LIMIT,
  DEFAULT_SEARCH_LIMIT,
} from '../validations/firecrawl.js';
import { requireAccess, chargeCost, rememberJob, ownsJob } from '../middleware/accessControl.js';

const router = Router();

// 健康检查不消耗额度，保持公开；其后的所有路由都会调用付费的 Firecrawl 接口。
router.get('/health', asyncHandler(async (_req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Firecrawl service is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
}));

router.use(requireAccess);

const single = chargeCost(() => 1);

/**
 * @route POST /api/firecrawl/scrape
 * @desc 抓取单个网页内容
 * @body { url: string, options?: object }
 */
router.post('/scrape', validateWith(scrapeSchema), single, asyncHandler(async (req: Request, res: Response) => {
  const { url, options } = req.validatedBody;
  const result = await firecrawlService.scrapeUrl(url, options);
  res.json(result);
}));

/**
 * @route POST /api/firecrawl/extract-text
 * @desc 提取网页上的所有文字内容
 * @body { url: string, cleanText?: boolean }
 */
router.post('/extract-text', validateWith(extractTextSchema), single, asyncHandler(async (req: Request, res: Response) => {
  const { url, cleanText } = req.validatedBody;
  const result = await firecrawlService.extractText(url, cleanText);
  res.json(result);
}));

/**
 * @route POST /api/firecrawl/crawl
 * @desc 爬取整个网站的所有页面
 * @body { url: string, options?: object }
 */
router.post('/crawl', validateWith(crawlSchema), chargeCost((req) => req.validatedBody?.options?.limit ?? DEFAULT_CRAWL_LIMIT), asyncHandler(async (req: Request, res: Response) => {
  const { url, options } = req.validatedBody;
  const result = await firecrawlService.crawlWebsite(url, options);
  if (result.success && result.jobId) {
    rememberJob(req, result.jobId);
  }
  res.json(result);
}));

/**
 * @route GET /api/firecrawl/crawl/:jobId
 * @desc 检查爬取任务状态
 * @param jobId - 爬取任务ID
 */
// 先校验 ID 与任务归属、再扣额度：否则任意网页可用未知 jobId 的简单 GET 耗尽本机额度。
const requireOwnedJob: RequestHandler = (req, res, next) => {
  const jobId = typeof req.params.jobId === 'string' ? req.params.jobId : '';

  if (!jobId || jobId.length > 128) {
    res.status(400).json({
      success: false,
      error: 'Job ID is required'
    });
    return;
  }

  // 只允许查询由同一调用方通过本服务启动的任务，避免凭任意 jobId 读取他人结果。
  if (!ownsJob(req, jobId)) {
    res.status(404).json({
      success: false,
      error: 'Crawl job not found'
    });
    return;
  }
  next();
};

router.get('/crawl/:jobId', requireOwnedJob, single, asyncHandler(async (req: Request, res: Response) => {
  // requireOwnedJob 已保证 jobId 是非空字符串。
  const result = await firecrawlService.getCrawlStatus(String(req.params.jobId));
  res.json(result);
}));

/**
 * @route POST /api/firecrawl/search
 * @desc 搜索网站相关内容
 * @body { query: string, options?: object }
 */
router.post('/search', validateWith(searchSchema), chargeCost((req) => req.validatedBody?.options?.limit ?? DEFAULT_SEARCH_LIMIT), asyncHandler(async (req: Request, res: Response) => {
  const { query, options } = req.validatedBody;
  const result = await firecrawlService.searchWebsite(query, options);
  res.json(result);
}));

/**
 * @route POST /api/firecrawl/map
 * @desc 获取网站地图（所有可访问的URL）
 * @body { url: string }
 */
router.post('/map', validateWith(mapSchema), single, asyncHandler(async (req: Request, res: Response) => {
  const { url } = req.validatedBody;
  const result = await firecrawlService.mapWebsite(url);
  res.json(result);
}));

/**
 * @route POST /api/firecrawl/batch-extract
 * @desc 批量提取多个URL的文字内容
 * @body { urls: string[], options?: { cleanText?: boolean, concurrency?: number } }
 */
router.post('/batch-extract', validateWith(batchExtractSchema), chargeCost((req) => req.validatedBody?.urls?.length ?? 1), asyncHandler(async (req: Request, res: Response) => {
  const { urls, options } = req.validatedBody;
  const result = await firecrawlService.batchExtractText(urls, options);
  res.json(result);
}));

export default router;
