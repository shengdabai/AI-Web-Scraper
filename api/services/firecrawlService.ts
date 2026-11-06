import { Firecrawl } from '@mendable/firecrawl-js';
import type { CrawlOptions, FormatOption, ScrapeOptions } from '@mendable/firecrawl-js';
import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

/**
 * Firecrawl 服务类
 * 提供网页抓取、爬取和内容提取功能
 */
export class FirecrawlUnconfiguredError extends Error {
  readonly code = 'FIRECRAWL_UNCONFIGURED';
  constructor() {
    super('FIRECRAWL_API_KEY environment variable is required');
  }
}

type ScrapeInput = {
  formats?: string[];
  onlyMainContent?: boolean;
  includeTags?: string[];
  excludeTags?: string[];
  headers?: Record<string, string>;
  waitFor?: number;
  timeout?: number;
};

function toScrapeOptions(options?: ScrapeInput): ScrapeOptions | undefined {
  if (!options) return undefined;
  const { formats, ...rest } = options;
  return { ...rest, ...(formats ? { formats: formats as FormatOption[] } : {}) };
}

export class FirecrawlService {
  private client: Firecrawl | null = null;
  private clientKey: string | null = null;

  /**
   * 延迟创建客户端：缺少 key 时服务仍能启动并回答健康检查，
   * 计费路由则明确返回“未配置”，不伪造成功。
   */
  private get app(): Firecrawl {
    const apiKey = process.env.FIRECRAWL_API_KEY?.trim();
    if (!apiKey) {
      throw new FirecrawlUnconfiguredError();
    }
    if (!this.client || this.clientKey !== apiKey) {
      this.client = new Firecrawl({ apiKey });
      this.clientKey = apiKey;
    }
    return this.client;
  }

