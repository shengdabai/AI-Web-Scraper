import { describe, it, expect } from 'vitest';
import { urlSchema, scrapeSchema, extractTextSchema, crawlSchema, searchSchema, mapSchema, batchExtractSchema } from '../api/validations/firecrawl.js';

describe('Firecrawl Validation Schemas', () => {
  describe('urlSchema', () => {
    it('should accept valid URLs', () => {
      const result = urlSchema.safeParse('https://example.com');
      expect(result.success).toBe(true);
    });

    it('should reject invalid URLs', () => {
      const result = urlSchema.safeParse('not-a-url');
      expect(result.success).toBe(false);
    });
  });

  describe('scrapeSchema', () => {
    it('should accept valid scrape request', () => {
      const result = scrapeSchema.safeParse({ url: 'https://example.com' });
      expect(result.success).toBe(true);
    });

    it('should accept scrape request with options', () => {
      const result = scrapeSchema.safeParse({
        url: 'https://example.com',
        options: {
          formats: ['markdown', 'html'],
          onlyMainContent: true,
        },
      });
      expect(result.success).toBe(true);
    });

    it('should reject missing URL', () => {
      const result = scrapeSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe('extractTextSchema', () => {
    it('should accept valid extract request', () => {
      const result = extractTextSchema.safeParse({ url: 'https://example.com' });
      expect(result.success).toBe(true);
    });

    it('should default cleanText to true', () => {
      const result = extractTextSchema.safeParse({ url: 'https://example.com' });
      if (result.success) {
        expect(result.data.cleanText).toBe(true);
      }
    });

    it('should accept explicit cleanText false', () => {
      const result = extractTextSchema.safeParse({ url: 'https://example.com', cleanText: false });
      expect(result.success).toBe(true);
    });
  });

  describe('crawlSchema', () => {
    it('should accept valid crawl request', () => {
      const result = crawlSchema.safeParse({ url: 'https://example.com' });
      expect(result.success).toBe(true);
    });

    it('should accept crawl with options', () => {
      const result = crawlSchema.safeParse({
        url: 'https://example.com',
        options: { limit: 10, maxDepth: 3 },
      });
      expect(result.success).toBe(true);
    });
  });

  describe('searchSchema', () => {
    it('should accept valid search request', () => {
      const result = searchSchema.safeParse({ query: 'test query' });
      expect(result.success).toBe(true);
    });

    it('should reject empty query', () => {
      const result = searchSchema.safeParse({ query: '' });
      expect(result.success).toBe(false);
    });
  });

  describe('mapSchema', () => {
    it('should accept valid map request', () => {
      const result = mapSchema.safeParse({ url: 'https://example.com' });
      expect(result.success).toBe(true);
    });
  });

  describe('batchExtractSchema', () => {
    it('should accept valid batch request', () => {
      const result = batchExtractSchema.safeParse({
        urls: ['https://example.com', 'https://example2.com'],
      });
      expect(result.success).toBe(true);
    });

    it('should reject empty URLs array', () => {
      const result = batchExtractSchema.safeParse({ urls: [] });
      expect(result.success).toBe(false);
    });

    it('should reject more than 50 URLs', () => {
      const urls = Array(51).fill('https://example.com');
      const result = batchExtractSchema.safeParse({ urls });
      expect(result.success).toBe(false);
    });
  });
});
