import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

// 双模型交叉审核（2026-09-18）发现的回归用例。合成 SDK，测试期间绝不发出外部请求。
const sdk = vi.hoisted(() => ({
  scrape: vi.fn(),
  startCrawl: vi.fn(),
  getCrawlStatus: vi.fn(),
  batchScrape: vi.fn(),
}));

vi.mock('@mendable/firecrawl-js', () => ({
  Firecrawl: class {
    scrape = sdk.scrape;
    startCrawl = sdk.startCrawl;
    getCrawlStatus = sdk.getCrawlStatus;
    batchScrape = sdk.batchScrape;
  },
}));

process.env.FIRECRAWL_API_KEY = 'fc-synthetic-test-key';

const { default: app } = await import('../api/server.js');
const { resetAccessControlState } = await import('../api/middleware/accessControl.js');

const TOKEN = 'synthetic-access-token-0123456789';
const scrape = () => request(app).post('/api/firecrawl/scrape');

beforeEach(() => {
  Object.values(sdk).forEach((fn) => fn.mockReset());
  sdk.scrape.mockResolvedValue({ markdown: '# Hello', metadata: { title: 'T' } });
  sdk.startCrawl.mockResolvedValue({ id: 'job-1', url: 'https://example.com' });
  sdk.getCrawlStatus.mockResolvedValue({ status: 'completed', completed: 1, total: 1, data: [] });
  sdk.batchScrape.mockResolvedValue({ status: 'completed', data: [{ markdown: 'x' }] });
  process.env.FIRECRAWL_API_KEY = 'fc-synthetic-test-key';
  delete process.env.SCRAPER_API_TOKEN;
  delete process.env.SCRAPER_RATE_LIMIT_PER_MINUTE;
  delete process.env.SCRAPER_DAILY_BUDGET;
  resetAccessControlState();
});

describe('无 token 的本机模式边界', () => {
  it('过短 token 是配置错误：本机直连也 503，不回退本机模式', async () => {
    process.env.SCRAPER_API_TOKEN = 'short';
    const res = await scrape().send({ url: 'https://example.com' });
    expect(res.status).toBe(503);
    expect(res.body.code).toBe('ACCESS_TOKEN_INVALID');
    expect(sdk.scrape).not.toHaveBeenCalled();
  });

  it('Host 不是回环主机名时拒绝（DNS rebinding）', async () => {
    const res = await scrape().set('Host', 'evil.example:3000').send({ url: 'https://example.com' });
    expect(res.status).toBe(503);
    expect(sdk.scrape).not.toHaveBeenCalled();
  });

  it('localhost / 127.0.0.1 / [::1] 的 Host 仍可用', async () => {
    for (const host of ['localhost:3000', '127.0.0.1:3000', '[::1]:3000', 'LOCALHOST']) {
      const res = await scrape().set('Host', host).send({ url: 'https://example.com' });
      expect(res.status, host).toBe(200);
    }
  });

  it('只带 X-Forwarded-Proto 或 Via 的代理请求也被拒绝', async () => {
    for (const [name, value] of [['X-Forwarded-Proto', 'https'], ['Via', '1.1 proxy']]) {
      const res = await scrape().set(name, value).send({ url: 'https://example.com' });
      expect(res.status, name).toBe(503);
    }
    expect(sdk.scrape).not.toHaveBeenCalled();
  });
});

describe('token 模式', () => {
  it('Bearer scheme 大小写不敏感', async () => {
    process.env.SCRAPER_API_TOKEN = TOKEN;
    for (const scheme of ['bearer', 'BEARER', 'Bearer']) {
      const res = await scrape().set('Authorization', `${scheme} ${TOKEN}`).send({ url: 'https://example.com' });
      expect(res.status, scheme).toBe(200);
    }
  });

  it('同一 token 的额度与任务归属不随来源 IP 变化', async () => {
    const { requireAccess } = await import('../api/middleware/accessControl.js');
    process.env.SCRAPER_API_TOKEN = TOKEN;
    const ids = ['198.51.100.1', '203.0.113.7'].map((remoteAddress) => {
      const res = { locals: {} as Record<string, unknown>, status: vi.fn().mockReturnThis(), json: vi.fn() };
      const req = {
        method: 'GET',
        headers: { authorization: `Bearer ${TOKEN}` },
        socket: { remoteAddress },
        is: () => false,
      };
      const next = vi.fn();
      requireAccess(req as never, res as never, next);
      expect(next).toHaveBeenCalled();
      return res.locals.clientId;
    });
    expect(ids[0]).toBe(ids[1]);
  });
});

describe('额度语义', () => {
  it('单次成本超过容量返回 400 COST_EXCEEDS_LIMIT，不给误导性的 Retry-After', async () => {
    for (const limit of [31, 50, 100]) {
      const res = await request(app).post('/api/firecrawl/crawl').send({ url: 'https://example.com', options: { limit } });
      expect(res.status, String(limit)).toBe(400);
      expect(res.body.code).toBe('COST_EXCEEDS_LIMIT');
      expect(res.headers['retry-after']).toBeUndefined();
    }
    expect(sdk.startCrawl).not.toHaveBeenCalled();

    const ok = await request(app).post('/api/firecrawl/crawl').send({ url: 'https://example.com', options: { limit: 30 } });
    expect(ok.status).toBe(200);
  });

  it('未知或畸形 jobId 的 GET 不消耗额度', async () => {
    process.env.SCRAPER_RATE_LIMIT_PER_MINUTE = '2';
    for (let i = 0; i < 5; i += 1) {
      const res = await request(app).get(`/api/firecrawl/crawl/unknown-${i}`);
      expect(res.status).toBe(404);
    }
    const first = await scrape().send({ url: 'https://example.com' });
    const second = await scrape().send({ url: 'https://example.com' });
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
  });

  it('自己的任务状态查询仍受限流', async () => {
    process.env.SCRAPER_RATE_LIMIT_PER_MINUTE = '12';
    const started = await request(app).post('/api/firecrawl/crawl').send({ url: 'https://example.com' });
    expect(started.status).toBe(200);
    const a = await request(app).get('/api/firecrawl/crawl/job-1');
    const b = await request(app).get('/api/firecrawl/crawl/job-1');
    const c = await request(app).get('/api/firecrawl/crawl/job-1');
    expect([a.status, b.status, c.status]).toEqual([200, 200, 429]);
  });
});
