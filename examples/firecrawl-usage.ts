/**
 * Firecrawl 使用示例
 * 展示如何使用 Firecrawl 服务提取网页上的所有文字内容
 */

import { firecrawlService } from '../api/services/firecrawlService.js';

// 示例 1: 提取单个网页的文字内容
async function extractSinglePageText() {
  console.log('\n=== 示例 1: 提取单个网页文字 ===');
  
  try {
    const url = 'https://example.com';
    console.log(`正在提取网页文字: ${url}`);
    
    const result = await firecrawlService.extractText(url, true);
    
    console.log('✅ 提取成功!');
    console.log(`📄 网页标题: ${result.metadata.title || '未知'}`);
    console.log(`📊 字数统计: ${result.wordCount} 个词`);
    console.log(`📝 文字内容预览 (前200字符):`);
    console.log(result.text.substring(0, 200) + '...');
    
    return result;
  } catch (error) {
    console.error('❌ 提取失败:', error instanceof Error ? error.message : error);
    throw error;
  }
}

// 示例 2: 抓取网页的完整内容（包含HTML和Markdown）
async function scrapeFullPageContent() {
  console.log('\n=== 示例 2: 抓取完整网页内容 ===');
  
  try {
    const url = 'https://docs.firecrawl.dev';
    console.log(`正在抓取网页: ${url}`);
    
    const result = await firecrawlService.scrapeUrl(url, {
      formats: ['markdown', 'html'],
      onlyMainContent: true,
      excludeTags: ['script', 'style', 'nav', 'footer']
    });
    
    if (!result.success || !result.data) {
      throw new Error(result.error || '抓取失败');
    }

    console.log('✅ 抓取成功!');
    console.log(`📄 网页标题: ${result.data.metadata?.title || '未知'}`);
    console.log(`📝 Markdown 内容长度: ${result.data.markdown?.length || 0} 字符`);
    console.log(`🏷️  HTML 内容长度: ${result.data.html?.length || 0} 字符`);
    
    // 显示部分内容预览
    if (result.data && result.data.markdown) {
      console.log('\n📋 内容预览:');
      const preview = result.data.markdown.substring(0, 200);
      console.log(preview + (result.data.markdown.length > 200 ? '...' : ''));
    }
    
    return result;
  } catch (error) {
    console.error('❌ 抓取失败:', error instanceof Error ? error.message : error);
    throw error;
  }
}

// 示例 3: 获取网站地图
async function getWebsiteMap() {
  console.log('\n=== 示例 3: 获取网站地图 ===');
  
  try {
    const url = 'https://docs.firecrawl.dev';
    console.log(`正在获取网站地图: ${url}`);
    
    const result = await firecrawlService.mapWebsite(url);
    
    console.log('✅ 获取成功!');
    console.log(`🗺️  发现 ${result.totalUrls} 个页面`);
    console.log('📋 前10个URL:');
    result.urls.slice(0, 10).forEach((url, index) => {
      console.log(`   ${index + 1}. ${url}`);
    });
    
    return result;
  } catch (error) {
    console.error('❌ 获取网站地图失败:', error instanceof Error ? error.message : error);
    throw error;
  }
}

// 示例 4: 批量提取多个URL的文字
async function batchExtractText() {
  console.log('\n=== 示例 4: 批量提取文字 ===');
  
  try {
    const urls = [
      'https://example.com',
      'https://example.com/about',
      'https://example.com/contact'
    ];
    
    console.log(`正在批量提取 ${urls.length} 个网页的文字...`);
    
    const result = await firecrawlService.batchExtractText(urls, {
      formats: ['markdown'],
      onlyMainContent: true
    });
    
    if (result.success && result.results) {
      console.log(`✅ 批量提取完成，共处理 ${result.results.length} 个URL`);
      
      result.results.forEach((item, index) => {
        if (item.url) {
          const wordCount = item.markdown ? item.markdown.split(' ').length : 0;
          console.log(`   ${index + 1}. ✅ ${item.url} - ${wordCount} 个词`);
        }
      });
    } else {
      console.log('❌ 批量提取失败:', result.error);
    }
    
    return result;
  } catch (error) {
    console.error('❌ 批量提取失败:', error instanceof Error ? error.message : error);
    throw error;
  }
}

// 示例 5: 爬取整个网站
async function crawlEntireWebsite() {
  console.log('\n=== 示例 5: 爬取整个网站 ===');
  
  try {
    const url = 'https://docs.firecrawl.dev';
    console.log(`正在启动网站爬取: ${url}`);
    
    // 启动爬取任务
    const crawlResult = await firecrawlService.crawlWebsite(url, {
      limit: 5, // 限制爬取5个页面
      maxDepth: 2,
      formats: ['markdown']
    });
    
    console.log('✅ 爬取任务已启动!');
    console.log(`🆔 任务ID: ${crawlResult.jobId}`);
    console.log('⏳ 正在等待爬取完成...');
    
    // 检查爬取状态
     let finalStatus = null;
     if (crawlResult.jobId) {
       let status;
       let attempts = 0;
       const maxAttempts = 10;
       
       do {
         await new Promise(resolve => setTimeout(resolve, 3000)); // 等待3秒
         status = await firecrawlService.getCrawlStatus(crawlResult.jobId);
         attempts++;
         
         console.log(`📊 状态检查 ${attempts}/${maxAttempts}: ${status.status || 'unknown'}`);
         if (status.completed && status.total) {
           console.log(`   已完成: ${status.completed}/${status.total}`);
         }
         
         if (status.status === 'completed' && status.data) {
           console.log('✅ 爬取完成!');
           console.log(`📄 共获取 ${status.data.length} 个页面`);
           
           // 显示前3个页面的信息
           console.log('\n📋 页面预览:');
           status.data.slice(0, 3).forEach((page: any, index: number) => {
             console.log(`   ${index + 1}. ${page.metadata?.title || '无标题'}`);
             console.log(`      URL: ${page.metadata?.sourceURL}`);
             console.log(`      内容长度: ${page.markdown?.length || 0} 字符`);
           });
           break;
         } else if (status.status === 'failed') {
           console.log('❌ 爬取失败:', status.error);
           break;
         }
       } while (attempts < maxAttempts);
       
       finalStatus = status;
     }
     
     return finalStatus;
  } catch (error) {
    console.error('❌ 网站爬取失败:', error instanceof Error ? error.message : error);
    throw error;
  }
}

// 主函数 - 运行所有示例
async function runAllExamples() {
  console.log('🚀 开始运行 Firecrawl 使用示例...');
  console.log('⚠️  注意: 请确保已设置 FIRECRAWL_API_KEY 环境变量');
  
  try {
    // 运行各个示例
    await extractSinglePageText();
    await scrapeFullPageContent();
    await getWebsiteMap();
    await batchExtractText();
    // await crawlEntireWebsite(); // 注释掉，因为需要较长时间
    
    console.log('\n🎉 所有示例运行完成!');
  } catch (error) {
    console.error('\n💥 示例运行失败:', error);
    process.exit(1);
  }
}

// 如果直接运行此文件，则执行示例
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllExamples();
}

// 导出示例函数供其他模块使用
export {
  extractSinglePageText,
  scrapeFullPageContent,
  getWebsiteMap,
  batchExtractText,
  crawlEntireWebsite,
  runAllExamples
};