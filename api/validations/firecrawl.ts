import { z } from 'zod';

// 通用 URL 验证
// 只接受不带凭据的 http(s) 地址；file:、javascript: 等 scheme 不应被转交给抓取服务。
export const urlSchema = z.string().max(2048, 'URL is too long').url('Invalid URL format').refine((value) => {
  try {
    const parsed = new URL(value);
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && !parsed.username && !parsed.password;
  } catch {
    return false;
  }
}, 'Only http(s) URLs without credentials are allowed');

export const DEFAULT_CRAWL_LIMIT = 10;
export const MAX_CRAWL_LIMIT = 100;
export const DEFAULT_SEARCH_LIMIT = 5;
export const MAX_SEARCH_LIMIT = 20;
const FORMATS = ['markdown', 'html', 'rawHtml', 'screenshot', 'links'] as const;

// POST /api/firecrawl/scrape
export const scrapeSchema = z.object({
  url: urlSchema,
  options: z.object({
    formats: z.array(z.enum(FORMATS)).optional(),
    onlyMainContent: z.boolean().optional(),
    includeTags: z.array(z.string()).optional(),
    excludeTags: z.array(z.string()).optional(),
    waitFor: z.number().int().min(0).max(30_000).optional(),
    timeout: z.number().int().min(1_000).max(120_000).optional(),
  }).optional(),
});

// POST /api/firecrawl/extract-text
export const extractTextSchema = z.object({
  url: urlSchema,
  cleanText: z.boolean().optional().default(true),
});

// POST /api/firecrawl/crawl
export const crawlSchema = z.object({
  url: urlSchema,
  options: z.object({
    // Firecrawl 在缺省 limit 时会爬取上万页；这里强制保守默认值与上限。
    limit: z.number().int().min(1).max(MAX_CRAWL_LIMIT).default(DEFAULT_CRAWL_LIMIT),
    maxDepth: z.number().int().min(0).max(10).optional(),
    // Firecrawl v2 没有 allowedDomains；静默忽略会让调用方误以为范围已被限制。
    allowedDomains: z.array(z.string()).max(0, 'allowedDomains is not supported by Firecrawl v2; use includePaths/excludePaths').optional(),
    excludePaths: z.array(z.string()).optional(),
    includePaths: z.array(z.string()).optional(),
    formats: z.array(z.enum(FORMATS)).optional(),
    onlyMainContent: z.boolean().optional(),
    timeout: z.number().int().min(1_000).max(120_000).optional(),
  }).default({ limit: DEFAULT_CRAWL_LIMIT }),
});

// POST /api/firecrawl/search
export const searchSchema = z.object({
  query: z.string().trim().min(1, 'Search query is required').max(500, 'Search query is too long'),
  options: z.object({
    limit: z.number().int().min(1).max(MAX_SEARCH_LIMIT).default(DEFAULT_SEARCH_LIMIT),
  }).default({ limit: DEFAULT_SEARCH_LIMIT }),
});

// POST /api/firecrawl/map
export const mapSchema = z.object({
  url: urlSchema,
});

// POST /api/firecrawl/batch-extract
export const batchExtractSchema = z.object({
  urls: z.array(urlSchema).min(1, 'URLs array is required').max(50, 'Maximum 50 URLs allowed per batch'),
  options: z.object({
    formats: z.array(z.enum(FORMATS)).optional(),
    onlyMainContent: z.boolean().optional(),
  }).optional(),
});

// 验证中间件工厂
export function validateWith<T extends z.ZodTypeAny>(schema: T) {
  return (req: any, res: any, next: any) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request body',
        details: result.error.issues.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      });
    }
    // 将验证后的数据附加到请求上
    req.validatedBody = result.data;
    next();
  };
}
