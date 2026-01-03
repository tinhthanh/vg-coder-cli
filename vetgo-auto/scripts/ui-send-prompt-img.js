(async () => {
  // 1. Kiểm tra panel đã tồn tại chưa
  if (document.getElementById('ai-chat-test-panel')) {
    console.warn('Chat test panel already exists');
    return;
  }

  /*********************************
   * LIBRARY LOADER
   *********************************/
  const loadScript = (src) => {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  };

  try {
    await Promise.all([
      loadScript('https://cdn.jsdelivr.net/npm/markdown-it@14.1.0/dist/markdown-it.min.js'),
      loadScript('https://cdn.jsdelivr.net/npm/mermaid@11.12.2/dist/mermaid.min.js')
    ]);
  } catch (e) {
    console.error('❌ Failed to load libraries', e);
    return;
  }

  // Init libs
  const md = window.markdownit({ html: false, breaks: true, linkify: true });
  window.mermaid.initialize({ startOnLoad: false, theme: 'dark', securityLevel: 'loose' });

  /*********************************
   * CHAT HISTORY MANAGER (Inline)
   *********************************/
  const ChatHistoryManager = (() => {
    const STORAGE_PREFIX = 'vg-chat-';
    const METADATA_KEY = 'vg-chat-metadata';
    const MAX_CHAT_AGE_DAYS = 30;
    const MAX_TITLE_LENGTH = 50;

    function generateChatId() {
      const timestamp = Date.now().toString(36);
      const random = Math.random().toString(36).substring(2, 15) + 
                     Math.random().toString(36).substring(2, 15);
      return `${timestamp}${random}`;
    }

    function generateTitle(messages) {
      if (!messages || messages.length === 0) return 'New Chat';
      const firstUserMsg = messages.find(m => m.role === 'user');
      if (!firstUserMsg) return 'New Chat';
      let title = firstUserMsg.content.trim();
      if (title.length > MAX_TITLE_LENGTH) {
        title = title.substring(0, MAX_TITLE_LENGTH) + '...';
      }
      return title;
    }

    function getMetadata() {
      try {
        const data = localStorage.getItem(METADATA_KEY);
        return data ? JSON.parse(data) : { allChatIds: [], lastAccessedChatId: null };
      } catch (error) {
        console.error('[ChatHistory] Failed to get metadata:', error);
        return { allChatIds: [], lastAccessedChatId: null };
      }
    }

    function updateMetadata(updates) {
      const metadata = getMetadata();
      Object.assign(metadata, updates);
      try {
        localStorage.setItem(METADATA_KEY, JSON.stringify(metadata));
      } catch (error) {
        console.error('[ChatHistory] Failed to update metadata:', error);
        handleStorageError(error);
      }
    }

    function handleStorageError(error) {
      if (error.name === 'QuotaExceededError') {
        console.warn('[ChatHistory] Storage quota exceeded, cleaning up old chats...');
        const deletedCount = cleanupOldChats(7);
        if (deletedCount > 0) {
          console.log(`[ChatHistory] Cleaned up ${deletedCount} old chats`);
        } else {
          console.error('[ChatHistory] Storage full and no old chats to cleanup!');
          alert('⚠️ Bộ nhớ đã đầy! Vui lòng xóa bớt lịch sử chat cũ.');
        }
      }
    }

    function saveChat(chatId, messages, options = {}) {
      if (!chatId) {
        console.error('[ChatHistory] Cannot save chat without ID');
        return false;
      }

      const now = Date.now();
      const key = STORAGE_PREFIX + chatId;

      let chatData;
      try {
        const existing = localStorage.getItem(key);
        chatData = existing ? JSON.parse(existing) : { id: chatId, createdAt: now };
      } catch (error) {
        console.error('[ChatHistory] Failed to load existing chat:', error);
        chatData = { id: chatId, createdAt: now };
      }

      chatData.messages = messages;
      chatData.updatedAt = now;
      chatData.title = options.title || generateTitle(messages);

      try {
        localStorage.setItem(key, JSON.stringify(chatData));
        const metadata = getMetadata();
        if (!metadata.allChatIds.includes(chatId)) {
          metadata.allChatIds.push(chatId);
        }
        metadata.lastAccessedChatId = chatId;
        updateMetadata(metadata);
        return true;
      } catch (error) {
        console.error('[ChatHistory] Failed to save chat:', error);
        handleStorageError(error);
        return false;
      }
    }

    function loadChat(chatId) {
      if (!chatId) return null;

      const key = STORAGE_PREFIX + chatId;
      try {
        const data = localStorage.getItem(key);
        if (!data) {
          console.warn(`[ChatHistory] Chat not found: ${chatId}`);
          return null;
        }

        const chatData = JSON.parse(data);
        if (!chatData.messages || !Array.isArray(chatData.messages)) {
          console.error('[ChatHistory] Invalid chat data structure');
          return null;
        }

        updateMetadata({ lastAccessedChatId: chatId });

        return {
          messages: chatData.messages,
          metadata: {
            title: chatData.title,
            createdAt: chatData.createdAt,
            updatedAt: chatData.updatedAt,
          }
        };
      } catch (error) {
        console.error('[ChatHistory] Failed to load chat:', error);
        return null;
      }
    }

    function deleteChat(chatId) {
      if (!chatId) return false;

      const key = STORAGE_PREFIX + chatId;
      try {
        localStorage.removeItem(key);
        const metadata = getMetadata();
        metadata.allChatIds = metadata.allChatIds.filter(id => id !== chatId);
        if (metadata.lastAccessedChatId === chatId) {
          metadata.lastAccessedChatId = null;
        }
        updateMetadata(metadata);
        return true;
      } catch (error) {
        console.error('[ChatHistory] Failed to delete chat:', error);
        return false;
      }
    }

    function cleanupOldChats(maxAgeDays = MAX_CHAT_AGE_DAYS) {
      const cutoffTime = Date.now() - (maxAgeDays * 24 * 60 * 60 * 1000);
      const metadata = getMetadata();
      let deletedCount = 0;

      for (const chatId of [...metadata.allChatIds]) {
        const key = STORAGE_PREFIX + chatId;
        try {
          const data = localStorage.getItem(key);
          if (data) {
            const chatData = JSON.parse(data);
            if (chatData.updatedAt < cutoffTime) {
              deleteChat(chatId);
              deletedCount++;
            }
          }
        } catch (error) {
          console.error(`[ChatHistory] Failed to check chat ${chatId}:`, error);
        }
      }

      return deletedCount;
    }

    return { generateChatId, saveChat, loadChat, deleteChat, cleanupOldChats };
  })();

  /*********************************
   * CHAT ROUTER (Inline)
   *********************************/
  const ChatRouter = (() => {
    const ROUTE_PREFIX = '/prompts/';
    const NEW_CHAT_PATH = '/prompts/new_chat';
    let routeChangeCallbacks = [];

    function getCurrentChatId() {
      const pathname = window.location.pathname;
      if (!pathname.startsWith(ROUTE_PREFIX)) return null;
      if (pathname === NEW_CHAT_PATH || pathname === NEW_CHAT_PATH + '/') return null;
      
      const parts = pathname.split('/');
      const chatId = parts[parts.length - 1];
      if (!chatId || chatId.trim() === '') return null;
      
      return chatId;
    }

    function isNewChat() {
      const pathname = window.location.pathname;
      return pathname === NEW_CHAT_PATH || pathname === NEW_CHAT_PATH + '/';
    }

    function updateURL(chatId, replace = false) {
      if (!chatId) {
        console.error('[ChatRouter] Cannot update URL without chat ID');
        return;
      }

      const newPath = `${ROUTE_PREFIX}${chatId}`;
      const title = `Chat - ${chatId}`;

      try {
        if (replace) {
          window.history.replaceState({ chatId }, title, newPath);
        } else {
          window.history.pushState({ chatId }, title, newPath);
        }
        notifyRouteChange(chatId);
      } catch (error) {
        console.error('[ChatRouter] Failed to update URL:', error);
      }
    }

    function navigateToNewChat(replace = false) {
      const title = 'New Chat';
      try {
        if (replace) {
          window.history.replaceState({}, title, NEW_CHAT_PATH);
        } else {
          window.history.pushState({}, title, NEW_CHAT_PATH);
        }
        notifyRouteChange(null);
      } catch (error) {
        console.error('[ChatRouter] Failed to navigate to new chat:', error);
      }
    }

    function onRouteChange(callback) {
      if (typeof callback !== 'function') {
        console.error('[ChatRouter] Callback must be a function');
        return () => {};
      }
      routeChangeCallbacks.push(callback);
      return () => {
        routeChangeCallbacks = routeChangeCallbacks.filter(cb => cb !== callback);
      };
    }

    function notifyRouteChange(chatId) {
      for (const callback of routeChangeCallbacks) {
        try {
          callback(chatId);
        } catch (error) {
          console.error('[ChatRouter] Error in route change callback:', error);
        }
      }
    }

    function handlePopState(event) {
      const chatId = getCurrentChatId();
      console.log('[ChatRouter] Browser navigation detected, chatId:', chatId);
      notifyRouteChange(chatId);
    }

    function getCurrentRoute() {
      return {
        chatId: getCurrentChatId(),
        isNew: isNewChat(),
        path: window.location.pathname,
      };
    }

    // Init router
    window.addEventListener('popstate', handlePopState);
    console.log('[ChatRouter] Initialized');

    return { getCurrentChatId, isNewChat, updateURL, navigateToNewChat, onRouteChange, getCurrentRoute };
  })();

  /*********************************
   * State
   *********************************/
  let messages = [];
  let selectedFiles = [];
  let isProcessing = false;
  let isMaximized = false; // Trạng thái toàn màn hình
  let currentChatId = null; // ID của chat hiện tại
  let autoSaveTimeout = null; // Debounce timer cho auto-save

  // Variables cho Dragging
  let isDragging = false;
  let dragOffsetX = 0;
  let dragOffsetY = 0;

  /*********************************
   * UI Helper Functions
   *********************************/
  function renderMessages() {
    const container = document.getElementById('chat-messages');
    if (!container) return;

    if (messages.length === 0) {
      container.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: #52525b; gap: 10px;">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path></svg>
          <span style="font-size: 13px;">Kéo thả file hoặc nhập tin nhắn</span>
        </div>
      `;
      return;
    }

    container.innerHTML = messages.map(msg => {
      const isUser = msg.role === 'user';
      const contentHtml = isUser ? escapeHtml(msg.content) : md.render(msg.content);
      return `
      <div style="display: flex; width: 100%; margin-bottom: 20px; ${isUser ? 'justify-content: flex-end;' : 'justify-content: flex-start;'}">
        ${!isUser ? `<div style="width: 24px; height: 24px; margin-right: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 2px;"><svg viewBox="0 0 24 24" style="width:18px; height:18px; color: #ededed; fill:none; stroke:currentColor; stroke-width:2;"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path></svg></div>` : ''}
        <div style="max-width: 85%; padding: 8px 14px; border-radius: ${isUser ? '12px' : '4px'}; background: ${isUser ? '#27272a' : 'transparent'}; color: #ededed; font-size: 14px; line-height: 1.6; border: ${isUser ? '1px solid #3f3f46' : 'none'}; word-break: break-word; overflow-wrap: break-word; min-width: 0;">
          <div class="markdown-body">${contentHtml}</div>
          <div style="margin-top: 6px; font-size: 10px; color: #71717a; display: flex; align-items: center; gap: 6px; justify-content: ${isUser ? 'flex-end' : 'flex-start'}">
            <span>${msg.timestamp}</span><span>${getStatusIcon(msg.status, msg.role)}</span>
          </div>
        </div>
      </div>
    `}).join('');

    processMermaidDiagrams(container);
    container.scrollTop = container.scrollHeight;
  }

  async function processMermaidDiagrams(container) {
    const mermaidCodeBlocks = container.querySelectorAll('code.language-mermaid');
    if (mermaidCodeBlocks.length === 0) return;
    const nodesToRender = [];
    mermaidCodeBlocks.forEach((codeBlock) => {
      const preElement = codeBlock.parentElement;
      if (preElement && preElement.tagName === 'PRE') {
        const div = document.createElement('div');
        div.className = 'mermaid';
        div.textContent = codeBlock.textContent;
        div.style.textAlign = 'center';
        div.style.background = '#202023';
        div.style.padding = '10px';
        div.style.borderRadius = '8px';
        preElement.replaceWith(div);
        nodesToRender.push(div);
      }
    });
    if (nodesToRender.length > 0) {
      try { await window.mermaid.run({ nodes: nodesToRender }); } catch (err) { console.error('Mermaid error:', err); }
    }
  }

  function renderFileList() {
    const listContainer = document.getElementById('chat-file-list');
    if (!listContainer) return;
    listContainer.innerHTML = selectedFiles.map((file, index) => `
      <div style="display: inline-flex; align-items: center; gap: 6px; background: #3f3f46; padding: 4px 8px; border-radius: 4px; margin-right: 6px; margin-bottom: 4px; font-size: 11px; color: #e4e4e7;">
        <span style="max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">📎 ${file.name}</span>
        <span style="color: #a1a1aa;">(${(file.size / 1024).toFixed(0)}KB)</span>
        <button onclick="window.removeChatFile(${index})" style="background: none; border: none; color: #ef4444; cursor: pointer; font-weight: bold; padding: 0 2px; font-size: 14px; line-height: 1;">×</button>
      </div>
    `).join('');
  }

  window.removeChatFile = (index) => {
    if (isProcessing) return;
    selectedFiles.splice(index, 1);
    renderFileList();
  };

  function addMessage(role, content, status = 'done') {
    messages.push({ id: Date.now(), role, content, status, timestamp: new Date().toLocaleTimeString('vi-VN') });
    renderMessages();
    autoSaveChat(); // Auto-save after adding message
  }
  function updateLastMessage(updates) {
    if (messages.length === 0) return;
    Object.assign(messages[messages.length - 1], updates);
    renderMessages();
    autoSaveChat(); // Auto-save after updating message
  }
  function getStatusIcon(status, role) {
    if (status === 'sending') return '<span style="color:#71717a">sending...</span>';
    if (status === 'processing') return '<span style="color:#fbbf24">● thinking</span>';
    if (status === 'error') return '<span style="color:#ef4444">failed</span>';
    return '';
  }
  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  function setProcessing(processing) {
    isProcessing = processing;
    const input = document.getElementById('chat-input');
    const sendBtn = document.getElementById('chat-send-btn');
    const fileBtn = document.getElementById('chat-file-btn');
    const dropZone = document.getElementById('chat-input-wrapper');
    if (input) input.disabled = processing;
    if (sendBtn) {
        sendBtn.disabled = processing;
        sendBtn.style.opacity = processing ? '0.3' : '1';
        sendBtn.innerHTML = processing ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation: spin 1s linear infinite"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg>` : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>`;
    }
    if (fileBtn) fileBtn.disabled = processing;
    if (dropZone) {
        if (processing) { dropZone.style.opacity = '0.5'; dropZone.style.pointerEvents = 'none'; }
        else { dropZone.style.opacity = '1'; dropZone.style.pointerEvents = 'auto'; }
    }
    if (input) input.placeholder = processing ? 'AI đang suy nghĩ...' : 'Nhập tin nhắn...';
  }

  async function sendMessage() {
    const input = document.getElementById('chat-input');
    const prompt = input.value.trim();
    if (!prompt && selectedFiles.length === 0) return;
    if (!window.AIChat) { alert('❌ AIChat engine chưa được inject!'); return; }
    
    // Generate chat ID sau tin nhắn đầu tiên
    const isFirstMessage = messages.length === 0;
    
    let userMsg = prompt;
    if (selectedFiles.length > 0) userMsg += `\n\n📎 Files: ${selectedFiles.map(f => f.name).join(', ')}`;
    addMessage('user', userMsg, 'sending');
    const payloadFiles = [...selectedFiles];
    input.value = '';
    selectedFiles = [];
    renderFileList();
    setProcessing(true);
    
    try {
      updateLastMessage({ status: 'done' });
      addMessage('assistant', '...', 'processing');
      await window.AIChat.send({ prompt, files: payloadFiles });
      await new Promise(r => setTimeout(r, 1000));
      
      // Thử copy markdown với retry mechanism
      const aiResponse = await window.AIChat.copyLastTurnAsMarkdown();
      updateLastMessage({ content: aiResponse || '(AI không trả về nội dung)', status: 'done' });
      
      // Sau khi có response, nếu là tin nhắn đầu tiên thì tạo chat ID và update URL
      if (isFirstMessage && !currentChatId && ChatHistoryManager && ChatRouter) {
        currentChatId = ChatHistoryManager.generateChatId();
        ChatRouter.updateURL(currentChatId, true); // Use replaceState
        console.log(`[ChatHistory] Created new chat: ${currentChatId}`);
      }
    } catch (error) {
      console.error('❌ Lỗi khi gửi tin nhắn:', error);
      
      // Hiển thị lỗi với nút retry
      const errorHtml = `
        <div style="color: #ef4444; padding: 12px; background: #2a1515; border-radius: 8px; border: 1px solid #7f1d1d;">
          <div style="font-weight: 600; margin-bottom: 8px;">❌ Lỗi: ${escapeHtml(error.message)}</div>
          <button 
            onclick="window.retryLastCopy()" 
            style="background: #dc2626; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 500; margin-top: 4px;"
            onmouseover="this.style.background='#b91c1c'" 
            onmouseout="this.style.background='#dc2626'"
          >
            🔄 Thử lại (Retry)
          </button>
        </div>
      `;
      updateLastMessage({ content: errorHtml, status: 'error' });
    } finally {
      setProcessing(false);
    }
  }

  /**
   * Retry function để gọi lại copyLastTurnAsMarkdown
   */
  window.retryLastCopy = async function() {
    if (!window.AIChat) {
      alert('❌ AIChat engine chưa sẵn sàng!');
      return;
    }
    
    console.log('🔄 Người dùng click retry...');
    setProcessing(true);
    
    try {
      updateLastMessage({ content: '🔄 Đang thử lại copy markdown...', status: 'processing' });
      
      // Gọi lại với full 3 retry attempts
      const aiResponse = await window.AIChat.copyLastTurnAsMarkdown();
      updateLastMessage({ content: aiResponse || '(AI không trả về nội dung)', status: 'done' });
      
      console.log('✅ Retry thành công!');
    } catch (error) {
      console.error('❌ Retry vẫn thất bại:', error);
      
      const errorHtml = `
        <div style="color: #ef4444; padding: 12px; background: #2a1515; border-radius: 8px; border: 1px solid #7f1d1d;">
          <div style="font-weight: 600; margin-bottom: 8px;">❌ Vẫn lỗi: ${escapeHtml(error.message)}</div>
          <button 
            onclick="window.retryLastCopy()" 
            style="background: #dc2626; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 500; margin-top: 4px;"
            onmouseover="this.style.background='#b91c1c'" 
            onmouseout="this.style.background='#dc2626'"
          >
            🔄 Thử lại (Retry)
          </button>
        </div>
      `;
      updateLastMessage({ content: errorHtml, status: 'error' });
    } finally {
      setProcessing(false);
    }
  };

  function handleAddFiles(newFiles) {
    if (isProcessing) return;
    for (const file of newFiles) selectedFiles.push(file);
    renderFileList();
  }

  /*********************************
   * UI Panel Construction
   *********************************/
  const panel = document.createElement('div');
  panel.id = 'ai-chat-test-panel';
  
  // CSS Styles
  const css = `
    /* Panel mặc định (minimized) */
    #ai-chat-test-panel {
      position: fixed;
      bottom: 20px; 
      right: 20px;
      width: 500px; 
      height: 700px;
      background-color: #18181b;
      border: 1px solid #27272a;
      border-radius: 12px;
      box-shadow: 0 20px 50px rgba(0,0,0,0.5);
      z-index: 9999999999;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex; flex-direction: column; overflow: hidden; color: #ededed;
      transition: width 0.3s ease, height 0.3s ease, border-radius 0.3s ease;
    }

    /* Class khi maximize */
    #ai-chat-test-panel.maximized {
      width: 100vw !important;
      height: 100vh !important;
      top: 0 !important;
      left: 0 !important;
      bottom: auto !important;
      right: auto !important;
      border-radius: 0 !important;
      border: none;
    }

    #chat-panel-header {
      cursor: move; /* Con trỏ di chuyển cho header */
    }
    /* Khi maximize thì không kéo được nữa */
    #ai-chat-test-panel.maximized #chat-panel-header {
      cursor: default;
    }

    #chat-messages::-webkit-scrollbar { width: 4px; }
    #chat-messages::-webkit-scrollbar-track { background: transparent; }
    #chat-messages::-webkit-scrollbar-thumb { background: #3f3f46; border-radius: 2px; }
    
    .panel-btn { background: transparent; border: none; color: #a1a1aa; cursor: pointer; padding: 4px; border-radius: 4px; transition: all 0.2s; }
    .panel-btn:hover { color: #ededed; background: #27272a; }
    .drag-active { border-color: #4ade80 !important; background-color: #27272a !important; box-shadow: 0 0 10px rgba(74, 222, 128, 0.1); }
    @keyframes spin { 100% { transform: rotate(360deg); } }

    /* Markdown & Mermaid Styles (như cũ) */
    .markdown-body { font-size: 14px; }
    .markdown-body p { margin-bottom: 8px; margin-top: 0; }
    .markdown-body code { font-family: monospace; font-size: 12px; background: #3f3f46; color: #e4e4e7; padding: 2px 4px; border-radius: 4px; }
    .markdown-body pre { background: #0f0f10; padding: 10px; border-radius: 6px; overflow-x: auto; margin: 8px 0; border: 1px solid #27272a; }
    .markdown-body pre code { background: transparent; padding: 0; color: #a7f3d0; border: none; }
    .mermaid { margin: 10px 0; overflow-x: auto; }
    .markdown-body h1, .markdown-body h2 { font-weight: 600; margin-top: 16px; margin-bottom: 8px; color: #fff; }
  `;

  panel.innerHTML = `
    <style>${css}</style>
    
    <!-- Header: Đã thêm ID để xử lý drag -->
    <div id="chat-panel-header" style="height: 48px; border-bottom: 1px solid #27272a; display: flex; align-items: center; justify-content: space-between; padding: 0 16px; flex-shrink: 0; user-select: none;">
      <div style="font-weight: 500; font-size: 14px; color: #ededed; display: flex; align-items: center; gap: 8px;">
        Dev núi lãng lãng
      </div>
      <div style="display: flex; gap: 4px;">
        <button id="chat-clear-btn" class="panel-btn" title="Xóa lịch sử"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>
        
        <!-- Nút Toggle Fullscreen (Thay thế nút close) -->
        <button id="chat-toggle-btn" class="panel-btn" title="Phóng to / Thu nhỏ">
          <!-- Icon phóng to (mặc định) -->
          <svg id="icon-maximize" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>
          <!-- Icon thu nhỏ (ẩn ban đầu) -->
          <svg id="icon-minimize" style="display:none;" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 14 10 14 10 20"></polyline><polyline points="20 10 14 10 14 4"></polyline><line x1="14" y1="10" x2="21" y2="3"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>
        </button>
      </div>
    </div>

    <!-- Messages -->
    <div id="chat-messages" style="flex: 1; padding: 20px; overflow-y: auto; background-color: #18181b;"></div>

    <!-- Input -->
    <div style="padding: 16px; background-color: #18181b; border-top: 1px solid #27272a;">
      <div id="chat-input-wrapper" style="background: #202023; border: 1px solid #3f3f46; border-radius: 8px; padding: 8px; display: flex; flex-direction: column; gap: 6px; transition: all 0.2s ease;">
        <div id="chat-file-list" style="display: flex; flex-wrap: wrap;"></div>
        <textarea id="chat-input" placeholder="Nhập tin nhắn..." style="width: 100%; background: transparent; border: none; color: #ededed; resize: none; font-family: inherit; font-size: 14px; outline: none; height: 40px; min-height: 40px;"></textarea>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div style="display: flex; gap: 4px;">
            <input id="chat-file-input" type="file" multiple style="display: none" />
            <button id="chat-file-btn" class="panel-btn" style="color: #a1a1aa;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg></button>
          </div>
          <button id="chat-send-btn" style="width: 28px; height: 28px; border-radius: 4px; background: #ededed; color: #18181b; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>
          </button>
        </div>
      </div>
    </div>
  `;
  // trigger để insert vào cuối DOM
  await new Promise((resolve) => setTimeout(resolve, 5000)); 
  document.body.appendChild(panel);

  /*********************************
   * EVENT HANDLERS
   *********************************/

  // 1. Xử lý Toggle Fullscreen
  const toggleBtn = document.getElementById('chat-toggle-btn');
  const iconMax = document.getElementById('icon-maximize');
  const iconMin = document.getElementById('icon-minimize');

  toggleBtn.onclick = () => {
    isMaximized = !isMaximized;
    if (isMaximized) {
      panel.classList.add('maximized');
      iconMax.style.display = 'none';
      iconMin.style.display = 'block';
    } else {
      panel.classList.remove('maximized');
      iconMax.style.display = 'block';
      iconMin.style.display = 'none';
      // Reset về vị trí hợp lý nếu bị kéo ra ngoài màn hình
      const rect = panel.getBoundingClientRect();
      if (rect.top < 0) panel.style.top = '0px';
      if (rect.left < 0) panel.style.left = '0px';
    }
  };

  // 2. Xử lý Dragging (Kéo thả cửa sổ)
  const header = document.getElementById('chat-panel-header');

  header.addEventListener('mousedown', (e) => {
    // Không cho kéo nếu đang fullscreen hoặc bấm vào nút trong header
    if (isMaximized || e.target.closest('button')) return;

    isDragging = true;
    
    // Tính offset: vị trí chuột so với góc trái trên của panel
    const rect = panel.getBoundingClientRect();
    dragOffsetX = e.clientX - rect.left;
    dragOffsetY = e.clientY - rect.top;

    // Chuyển sang position fixed với toạ độ cụ thể để kéo mượt
    // Xóa bottom/right để dùng top/left
    panel.style.bottom = 'auto';
    panel.style.right = 'auto';
    panel.style.width = rect.width + 'px'; // Giữ nguyên kích thước
    panel.style.height = rect.height + 'px';
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    
    e.preventDefault();
    let newLeft = e.clientX - dragOffsetX;
    let newTop = e.clientY - dragOffsetY;

    // (Tuỳ chọn) Giới hạn không cho kéo hẳn ra ngoài màn hình
    const maxX = window.innerWidth - 50;
    const maxY = window.innerHeight - 50;
    if (newLeft < -400) newLeft = -400; // Cho phép giấu 1 phần
    if (newTop < 0) newTop = 0; // Không cho lên quá header web

    panel.style.left = `${newLeft}px`;
    panel.style.top = `${newTop}px`;
  });

  document.addEventListener('mouseup', () => {
    isDragging = false;
  });

  /*********************************
   * CHAT HISTORY FUNCTIONS
   *********************************/
  
  /**
   * Auto-save chat với debouncing
   */
  function autoSaveChat() {
    if (!ChatHistoryManager || !currentChatId) return;
    
    // Clear existing timeout
    if (autoSaveTimeout) {
      clearTimeout(autoSaveTimeout);
    }
    
    // Debounce: save after 500ms of inactivity
    autoSaveTimeout = setTimeout(() => {
      const success = ChatHistoryManager.saveChat(currentChatId, messages);
      if (success) {
        console.log(`[ChatHistory] Auto-saved chat ${currentChatId}`);
      }
     }, 500);
  }
  
  /**
   * Initialize chat session từ URL
   */
  async function initializeChatSession() {
    // Check local variables, not window properties
    if (!ChatHistoryManager || !ChatRouter) {
      console.warn('[ChatHistory] Managers not loaded, skipping history initialization');
      return;
    }
    
    const route = ChatRouter.getCurrentRoute();
    console.log('[ChatHistory] Current route:', route);
    
    if (route.isNew) {
      // New chat - start fresh
      console.log('[ChatHistory] Starting new chat');
      currentChatId = null;
      messages = [];
      renderMessages();
    } else if (route.chatId) {
      // Load existing chat
      console.log(`[ChatHistory] Loading chat: ${route.chatId}`);
      currentChatId = route.chatId;
      
      const chatData = ChatHistoryManager.loadChat(currentChatId);
      if (chatData && chatData.messages) {
        messages = chatData.messages;
        renderMessages();
        console.log(`[ChatHistory] Loaded ${messages.length} messages`);
      } else {
        console.warn(`[ChatHistory] Chat ${currentChatId} not found in storage`);
        // Chat chưa có trong localStorage, giữ nguyên ID và bắt đầu chat mới
        // KHÔNG redirect về new_chat!
        messages = [];
        renderMessages();
        console.log(`[ChatHistory] Starting fresh chat with ID: ${currentChatId}`);
      }
    } else {
      // No specific route, start fresh
      console.log('[ChatHistory] No chat ID in URL, starting fresh');
      currentChatId = null;
      messages = [];
      renderMessages();
    }
  }
  
  /**
   * Handle route changes (browser back/forward)
   */
  function handleRouteChange(newChatId) {
    console.log(`[ChatHistory] Route changed to: ${newChatId || 'new chat'}`);
    
    // Reload chat session
    if (newChatId && newChatId !== currentChatId) {
      currentChatId = newChatId;
      const chatData = ChatHistoryManager.loadChat(currentChatId);
      if (chatData && chatData.messages) {
        messages = chatData.messages;
        renderMessages();
      }
    } else if (!newChatId) {
      // New chat
      currentChatId = null;
      messages = [];
      selectedFiles = [];
      renderFileList();
      renderMessages();
    }
  }
  
  // 3. Các sự kiện cũ (Chat, File,...)
  document.getElementById('chat-clear-btn').onclick = () => {
    // Delete from localStorage if chat exists
    if (currentChatId && ChatHistoryManager) {
      ChatHistoryManager.deleteChat(currentChatId);
      console.log(`[ChatHistory] Deleted chat ${currentChatId}`);
    }
    
    // Clear UI
    messages = [];
    selectedFiles = [];
    currentChatId = null;
    renderFileList();
    renderMessages();
    
    // Navigate to new chat
    if (ChatRouter) {
      ChatRouter.navigateToNewChat(true);
    }
  };

  const fileInput = document.getElementById('chat-file-input');
  document.getElementById('chat-file-btn').onclick = () => fileInput.click();
  fileInput.onchange = (e) => { handleAddFiles(e.target.files); fileInput.value = ''; };

  const dropZone = document.getElementById('chat-input-wrapper');
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => { e.preventDefault(); e.stopPropagation(); }, false);
  });
  dropZone.addEventListener('dragover', () => { if (!isProcessing) dropZone.classList.add('drag-active'); });
  dropZone.addEventListener('dragleave', () => { dropZone.classList.remove('drag-active'); });
  dropZone.addEventListener('drop', (e) => {
    dropZone.classList.remove('drag-active');
    if (isProcessing) return;
    handleAddFiles(e.dataTransfer.files);
  });

  document.getElementById('chat-send-btn').onclick = () => { if (!isProcessing) sendMessage(); };
  document.getElementById('chat-input').onkeydown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (!isProcessing) sendMessage(); }
  };
  
  const chatInput = document.getElementById('chat-input');
  chatInput.addEventListener('input', function() {
    this.style.height = '40px';
    if(this.scrollHeight > 40) this.style.height = Math.min(this.scrollHeight, 120) + 'px';
  });

  renderMessages();
  
  // Initialize chat session and setup route change listener
  initializeChatSession();
  
  if (ChatRouter) {
    ChatRouter.onRouteChange(handleRouteChange);
  }
  
  console.log('✅ Manus UI Panel (Resizable & Draggable) injected with Chat History');
})();