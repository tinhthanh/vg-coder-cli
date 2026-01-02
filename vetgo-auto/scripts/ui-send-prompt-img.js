(() => {
  if (document.getElementById('ai-chat-test-panel')) {
    console.warn('Chat test panel already exists');
    return;
  }

  /*********************************
   * Chat State
   *********************************/
  let messages = [];
  let isProcessing = false;

  /*********************************
   * Helper Functions
   *********************************/
  function addMessage(role, content, status = 'done') {
    const msg = {
      id: Date.now(),
      role, // 'user' | 'assistant'
      content,
      status, // 'sending' | 'processing' | 'done' | 'error'
      timestamp: new Date().toLocaleTimeString('vi-VN')
    };
    messages.push(msg);
    renderMessages();
    return msg;
  }

  function updateLastMessage(updates) {
    if (messages.length === 0) return;
    Object.assign(messages[messages.length - 1], updates);
    renderMessages();
  }

  function renderMessages() {
    const container = document.getElementById('chat-messages');
    container.innerHTML = '';

    messages.forEach(msg => {
      const msgDiv = document.createElement('div');
      msgDiv.style.cssText = `
        display: flex;
        gap: 12px;
        margin-bottom: 16px;
        align-items: flex-start;
        animation: slideIn 0.3s ease;
      `;

      // Avatar
      const avatar = document.createElement('div');
      avatar.style.cssText = `
        width: 36px;
        height: 36px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
        flex-shrink: 0;
        ${msg.role === 'user' 
          ? 'background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);' 
          : 'background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);'
        }
      `;
      avatar.innerText = msg.role === 'user' ? '👤' : '🤖';

      // Message content
      const contentDiv = document.createElement('div');
      contentDiv.style.cssText = `
        flex: 1;
        background: ${msg.role === 'user' ? '#f3f4f6' : '#fff'};
        padding: 12px 16px;
        border-radius: 12px;
        ${msg.role === 'assistant' ? 'border: 1px solid #e5e7eb;' : ''}
        position: relative;
      `;

      // Status indicator
      let statusIcon = '';
      if (msg.status === 'sending') statusIcon = '📤';
      else if (msg.status === 'processing') statusIcon = '⏳';
      else if (msg.status === 'error') statusIcon = '❌';
      else if (msg.status === 'done' && msg.role === 'assistant') statusIcon = '✅';

      contentDiv.innerHTML = `
        <div style="
          font-size: 13px;
          color: #111;
          line-height: 1.6;
          white-space: pre-wrap;
          word-break: break-word;
        ">${escapeHtml(msg.content)}</div>
        <div style="
          margin-top: 8px;
          font-size: 11px;
          color: #9ca3af;
          display: flex;
          justify-content: space-between;
          align-items: center;
        ">
          <span>${msg.timestamp}</span>
          <span>${statusIcon}</span>
        </div>
      `;

      msgDiv.appendChild(avatar);
      msgDiv.appendChild(contentDiv);
      container.appendChild(msgDiv);
    });

    // Auto scroll to bottom
    container.scrollTop = container.scrollHeight;
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function setProcessing(processing) {
    isProcessing = processing;
    const input = document.getElementById('chat-input');
    const sendBtn = document.getElementById('chat-send-btn');
    const fileInput = document.getElementById('chat-file-input');

    input.disabled = processing;
    sendBtn.disabled = processing;
    fileInput.disabled = processing;

    if (processing) {
      sendBtn.innerHTML = '⏳';
      sendBtn.style.opacity = '0.6';
      input.placeholder = 'Đang xử lý...';
    } else {
      sendBtn.innerHTML = '🚀';
      sendBtn.style.opacity = '1';
      input.placeholder = 'Nhập câu hỏi...';
    }
  }

  /*********************************
   * Core Chat Logic
   *********************************/
  async function sendMessage() {
    const input = document.getElementById('chat-input');
    const fileInput = document.getElementById('chat-file-input');
    const prompt = input.value.trim();
    const files = [...fileInput.files];

    if (!prompt && files.length === 0) {
      alert('⚠️ Vui lòng nhập nội dung hoặc chọn file');
      return;
    }

    if (!window.AIChat) {
      alert('❌ AIChat engine chưa được inject!');
      return;
    }

    // Add user message
    let userMsg = prompt;
    if (files.length > 0) {
      userMsg += `\n\n📎 Files: ${files.map(f => f.name).join(', ')}`;
    }
    addMessage('user', userMsg, 'sending');

    // Clear input
    input.value = '';
    fileInput.value = '';
    document.getElementById('chat-file-list').innerHTML = '';

    setProcessing(true);

    try {
      // Update user message status
      updateLastMessage({ status: 'done' });

      // Add AI placeholder
      addMessage('assistant', 'Đang suy nghĩ...', 'processing');

      // Send to AI
      await window.AIChat.send({ prompt, files });

      // Wait a bit for AI to finish rendering
      await new Promise(r => setTimeout(r, 5000));

      // Copy AI response
      const aiResponse = await window.AIChat.copyLastTurnAsMarkdown();

      // Update AI message with real content
      updateLastMessage({ 
        content: aiResponse || '(AI không trả về nội dung)',
        status: 'done' 
      });

    } catch (error) {
      console.error('Chat error:', error);
      updateLastMessage({ 
        content: `❌ Lỗi: ${error.message}`,
        status: 'error' 
      });
    } finally {
      setProcessing(false);
    }
  }

  /*********************************
   * UI Panel
   *********************************/
  const panel = document.createElement('div');
  panel.id = 'ai-chat-test-panel';
  panel.innerHTML = `
    <style>
      @keyframes slideIn {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }

      #chat-messages::-webkit-scrollbar {
        width: 8px;
      }

      #chat-messages::-webkit-scrollbar-track {
        background: #f1f1f1;
        border-radius: 4px;
      }

      #chat-messages::-webkit-scrollbar-thumb {
        background: #cbd5e1;
        border-radius: 4px;
      }

      #chat-messages::-webkit-scrollbar-thumb:hover {
        background: #94a3b8;
      }
    </style>

    <div style="
      position: fixed;
      top: 50%;
      right: 24px;
      transform: translateY(-50%);
      width: 420px;
      height: 600px;
      background: #fff;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0,0,0,.15);
      z-index: 999999;
      font-family: 'Segoe UI', system-ui, sans-serif;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    ">
      
      <!-- Header -->
      <div style="
        padding: 16px 20px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: #fff;
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-shrink: 0;
      ">
        <div style="display: flex; align-items: center; gap: 10px">
          <span style="font-size: 24px">💬</span>
          <div>
            <div style="font-weight: 700; font-size: 16px">AI Chat Test</div>
            <div style="font-size: 11px; opacity: 0.9">Test automation engine</div>
          </div>
        </div>
        
        <div style="display: flex; gap: 8px">
          <button id="chat-clear-btn" style="
            background: rgba(255,255,255,.2);
            border: none;
            color: #fff;
            width: 32px;
            height: 32px;
            border-radius: 50%;
            cursor: pointer;
            font-size: 16px;
          " title="Clear chat">🗑️</button>
          
          <button id="chat-close-btn" style="
            background: rgba(255,255,255,.2);
            border: none;
            color: #fff;
            width: 32px;
            height: 32px;
            border-radius: 50%;
            cursor: pointer;
            font-size: 18px;
          ">×</button>
        </div>
      </div>

      <!-- Messages Area -->
      <div id="chat-messages" style="
        flex: 1;
        padding: 20px;
        overflow-y: auto;
        background: #fafafa;
      ">
        <div style="
          text-align: center;
          color: #9ca3af;
          font-size: 13px;
          padding: 40px 20px;
        ">
          👋 Xin chào! Hãy gửi câu hỏi để test AI automation
        </div>
      </div>

      <!-- Input Area -->
      <div style="
        padding: 16px;
        background: #fff;
        border-top: 1px solid #e5e7eb;
        flex-shrink: 0;
      ">
        
        <!-- File Upload -->
        <div style="margin-bottom: 12px">
          <input
            id="chat-file-input"
            type="file"
            multiple
            style="display: none"
          />
          <button id="chat-file-btn" style="
            padding: 6px 12px;
            border-radius: 6px;
            border: 1px solid #e5e7eb;
            background: #f9fafb;
            color: #6b7280;
            font-size: 12px;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 6px;
          ">
            📎 Attach files
          </button>
          <div id="chat-file-list" style="
            margin-top: 6px;
            font-size: 11px;
            color: #6b7280;
          "></div>
        </div>

        <!-- Text Input -->
        <div style="display: flex; gap: 8px">
          <textarea
            id="chat-input"
            placeholder="Nhập câu hỏi..."
            style="
              flex: 1;
              border: 2px solid #e5e7eb;
              border-radius: 12px;
              padding: 10px 12px;
              font-size: 14px;
              resize: none;
              height: 44px;
              font-family: inherit;
              transition: border-color .2s;
            "
          ></textarea>

          <button id="chat-send-btn" style="
            width: 44px;
            height: 44px;
            border-radius: 12px;
            border: none;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #fff;
            font-size: 18px;
            cursor: pointer;
            flex-shrink: 0;
            transition: transform .2s;
          ">
            🚀
          </button>
        </div>

        <!-- Quick Actions -->
        <div style="
          margin-top: 12px;
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        ">
          <button class="quick-btn" data-prompt="Viết 1 bài thơ về mùa xuân">
            🌸 Thơ mùa xuân
          </button>
          <button class="quick-btn" data-prompt="Tạo danh sách 5 món ăn Việt Nam">
            🍜 Món ăn VN
          </button>
          <button class="quick-btn" data-prompt="Giải thích AI là gì">
            🤖 AI là gì?
          </button>
        </div>
      </div>

    </div>
  `;

  document.body.appendChild(panel);

  // Apply styles for quick buttons
  const quickBtns = panel.querySelectorAll('.quick-btn');
  quickBtns.forEach(btn => {
    btn.style.cssText = `
      padding: 6px 10px;
      border-radius: 6px;
      border: 1px solid #e5e7eb;
      background: #fff;
      color: #6b7280;
      font-size: 11px;
      cursor: pointer;
      transition: all .2s;
    `;
    
    btn.addEventListener('mouseenter', () => {
      btn.style.background = '#f3f4f6';
      btn.style.borderColor = '#667eea';
      btn.style.color = '#667eea';
    });
    
    btn.addEventListener('mouseleave', () => {
      btn.style.background = '#fff';
      btn.style.borderColor = '#e5e7eb';
      btn.style.color = '#6b7280';
    });
  });

  /*********************************
   * Event Handlers
   *********************************/

  // Close button
  document.getElementById('chat-close-btn').onclick = () => {
    panel.remove();
  };

  // Clear chat
  document.getElementById('chat-clear-btn').onclick = () => {
    if (confirm('Xóa toàn bộ lịch sử chat?')) {
      messages = [];
      renderMessages();
      document.getElementById('chat-messages').innerHTML = `
        <div style="
          text-align: center;
          color: #9ca3af;
          font-size: 13px;
          padding: 40px 20px;
        ">
          👋 Xin chào! Hãy gửi câu hỏi để test AI automation
        </div>
      `;
    }
  };

  // File input
  document.getElementById('chat-file-btn').onclick = () => {
    document.getElementById('chat-file-input').click();
  };

  document.getElementById('chat-file-input').onchange = (e) => {
    const files = [...e.target.files];
    const fileList = document.getElementById('chat-file-list');
    
    if (files.length === 0) {
      fileList.innerHTML = '';
      return;
    }

    fileList.innerHTML = files.map(f => 
      `<div style="padding: 2px 0">📎 ${f.name} (${(f.size / 1024).toFixed(1)} KB)</div>`
    ).join('');
  };

  // Send button
  document.getElementById('chat-send-btn').onclick = () => {
    if (!isProcessing) sendMessage();
  };

  // Enter to send
  document.getElementById('chat-input').onkeydown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isProcessing) sendMessage();
    }
  };

  // Input focus effect
  const chatInput = document.getElementById('chat-input');
  chatInput.onfocus = () => {
    chatInput.style.borderColor = '#667eea';
  };
  chatInput.onblur = () => {
    chatInput.style.borderColor = '#e5e7eb';
  };

  // Quick action buttons
  quickBtns.forEach(btn => {
    btn.onclick = () => {
      const prompt = btn.getAttribute('data-prompt');
      document.getElementById('chat-input').value = prompt;
      document.getElementById('chat-input').focus();
    };
  });

  // Send button hover effect
  const sendBtn = document.getElementById('chat-send-btn');
  sendBtn.addEventListener('mouseenter', () => {
    if (!isProcessing) {
      sendBtn.style.transform = 'scale(1.05)';
    }
  });
  sendBtn.addEventListener('mouseleave', () => {
    sendBtn.style.transform = 'scale(1)';
  });

  console.log('✅ AI Chat Test Panel injected');
})();