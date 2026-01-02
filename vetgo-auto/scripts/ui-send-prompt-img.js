(async () => {
  // 1. Kiểm tra panel đã tồn tại chưa
  if (document.getElementById('ai-chat-test-panel')) {
    console.warn('Chat test panel already exists');
    return;
  }

  // 2. Load thư viện Markdown-it (Dynamic Import)
  if (typeof window.markdownit !== 'function') {
    console.log('⏳ Loading markdown-it...');
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/markdown-it@14.1.0/dist/markdown-it.min.js';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
    console.log('✅ Markdown-it loaded');
  }

  // 3. Khởi tạo Markdown Parser
  const md = window.markdownit({
    html: false,        // Không cho phép thẻ HTML thô (bảo mật)
    breaks: true,       // Enter là xuống dòng (<br>)
    linkify: true       // Tự động nhận diện link
  });

  /*********************************
   * State
   *********************************/
  let messages = [];
  let selectedFiles = [];
  let isProcessing = false;

  /*********************************
   * UI Helper Functions
   *********************************/
  
  function renderMessages() {
    const container = document.getElementById('chat-messages');
    
    // Empty State
    if (messages.length === 0) {
      container.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: #52525b; gap: 10px;">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path></svg>
          <span style="font-size: 13px;">Kéo thả file hoặc nhập tin nhắn</span>
        </div>
      `;
      return;
    }

    // Message List
    container.innerHTML = messages.map(msg => {
      const isUser = msg.role === 'user';
      
      // Render nội dung: Nếu là User thì text thường, AI thì dùng Markdown
      // (Hoặc dùng markdown cho cả 2 tuỳ ý, ở đây mình dùng cả 2 cho đẹp)
      const renderedContent = md.render(msg.content);

      return `
      <div style="display: flex; width: 100%; margin-bottom: 20px; ${isUser ? 'justify-content: flex-end;' : 'justify-content: flex-start;'}">
        ${!isUser ? `
          <div style="width: 24px; height: 24px; margin-right: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 2px;">
             <svg viewBox="0 0 24 24" style="width:18px; height:18px; color: #ededed; fill:none; stroke:currentColor; stroke-width:2;"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path></svg>
          </div>
        ` : ''}

        <div style="
          max-width: 85%;
          padding: 8px 14px;
          border-radius: ${isUser ? '12px' : '4px'};
          background: ${isUser ? '#27272a' : 'transparent'};
          color: #ededed;
          font-size: 14px;
          line-height: 1.6;
          border: ${isUser ? '1px solid #3f3f46' : 'none'};
          word-break: break-word;
          overflow-wrap: break-word;
        ">
          <!-- Class 'markdown-body' để áp dụng CSS -->
          <div class="markdown-body">${renderedContent}</div>
          
          <div style="margin-top: 6px; font-size: 10px; color: #71717a; display: flex; align-items: center; gap: 6px; justify-content: ${isUser ? 'flex-end' : 'flex-start'}">
            <span>${msg.timestamp}</span>
            <span>${getStatusIcon(msg.status, msg.role)}</span>
          </div>
        </div>
      </div>
    `}).join('');

    container.scrollTop = container.scrollHeight;
  }

  function renderFileList() {
    const listContainer = document.getElementById('chat-file-list');
    if (selectedFiles.length === 0) {
      listContainer.innerHTML = '';
      return;
    }

    listContainer.innerHTML = selectedFiles.map((file, index) => `
      <div style="
        display: inline-flex; align-items: center; gap: 6px; 
        background: #3f3f46; padding: 4px 8px; border-radius: 4px; 
        margin-right: 6px; margin-bottom: 4px; font-size: 11px; color: #e4e4e7;
      ">
        <span style="max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">📎 ${file.name}</span>
        <span style="color: #a1a1aa;">(${(file.size / 1024).toFixed(0)}KB)</span>
        <button onclick="window.removeChatFile(${index})" style="
          background: none; border: none; color: #ef4444; cursor: pointer; 
          font-weight: bold; padding: 0 2px; font-size: 14px; line-height: 1;
        ">×</button>
      </div>
    `).join('');
  }

  window.removeChatFile = (index) => {
    if (isProcessing) return;
    selectedFiles.splice(index, 1);
    renderFileList();
  };

  function addMessage(role, content, status = 'done') {
    messages.push({
      id: Date.now(),
      role,
      content,
      status,
      timestamp: new Date().toLocaleTimeString('vi-VN')
    });
    renderMessages();
  }

  function updateLastMessage(updates) {
    if (messages.length === 0) return;
    Object.assign(messages[messages.length - 1], updates);
    renderMessages();
  }

  function getStatusIcon(status, role) {
    if (status === 'sending') return '<span style="color:#71717a">sending...</span>';
    if (status === 'processing') return '<span style="color:#fbbf24">● thinking</span>';
    if (status === 'error') return '<span style="color:#ef4444">failed</span>';
    return '';
  }

  function setProcessing(processing) {
    isProcessing = processing;
    const input = document.getElementById('chat-input');
    const sendBtn = document.getElementById('chat-send-btn');
    const fileBtn = document.getElementById('chat-file-btn');
    const dropZone = document.getElementById('chat-input-wrapper');

    input.disabled = processing;
    sendBtn.disabled = processing;
    fileBtn.disabled = processing;
    
    if (processing) {
        dropZone.style.opacity = '0.5';
        dropZone.style.pointerEvents = 'none';
    } else {
        dropZone.style.opacity = '1';
        dropZone.style.pointerEvents = 'auto';
    }

    sendBtn.style.opacity = processing ? '0.3' : '1';
    sendBtn.innerHTML = processing 
      ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation: spin 1s linear infinite"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg>`
      : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>`;
    
    input.placeholder = processing ? 'AI đang suy nghĩ...' : 'Nhập tin nhắn...';
  }

  /*********************************
   * Core Logic
   *********************************/
  async function sendMessage() {
    const input = document.getElementById('chat-input');
    const prompt = input.value.trim();
    
    if (!prompt && selectedFiles.length === 0) {
      console.warn('Empty input');
      return;
    }

    if (!window.AIChat) {
      alert('❌ AIChat engine chưa được inject!');
      return;
    }

    let userMsg = prompt;
    if (selectedFiles.length > 0) {
      userMsg += `\n\n📎 Files: ${selectedFiles.map(f => f.name).join(', ')}`;
    }
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

      const aiResponse = await window.AIChat.copyLastTurnAsMarkdown();
      updateLastMessage({ 
        content: aiResponse || '(AI không trả về nội dung)',
        status: 'done' 
      });

    } catch (error) {
      console.error('Chat error:', error);
      updateLastMessage({ 
        content: `Lỗi: ${error.message}`,
        status: 'error' 
      });
    } finally {
      setProcessing(false);
    }
  }

  function handleAddFiles(newFiles) {
    if (isProcessing) return;
    for (const file of newFiles) {
        selectedFiles.push(file);
    }
    renderFileList();
  }

  /*********************************
   * UI Panel Construction
   *********************************/
  const panel = document.createElement('div');
  panel.id = 'ai-chat-test-panel';
  
  // Style CSS cho Markdown (quan trọng)
  const css = `
    #ai-chat-test-panel {
      position: fixed; bottom: 20px; right: 20px;
      width: 450px; height: 600px;
      background-color: #18181b;
      border: 1px solid #27272a;
      border-radius: 12px;
      box-shadow: 0 20px 50px rgba(0,0,0,0.5);
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex; flex-direction: column; overflow: hidden; color: #ededed;
    }
    #chat-messages::-webkit-scrollbar { width: 4px; }
    #chat-messages::-webkit-scrollbar-track { background: transparent; }
    #chat-messages::-webkit-scrollbar-thumb { background: #3f3f46; border-radius: 2px; }
    
    .panel-btn { background: transparent; border: none; color: #a1a1aa; cursor: pointer; padding: 4px; border-radius: 4px; transition: all 0.2s; }
    .panel-btn:hover { color: #ededed; background: #27272a; }
    .drag-active { border-color: #4ade80 !important; background-color: #27272a !important; box-shadow: 0 0 10px rgba(74, 222, 128, 0.1); }
    @keyframes spin { 100% { transform: rotate(360deg); } }

    /* --- MARKDOWN STYLES --- */
    .markdown-body p { margin-bottom: 8px; margin-top: 0; }
    .markdown-body p:last-child { margin-bottom: 0; }
    
    .markdown-body code {
      font-family: "Fira Code", Consolas, monospace;
      font-size: 12px;
      background: #3f3f46;
      color: #e4e4e7;
      padding: 2px 4px;
      border-radius: 4px;
    }
    
    .markdown-body pre {
      background: #0f0f10;
      padding: 10px;
      border-radius: 6px;
      overflow-x: auto;
      margin: 8px 0;
      border: 1px solid #27272a;
    }
    
    .markdown-body pre code {
      background: transparent;
      padding: 0;
      color: #a7f3d0; /* Code block color */
      border: none;
    }

    .markdown-body ul, .markdown-body ol { margin: 8px 0; padding-left: 20px; }
    .markdown-body li { margin-bottom: 4px; }
    
    .markdown-body a { color: #60a5fa; text-decoration: none; }
    .markdown-body a:hover { text-decoration: underline; }
    
    .markdown-body h1, .markdown-body h2, .markdown-body h3 { 
      font-weight: 600; margin-top: 16px; margin-bottom: 8px; color: #fff; line-height: 1.3;
    }
    .markdown-body h1 { font-size: 1.4em; }
    .markdown-body h2 { font-size: 1.2em; }
    .markdown-body h3 { font-size: 1.1em; }
    .markdown-body blockquote {
        border-left: 3px solid #4ade80;
        margin: 8px 0;
        padding-left: 10px;
        color: #a1a1aa;
    }
  `;

  panel.innerHTML = `
    <style>${css}</style>
    
    <!-- Header -->
    <div style="height: 48px; border-bottom: 1px solid #27272a; display: flex; align-items: center; justify-content: space-between; padding: 0 16px; flex-shrink: 0;">
      <div style="font-weight: 500; font-size: 14px; color: #ededed; display: flex; align-items: center; gap: 8px;">
        <span style="width: 8px; height: 8px; background: #4ade80; border-radius: 50%;"></span>
        Manus Test (Markdown)
      </div>
      <div style="display: flex; gap: 4px;">
        <button id="chat-clear-btn" class="panel-btn" title="Xóa lịch sử"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>
        <button id="chat-close-btn" class="panel-btn" title="Đóng"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
      </div>
    </div>

    <!-- Messages Area -->
    <div id="chat-messages" style="flex: 1; padding: 20px; overflow-y: auto; background-color: #18181b;"></div>

    <!-- Input Area -->
    <div style="padding: 16px; background-color: #18181b; border-top: 1px solid #27272a;">
      <div id="chat-input-wrapper" style="
        background: #202023; border: 1px solid #3f3f46; border-radius: 8px; padding: 8px; 
        display: flex; flex-direction: column; gap: 6px; transition: all 0.2s ease;
      ">
        <div id="chat-file-list" style="display: flex; flex-wrap: wrap;"></div>

        <textarea id="chat-input" placeholder="Nhập tin nhắn..." style="
          width: 100%; background: transparent; border: none; color: #ededed; 
          resize: none; font-family: inherit; font-size: 14px; outline: none; 
          height: 40px; min-height: 40px;
        "></textarea>

        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div style="display: flex; gap: 4px;">
            <input id="chat-file-input" type="file" multiple style="display: none" />
            <button id="chat-file-btn" class="panel-btn" style="color: #a1a1aa;" title="Đính kèm file">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
            </button>
          </div>
          <button id="chat-send-btn" style="
            width: 28px; height: 28px; border-radius: 4px; background: #ededed; color: #18181b; 
            border: none; cursor: pointer; display: flex; align-items: center; justify-content: center;
          ">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(panel);

  /*********************************
   * Event Handlers
   *********************************/
  document.getElementById('chat-close-btn').onclick = () => panel.remove();
  
  document.getElementById('chat-clear-btn').onclick = () => {
    messages = [];
    selectedFiles = [];
    renderFileList();
    renderMessages();
  };

  const fileInput = document.getElementById('chat-file-input');
  document.getElementById('chat-file-btn').onclick = () => fileInput.click();

  fileInput.onchange = (e) => {
    handleAddFiles(e.target.files);
    fileInput.value = '';
  };

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
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isProcessing) sendMessage();
    }
  };

  const chatInput = document.getElementById('chat-input');
  chatInput.addEventListener('input', function() {
    this.style.height = '40px';
    if(this.scrollHeight > 40) {
      this.style.height = Math.min(this.scrollHeight, 120) + 'px';
    }
  });

  renderMessages();
  console.log('✅ Manus UI Test Panel (Markdown Enabled) injected');
})();