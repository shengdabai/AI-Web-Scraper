// NotebookLM 笔记下载器 - 内容脚本

(function() {
  'use strict';

  // 配置
  const CONFIG = {
    API_BASE_URL: 'http://localhost:3000/api/firecrawl',
    BUTTON_ID: 'notebooklm-downloader-btn',
    CONTAINER_ID: 'notebooklm-downloader-container'
  };

  // 检查是否为 NotebookLM 页面
  function isNotebookLMPage() {
    return window.location.hostname.includes('notebooklm.google') ||
           window.location.hostname.includes('notebooklm.googleusercontent');
  }

  // 检查页面是否已加载笔记内容
  function hasNotebookContent() {
    // 检查常见的 NotebookLM 内容元素
    const contentSelectors = [
      '[data-testid="notebook-content"]',
      '.notebook-content',
      '[role="main"]',
      '.main-content',
      'article',
      '.content'
    ];
    
    return contentSelectors.some(selector => {
      const element = document.querySelector(selector);
      return element && element.textContent.trim().length > 100;
    });
  }

  // 创建下载按钮
  function createDownloadButton() {
    if (document.getElementById(CONFIG.BUTTON_ID)) {
      return; // 按钮已存在
    }

    // 创建容器
    const container = document.createElement('div');
    container.id = CONFIG.CONTAINER_ID;
    container.className = 'notebooklm-downloader-container';

    // 创建按钮
    const button = document.createElement('button');
    button.id = CONFIG.BUTTON_ID;
    button.className = 'notebooklm-downloader-btn';
    button.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
        <polyline points="7,10 12,15 17,10"></polyline>
        <line x1="12" y1="15" x2="12" y2="3"></line>
      </svg>
      下载笔记
    `;
    button.title = '一键下载当前页面的笔记内容';

    // 添加点击事件
    button.addEventListener('click', handleDownload);

    container.appendChild(button);
    document.body.appendChild(container);

    console.log('NotebookLM 下载按钮已添加');
  }

  // 处理下载
  async function handleDownload() {
    const button = document.getElementById(CONFIG.BUTTON_ID);
    if (!button) return;

    try {
      // 更新按钮状态
      button.disabled = true;
      button.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M12 6v6l4 2"></path>
        </svg>
        下载中...
      `;

      // 获取当前页面 URL
      const currentUrl = window.location.href;
      
      // 调用 API 提取内容
      const response = await fetch(`${CONFIG.API_BASE_URL}/extract-text`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url: currentUrl,
          cleanText: true
        })
      });

      if (!response.ok) {
        throw new Error(`API 请求失败: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || '提取内容失败');
      }

      // 准备下载内容
      const content = data.text || '';
      const metadata = data.metadata || {};
      const title = metadata.title || 'NotebookLM笔记';
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      
      // 创建文件内容
      const fileContent = createFileContent(content, metadata, currentUrl);
      
      // 下载文件
      await downloadFile(fileContent, `${title}_${timestamp}.md`);
      
      // 显示成功消息
      showMessage('笔记下载成功！', 'success');
      
    } catch (error) {
      console.error('下载失败:', error);
      showMessage(`下载失败: ${error.message}`, 'error');
    } finally {
      // 恢复按钮状态
      button.disabled = false;
      button.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7,10 12,15 17,10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
        下载笔记
      `;
    }
  }

  // 创建文件内容
  function createFileContent(content, metadata, url) {
    const timestamp = new Date().toLocaleString('zh-CN');
    
    let fileContent = `# ${metadata.title || 'NotebookLM 笔记'}\n\n`;
    fileContent += `**下载时间:** ${timestamp}\n`;
    fileContent += `**原始链接:** ${url}\n`;
    
    if (metadata.description) {
      fileContent += `**描述:** ${metadata.description}\n`;
    }
    
    fileContent += `**字数统计:** ${metadata.wordCount || 'N/A'}\n\n`;
    fileContent += `---\n\n`;
    fileContent += content;
    
    return fileContent;
  }

  // 下载文件
  function downloadFile(content, filename) {
    return new Promise((resolve) => {
      const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.style.display = 'none';
      
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      URL.revokeObjectURL(url);
      resolve();
    });
  }

  // 显示消息
  function showMessage(message, type = 'info') {
    // 移除现有消息
    const existingMessage = document.querySelector('.notebooklm-message');
    if (existingMessage) {
      existingMessage.remove();
    }

    // 创建消息元素
    const messageEl = document.createElement('div');
    messageEl.className = `notebooklm-message notebooklm-message-${type}`;
    messageEl.textContent = message;
    
    document.body.appendChild(messageEl);
    
    // 3秒后自动移除
    setTimeout(() => {
      if (messageEl.parentNode) {
        messageEl.remove();
      }
    }, 3000);
  }

  // 初始化
  function init() {
    if (!isNotebookLMPage()) {
      console.log('当前页面不是 NotebookLM 页面');
      return;
    }

    console.log('NotebookLM 下载器已加载');
    
    // 立即尝试创建按钮
    createDownloadButton();
    
    // 监听页面变化（SPA 应用）
    const observer = new MutationObserver((mutations) => {
      let shouldCreateButton = false;
      
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          shouldCreateButton = true;
        }
      });
      
      if (shouldCreateButton && !document.getElementById(CONFIG.BUTTON_ID)) {
        setTimeout(createDownloadButton, 1000); // 延迟创建，等待页面稳定
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // 页面加载完成后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();