  /**
   * 抓取单个网页内容
   * @param url - 要抓取的网页URL
   * @param options - 抓取选项
   * @returns 抓取结果
   */
  async scrapeUrl(
    url: string, 
    options?: ScrapeInput
  ): Promise<{
    success: boolean;
    data?: {
      markdown?: string;
      html?: string;
      rawHtml?: string;
      screenshot?: string;
      links?: string[];
      metadata?: {
        title?: string;
        description?: string;
        language?: string;
        keywords?: string | string[];
        robots?: string;
        ogTitle?: string;
        ogDescription?: string;
        ogImage?: string;
        ogUrl?: string;
        sourceURL?: string;
        statusCode?: number;
      };
    };
    error?: string;
  }> {
    const app = this.app;
    try {
      const result = await app.scrape(url, toScrapeOptions(options));
      
      // Firecrawl API 直接返回数据，不是包装在 data 字段中
      if (result) {
        return {
          success: true,
          data: result
        };
      } else {
        return {
          success: false,
          error: 'No data returned from Firecrawl API'
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * 提取网页上的所有文字内容
   * @param url - 要提取文字的网页URL
   * @param cleanText - 是否清理文本（移除多余空格、换行等）
   * @returns 提取的纯文本内容
   */
  async extractText(url: string, cleanText: boolean = true): Promise<{
    success: boolean;
    text: string;
    wordCount: number;
    metadata: any;
  }> {
    try {
      const result = await this.scrapeUrl(url, {
        formats: ['markdown'],
        onlyMainContent: true,
        excludeTags: ['script', 'style', 'nav', 'footer', 'header']
      });

      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to scrape URL');
      }

      let text = result.data.markdown || '';
      
      if (cleanText) {
        // Remove markdown formatting
        text = text
          .replace(/#{1,6}\s+/g, '') // Remove headers
          .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
          .replace(/\*(.*?)\*/g, '$1') // Remove italic
          .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Remove links, keep text
          .replace(/```[\s\S]*?```/g, '') // Remove code blocks
          .replace(/`(.*?)`/g, '$1') // Remove inline code
          .replace(/\n{3,}/g, '\n\n') // Reduce multiple newlines
          .replace(/\s{2,}/g, ' ') // Reduce multiple spaces
          .trim();
      }

      const wordCount = text.split(/\s+/).filter((word: string) => word.length > 0).length;

      return {
        success: true,
        text,
        wordCount,
        metadata: result.data?.metadata || {}
      };
    } catch (error) {
      console.error('Error extracting text:', error);
      throw error;
    }
  }

  /**
   * 爬取整个网站
   * @param url - 网站根URL
   * @param options - 爬取选项
   * @returns 爬取任务信息
   */
  async crawlWebsite(
    url: string, 
    options?: {
      limit?: number;
      maxDepth?: number;
      allowedDomains?: string[];
      excludePaths?: string[];
      includePaths?: string[];
      formats?: string[];
      onlyMainContent?: boolean;
      timeout?: number;
    }
  ): Promise<{
    success: boolean;
    jobId?: string;
    data?: any[];
    message?: string;
    error?: string;
  }> {
    const app = this.app;
    try {
      // v2 SDK 的字段名与本服务对外合同不同，未映射的字段会被上游拒绝或忽略。
      const scrapeOptions = toScrapeOptions({
        ...(options?.formats ? { formats: options.formats } : {}),
        ...(options?.onlyMainContent !== undefined ? { onlyMainContent: options.onlyMainContent } : {}),
        ...(options?.timeout !== undefined ? { timeout: options.timeout } : {}),
      });
      const request: CrawlOptions = {
        ...(options?.limit !== undefined ? { limit: options.limit } : {}),
        ...(options?.maxDepth !== undefined ? { maxDiscoveryDepth: options.maxDepth } : {}),
        ...(options?.excludePaths ? { excludePaths: options.excludePaths } : {}),
        ...(options?.includePaths ? { includePaths: options.includePaths } : {}),
        ...(scrapeOptions && Object.keys(scrapeOptions).length > 0 ? { scrapeOptions } : {}),
      };
      const crawlResult = await app.startCrawl(url, request);
      
      return {
        success: true,
        jobId: crawlResult.id,
        message: 'Crawl started successfully'
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * 检查爬取任务状态
   * @param jobId - 爬取任务ID
   * @returns 任务状态和结果
   */
  async getCrawlStatus(jobId: string): Promise<{
    success: boolean;
    status?: string;
    completed?: number;
    total?: number;
    creditsUsed?: number;
    expiresAt?: string;
    data?: Array<{
      markdown?: string;
      html?: string;
      rawHtml?: string;
      metadata?: any;
      screenshot?: string;
    }>;
    error?: string;
  }> {
    const app = this.app;
    try {
      const status = await app.getCrawlStatus(jobId);
      
      return {
        success: true,
        ...status
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * 搜索网站相关内容
   * @param query - 搜索查询
   * @param options - 搜索选项
   * @returns 搜索结果
   */
  async searchWebsite(query: string, options?: {
    limit?: number;
  }): Promise<{
    success: boolean;
    data?: any[];
    error?: string;
  }> {
    const app = this.app;
    try {
      const searchResult = await app.search(query, options);
      
      // v4 SDK 返回 { web, news, images }，没有 data 字段；旧写法永远得到空数组。
      return {
        success: true,
        data: searchResult.web ?? []
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * 获取网站地图（使用爬取功能模拟）
   * @param url - 网站URL
   * @returns 网站地图信息
   */
  async mapWebsite(url: string): Promise<{
    success: boolean;
    urls: string[];
    totalUrls: number;
    error?: string;
  }> {
    const app = this.app;
    try {
      // 使用 map 接口：旧实现会启动 100 页 crawl、只等 2 秒就读取状态，
      // 既消耗大量额度，又几乎总是返回“成功但 0 个 URL”。
      const mapped = await app.map(url);
      const urls = (mapped.links ?? []).map((item) => item.url).filter(Boolean);
      
      return {
        success: true,
        urls,
        totalUrls: urls.length
      };
    } catch (error) {
      return {
        success: false,
        urls: [],
        totalUrls: 0,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * 批量提取多个URL的文字内容
   * @param urls - URL数组
   * @param options - 提取选项
   * @returns 批量提取结果
   */
  async batchExtractText(
    urls: string[], 
    options?: {
      formats?: string[];
      onlyMainContent?: boolean;
    }
  ): Promise<{
    success: boolean;
    results?: Array<{
      url?: string;
      markdown?: string;
      html?: string;
      metadata?: any;
    }>;
    error?: string;
  }> {
    const app = this.app;
    try {
      const scrapeOptions = toScrapeOptions(options);
      const batchResult = await app.batchScrape(urls, scrapeOptions ? { options: scrapeOptions } : {});

      if (batchResult.status !== 'completed') {
        return {
          success: false,
          results: batchResult.data,
          error: `Batch scrape ended with status: ${batchResult.status}`
        };
      }

      return {
        success: true,
        results: batchResult.data
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }
}

// 导出单例实例
export const firecrawlService = new FirecrawlService();