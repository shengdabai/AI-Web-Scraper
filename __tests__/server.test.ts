import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import dotenv from 'dotenv';

// Mock the Firecrawl SDK before importing app, so tests never reach the real paid API.
// (The previous mock targeted a non-existent module path and exported names the app
// never imports, so these tests silently called the real Firecrawl service.)
vi.mock('@mendable/firecrawl-js', () => ({
  Firecrawl: class {
    scrape = vi.fn().mockResolvedValue({ markdown: '# Hello', metadata: { title: 'Test' } });
  },
}));

process.env.FIRECRAWL_API_KEY = 'fc-synthetic-test-key';

// Import app after mocking
import app from '../api/server.js';

describe('API Server Integration', () => {
  it('uses a mocked environment loader so local credential files are never read', () => {
    expect(vi.isMockFunction(dotenv.config)).toBe(true);
    expect(dotenv.config()).toEqual({ parsed: {} });
  });
  describe('GET /health', () => {
    it('returns status ok with timestamp', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.service).toBe('AI Web Scraper');
      expect(res.body.timestamp).toBeDefined();
    });
  });

  describe('GET /', () => {
    it('returns service info with version and endpoints', async () => {
      const res = await request(app).get('/');
      expect(res.status).toBe(200);
      expect(res.body.message).toBeDefined();
      expect(res.body.version).toBe('1.0.0');
      expect(res.body.endpoints.health).toBe('/health');
      expect(res.body.endpoints.firecrawl).toBe('/api/firecrawl');
    });
  });

  describe('404 handler', () => {
    it('returns 404 for unknown routes', async () => {
      const res = await request(app).get('/nonexistent');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Route not found');
    });
  });

  describe('POST /api/firecrawl/scrape (mocked)', () => {
    it('accepts URL and returns scraped data', async () => {
      const res = await request(app)
        .post('/api/firecrawl/scrape')
        .send({ url: 'https://example.com' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('POST /api/firecrawl/extract (mocked)', () => {
    it('accepts URL and returns extracted text', async () => {
      const res = await request(app)
        .post('/api/firecrawl/extract-text')
        .send({ url: 'https://example.com' });
      expect(res.status).toBe(200);
      expect(res.body.text).toBeDefined();
    });
  });

  describe('POST /api/firecrawl/scrape (validation)', () => {
    it('rejects request without URL', async () => {
      const res = await request(app)
        .post('/api/firecrawl/scrape')
        .send({});
      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });
});
