import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

// 用合成 SDK 替换真实 Firecrawl，测试期间绝不发出外部请求。
const sdk = vi.hoisted(() => ({
  scrape: vi.fn(),
  startCrawl: vi.fn(),
  getCrawlStatus: vi.fn(),
  search: vi.fn(),
  map: vi.fn(),
  batchScrape: vi.fn(),
}));

vi.mock('@mendable/firecrawl-js', () => ({
  Firecrawl: class {
    scrape = sdk.scrape;
    startCrawl = sdk.startCrawl;
    getCrawlStatus = sdk.getCrawlStatus;
    search = sdk.search;
    map = sdk.map;
    batchScrape = sdk.batchScrape;
  },
}));

process.env.FIRECRAWL_API_KEY = 'fc-synthetic-test-key';

const { default: app } = await import('../api/server.js');
const { resetAccessControlState } = await import('../api/middleware/accessControl.js');

const TOKEN = 'synthetic-access-token-0123456789';

beforeEach(() => {
  Object.values(sdk).forEach((fn) => fn.mockReset());
  sdk.scrape.mockResolvedValue({ markdown: '# Hello', metadata: { title: 'T' } });
  sdk.startCrawl.mockResolvedValue({ id: 'job-1', url: 'https://example.com' });
  sdk.getCrawlStatus.mockResolvedValue({ status: 'completed', completed: 1, total: 1, data: [] });
  sdk.search.mockResolvedValue({ web: [{ url: 'https://example.com/a', title: 'A' }] });
  sdk.map.mockResolvedValue({ links: [{ url: 'https://example.com/a' }, { url: 'https://example.com/b' }] });
  sdk.batchScrape.mockResolvedValue({ status: 'completed', data: [{ markdown: 'x' }] });
  process.env.FIRECRAWL_API_KEY = 'fc-synthetic-test-key';
  delete process.env.SCRAPER_API_TOKEN;
  delete process.env.SCRAPER_RATE_LIMIT_PER_MINUTE;
  delete process.env.SCRAPER_DAILY_BUDGET;
  resetAccessControlState();
});

