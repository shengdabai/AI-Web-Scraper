import { createServer } from 'node:http';
import { once } from 'node:events';
import { Firecrawl } from '@mendable/firecrawl-js';
import { z } from 'zod/v3';
import { expect, it } from 'vitest';

it('keeps real SDK requests and legacy schema conversion working with the Zod override', async () => {
  const payloads: Record<string, any>[] = [];
  const server = createServer(async (req, res) => {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    if (raw) payloads.push(JSON.parse(raw));
    res.setHeader('Content-Type', 'application/json');
    const responses: Record<string, unknown> = {
      '/v2/scrape': { success: true, data: { markdown: 'hello' } },
      '/v2/search': { success: true, data: { web: [{ url: 'https://example.com' }] } },
      '/v2/map': { success: true, links: ['https://example.com'] },
      '/v2/crawl': { success: true, id: 'crawl-test' },
      '/v2/crawl/crawl-test': { success: true, status: 'completed', data: [] },
      '/v2/batch/scrape': { success: true, id: 'batch-test' },
      '/v2/batch/scrape/batch-test': { success: true, status: 'completed', data: [{ markdown: 'hello' }] },
    };
    const body = responses[req.url ?? ''];
    res.statusCode = body ? 200 : 404;
    res.end(JSON.stringify(body ?? { success: false }));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Missing test server address');
    const sdk = new Firecrawl({
      apiKey: 'fc-synthetic-compatibility-test',
      apiUrl: `http://127.0.0.1:${address.port}`,
      maxRetries: 1,
    });
    expect(await sdk.scrape('https://example.com', { formats: ['markdown'] })).toEqual({ markdown: 'hello' });
    expect((await sdk.search('hello')).web).toEqual([{ url: 'https://example.com' }]);
    expect((await sdk.map('https://example.com')).links).toEqual([{ url: 'https://example.com' }]);
    expect((await sdk.startCrawl('https://example.com', { limit: 1 })).id).toBe('crawl-test');
    expect((await sdk.getCrawlStatus('crawl-test')).status).toBe('completed');
    expect((await sdk.batchScrape(['https://example.com'])).data).toEqual([{ markdown: 'hello' }]);
    await sdk.scrape('https://example.com', {
      formats: [{ type: 'json', schema: z.object({ title: z.string() }) }],
    });
    expect(payloads.at(-1)?.formats[0].schema.properties.title).toEqual({ type: 'string' });
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
