// NotebookLM 笔记下载器 - 弹窗脚本

(function() {
  'use strict';

  // 配置
  const CONFIG = {
    API_BASE_URL: 'http://localhost:3000/api/firecrawl'
  };

  // DOM 元素
  const elements = {
    currentPage: document.getElementById('current-page'),
    pageIndicator: document.getElementById('page-indicator'),
    apiStatus: document.getElementById('api-status'),
    apiIndicator: document.getElementById('api-indicator'),
    downloadBtn: document.getElementById('download-btn'),
    settingsBtn: document.getElementById('settings-btn')
  };

  // 状态管理
  let currentTab = null;
  let isNotebookLMPage = false;
  let isApiAvailable = false;

  // 初始化
  async function init() {
    try {
      // 获取当前标签页
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      currentTab = tabs[0];
      
      // 检查页面状态
      await checkPageStatus();
      
      // 检查 API 状态
      await checkApiStatus();
      
      // 更新 UI
      updateUI();
      
      // 绑定事件
      bindEvents();
      
    } catch (error) {
      console.error('初始化失败:', error);
      showError('初始化失败');
    }
  }

  // 检查页面状态
  async function checkPageStatus() {
    if (!currentTab) return;
    
    const url = currentTab.url;
    isNotebookLMPage = url.includes('notebooklm.google') || 
                      url.includes('notebooklm.googleusercontent');
    
    if (isNotebookLMPage) {
      elements.currentPage.textContent = 'NotebookLM';
      elements.pageIndicator.className = 'status-indicator active';
    } else {
      elements.currentPage.textContent = '非 NotebookLM 页面';
      elements.pageIndicator.className = 'status-indicator inactive';
    }
  }

  // 检查 API 状态
  async function checkApiStatus() {
    try {
      // 只探测不计费的健康检查接口；旧实现每次打开弹窗都会真实抓取一次第三方页面并消耗额度。
      const response = await fetch(`${CONFIG.API_BASE_URL}/health`);
      
      isApiAvailable = false;
      if (response.ok) {
        const data = await response.json();
        isApiAvailable = data.success === true;
      }
    } catch (error) {
      console.error('API 检查失败:', error);
      isApiAvailable = false;
    }
    
    if (isApiAvailable) {
      elements.apiStatus.textContent = '正常';
      elements.apiIndicator.className = 'status-indicator active';
    } else {
      elements.apiStatus.textContent = '不可用';
      elements.apiIndicator.className = 'status-indicator inactive';
    }
  }

  // 更新 UI
  function updateUI() {
    const canDownload = isNotebookLMPage && isApiAvailable;
    elements.downloadBtn.disabled = !canDownload;
    
    if (!canDownload) {
      if (!isNotebookLMPage) {
        elements.downloadBtn.textContent = '请访问 NotebookLM 页面';
      } else if (!isApiAvailable) {
        elements.downloadBtn.textContent = 'API 服务不可用';
      }
    } else {
      elements.downloadBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7,10 12,15 17,10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
        下载当前页面
      `;
    }
  }

  // 绑定事件
  function bindEvents() {
    elements.downloadBtn.addEventListener('click', handleDownload);
    elements.settingsBtn.addEventListener('click', handleSettings);
  }

  // 处理下载
  async function handleDownload() {
    if (!currentTab || !isNotebookLMPage || !isApiAvailable) {
      return;
    }

    try {
      // 更新按钮状态
      elements.downloadBtn.disabled = true;
      elements.downloadBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M12 6v6l4 2"></path>
        </svg>
        下载中...
      `;

      // 调用 API 提取内容
      const response = await fetch(`${CONFIG.API_BASE_URL}/extract-text`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url: currentTab.url,
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
      const title = metadata.title || currentTab.title || 'NotebookLM笔记';
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      
      // 创建文件内容
      const fileContent = createFileContent(content, metadata, currentTab.url);
      
      // 使用 Chrome Downloads API 下载文件
      const blob = new Blob([fileContent], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      
      await chrome.downloads.download({
        url: url,
        filename: `${sanitizeFilename(title)}_${timestamp}.md`,
        saveAs: true
      });
      
      // 显示成功消息
      showSuccess('笔记下载成功！');
      
      // 关闭弹窗
      setTimeout(() => {
        window.close();
      }, 1500);
      
    } catch (error) {
      console.error('下载失败:', error);
      showError(`下载失败: ${error.message}`);
    } finally {
      // 恢复按钮状态
      updateUI();
    }
  }

  // 处理设置
  function handleSettings() {
    // 打开设置页面或显示设置选项
    chrome.tabs.create({
      url: 'chrome://extensions/?id=' + chrome.runtime.id
    });
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

  // 清理文件名
  function sanitizeFilename(filename) {
    return filename
      .replace(/[<>:"/\\|?*]/g, '_')
      .replace(/\s+/g, '_')
      .substring(0, 100); // 限制长度
  }

  // 显示成功消息
  function showSuccess(message) {
    const statusDiv = document.querySelector('.status');
    statusDiv.style.background = '#d4edda';
    statusDiv.style.color = '#155724';
    // message 可能包含服务端/上游返回的文本，只能按纯文本渲染。
    const messageDiv = document.createElement('div');
    messageDiv.style.textAlign = 'center';
    messageDiv.style.padding = '8px';
    messageDiv.textContent = message;
    statusDiv.replaceChildren(messageDiv);
  }

  // 显示错误消息
  function showError(message) {
    const statusDiv = document.querySelector('.status');
    statusDiv.style.background = '#f8d7da';
    statusDiv.style.color = '#721c24';
    // message 可能包含服务端/上游返回的文本，只能按纯文本渲染。
    const messageDiv = document.createElement('div');
    messageDiv.style.textAlign = 'center';
    messageDiv.style.padding = '8px';
    messageDiv.textContent = message;
    statusDiv.replaceChildren(messageDiv);
  }

  // 页面加载完成后初始化
  document.addEventListener('DOMContentLoaded', init);

})();