describe('计费路由访问控制', () => {
  it('配置 token 后：无 token / 错 token 返回 401，且不调用 Firecrawl', async () => {
    process.env.SCRAPER_API_TOKEN = TOKEN;
    const none = await request(app).post('/api/firecrawl/scrape').send({ url: 'https://example.com' });
    const wrong = await request(app)
      .post('/api/firecrawl/scrape')
      .set('Authorization', 'Bearer wrong-token-wrong-token-wrong-1234')
      .send({ url: 'https://example.com' });
    expect(none.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(sdk.scrape).not.toHaveBeenCalled();
  });

  it('配置 token 后：正确 token 通过', async () => {
    process.env.SCRAPER_API_TOKEN = TOKEN;
    const res = await request(app)
      .post('/api/firecrawl/scrape')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ url: 'https://example.com' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(sdk.scrape).toHaveBeenCalledTimes(1);
  });

  it('过短的 token 配置视为未配置（fail closed）', async () => {
    process.env.SCRAPER_API_TOKEN = 'short';
    const res = await request(app)
      .post('/api/firecrawl/scrape')
      .set('Authorization', 'Bearer short')
      .set('X-Forwarded-For', '203.0.113.9')
      .send({ url: 'https://example.com' });
    expect(res.status).toBe(503);
    expect(sdk.scrape).not.toHaveBeenCalled();
  });

  it('未配置 token：经代理转发的请求 503，不调用 Firecrawl', async () => {
    const res = await request(app)
      .post('/api/firecrawl/batch-extract')
      .set('X-Forwarded-For', '203.0.113.9')
      .send({ urls: ['https://example.com'] });
    expect(res.status).toBe(503);
    expect(res.body.code).toBe('ACCESS_TOKEN_UNCONFIGURED');
    expect(sdk.batchScrape).not.toHaveBeenCalled();
  });

  it('未配置 token：本机直连仍可用（保留本地扩展流程）', async () => {
    const res = await request(app).post('/api/firecrawl/scrape').send({ url: 'https://example.com' });
    expect(res.status).toBe(200);
  });

  it('非 JSON 表单 POST 被拒绝（阻断跨站简单请求消耗额度）', async () => {
    const res = await request(app)
      .post('/api/firecrawl/scrape')
      .type('form')
      .send({ url: 'https://example.com' });
    expect(res.status).toBe(415);
    expect(sdk.scrape).not.toHaveBeenCalled();
  });

  it('超过每分钟额度返回 429，批量请求按 URL 数计费', async () => {
    process.env.SCRAPER_RATE_LIMIT_PER_MINUTE = '3';
    for (let i = 0; i < 3; i += 1) {
      const ok = await request(app).post('/api/firecrawl/scrape').send({ url: 'https://example.com' });
      expect(ok.status).toBe(200);
    }
    const limited = await request(app).post('/api/firecrawl/scrape').send({ url: 'https://example.com' });
    expect(limited.status).toBe(429);
    expect(limited.headers['retry-after']).toBeDefined();
    expect(sdk.scrape).toHaveBeenCalledTimes(3);

    // 批量请求按 URL 数计费：容量 5，第一批 4 个通过，第二批 4 个超出本分钟剩余额度。
    resetAccessControlState();
    process.env.SCRAPER_RATE_LIMIT_PER_MINUTE = '5';
    const urls = ['https://a.example', 'https://b.example', 'https://c.example', 'https://d.example'];
    const firstBatch = await request(app).post('/api/firecrawl/batch-extract').send({ urls });
    expect(firstBatch.status).toBe(200);
    const batch = await request(app).post('/api/firecrawl/batch-extract').send({ urls });
    expect(batch.status).toBe(429);
    expect(sdk.batchScrape).toHaveBeenCalledTimes(1);
  });

  it('超过每日预算返回 429', async () => {
    process.env.SCRAPER_DAILY_BUDGET = '1';
    const ok = await request(app).post('/api/firecrawl/scrape').send({ url: 'https://example.com' });
    const limited = await request(app).post('/api/firecrawl/scrape').send({ url: 'https://example.com' });
    expect(ok.status).toBe(200);
    expect(limited.status).toBe(429);
  });

  it('只能查询本服务启动的 crawl 任务', async () => {
    const unknown = await request(app).get('/api/firecrawl/crawl/someone-elses-job');
    expect(unknown.status).toBe(404);
    expect(sdk.getCrawlStatus).not.toHaveBeenCalled();

    const started = await request(app).post('/api/firecrawl/crawl').send({ url: 'https://example.com' });
    expect(started.body.jobId).toBe('job-1');
    const known = await request(app).get('/api/firecrawl/crawl/job-1');
    expect(known.status).toBe(200);
    expect(known.body.status).toBe('completed');
  });
});

describe('输入边界', () => {
  it('无效 body 返回 400 与字段明细（不是 500）', async () => {
    const res = await request(app).post('/api/firecrawl/scrape').send({});
    expect(res.status).toBe(400);
    expect(res.body.details[0].field).toBe('url');
  });

  it.each(['file:///etc/passwd', 'javascript:alert(1)', 'ftp://example.com/x', 'https://user:pw@example.com/'])(
    '拒绝非 http(s) 或带凭据的 URL：%s',
    async (url) => {
      const res = await request(app).post('/api/firecrawl/scrape').send({ url });
      expect(res.status).toBe(400);
      expect(sdk.scrape).not.toHaveBeenCalled();
    },
  );

  it('crawl 未给 limit 时使用保守默认值，超上限被拒绝', async () => {
    await request(app).post('/api/firecrawl/crawl').send({ url: 'https://example.com' });
    expect(sdk.startCrawl.mock.calls[0]?.[1]?.limit).toBe(10);
    const tooBig = await request(app)
      .post('/api/firecrawl/crawl')
      .send({ url: 'https://example.com', options: { limit: 100000 } });
    expect(tooBig.status).toBe(400);
  });
});

describe('Firecrawl SDK v4 合同', () => {
  it('search 返回 web 结果，而不是永远空数组', async () => {
    const res = await request(app).post('/api/firecrawl/search').send({ query: 'hello' });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([{ url: 'https://example.com/a', title: 'A' }]);
  });

  it('map 调用 map 接口而不是启动 100 页 crawl', async () => {
    const res = await request(app).post('/api/firecrawl/map').send({ url: 'https://example.com' });
    expect(sdk.startCrawl).not.toHaveBeenCalled();
    expect(res.body.urls).toEqual(['https://example.com/a', 'https://example.com/b']);
    expect(res.body.totalUrls).toBe(2);
  });

  it('crawl 选项映射到 v2 字段', async () => {
    await request(app)
      .post('/api/firecrawl/crawl')
      .send({ url: 'https://example.com', options: { limit: 5, maxDepth: 2, formats: ['markdown'], onlyMainContent: true } });
    expect(sdk.startCrawl.mock.calls[0]?.[1]).toEqual({
      limit: 5,
      maxDiscoveryDepth: 2,
      scrapeOptions: { formats: ['markdown'], onlyMainContent: true },
    });
  });

  it('batch-extract 把抓取选项放进 options，未完成的批任务不报成功', async () => {
    await request(app)
      .post('/api/firecrawl/batch-extract')
      .send({ urls: ['https://example.com'], options: { formats: ['markdown'], onlyMainContent: true } });
    expect(sdk.batchScrape.mock.calls[0]?.[1]).toEqual({ options: { formats: ['markdown'], onlyMainContent: true } });

    sdk.batchScrape.mockResolvedValueOnce({ status: 'failed', data: [] });
    const failed = await request(app).post('/api/firecrawl/batch-extract').send({ urls: ['https://example.com'] });
    expect(failed.body.success).toBe(false);
  });
});

describe('未配置 Firecrawl key', () => {
  it('计费路由返回 503，健康检查仍可用，进程不崩溃', async () => {
    delete process.env.FIRECRAWL_API_KEY;
    const res = await request(app).post('/api/firecrawl/scrape').send({ url: 'https://example.com' });
    expect(res.status).toBe(503);
    expect(res.body.code).toBe('FIRECRAWL_UNCONFIGURED');
    const health = await request(app).get('/health');
    expect(health.status).toBe(200);
  });
});
