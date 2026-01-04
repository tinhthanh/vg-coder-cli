
(() => {
  if (window.AIChat) {
    console.warn('AIChat already injected');
    return;
  }

  /*********************************
   * State Management
   *********************************/
  let autoScrollInterval = null;

  /*********************************
   * Chat History Management (No Cache)
   *********************************/
  
  /**
   * Extract chat ID from URL
   * Example: https://aistudio.google.com/prompts/1_MFt2BE-NCNtdKPASm3MK-xO6JvYGjtD
   * Returns: '1_MFt2BE-NCNtdKPASm3MK-xO6JvYGjtD' or null
   */
  function getChatIdFromUrl() {
    const url = window.location.pathname;
    const match = url.match(/\/prompts\/([^/]+)/);
    return match ? match[1] : null;
  }
  
  /**
   * Get turn ID from ms-chat-turn element
   */
  function getTurnId(turnElement) {
    return turnElement?.id?.replace('turn-', '') || null;
  }
  
  /**
   * Extract message from turn element
   */
  async function extractMessageFromTurn(turnElement, index) {
    const turnId = getTurnId(turnElement);
    
    // Extract from DOM using CDP (same as copyLastTurnAsMarkdown)
    console.log(`[ChatHistory] Extracting message ${index + 1} via CDP...`);
    
    // Scroll to turn
    turnElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await new Promise(r => setTimeout(r, 300));
    
    // Determine role from data-turn-role attribute
    const container = turnElement.querySelector('[data-turn-role]');
    const turnRole = container?.getAttribute('data-turn-role');
    const role = turnRole === 'User' ? 'user' : 'assistant';
    
    // Extract content via CDP (same method as copyLastTurnAsMarkdown)
    const content = await copyTurnAsMarkdown(turnElement);
    
    const messageData = {
      id: turnId,
      role,
      content: content.trim(),
      timestamp: Date.now()
    };
    
    return messageData;
  }
  
  /**
   * Get current messages (last 2 from bottom up)
   * Always fresh - no caching
   * @returns {Promise<Array>} Array of message objects
   */
  async function getCurrentMessages() {
    const chatId = getChatIdFromUrl();
    
    // If not in a chat URL, return empty
    if (!chatId) {
      console.log('[ChatHistory] Not in a chat URL, returning empty messages');
      return [];
    }
    
    const turns = document.querySelectorAll('ms-chat-turn');
    if (!turns.length) {
      console.log('[ChatHistory] No turns found');
      return [];
    }
    
    // Filter out thinking messages (skip turns with thinking indicators)
    const validTurns = Array.from(turns).filter(turn => {
      // Check for <ms-thought-chunk> element (thinking process)
      const hasThoughtChunk = turn.querySelector('ms-thought-chunk');
      if (hasThoughtChunk) {
        console.log('[ChatHistory] Skipping thinking message:', getTurnId(turn));
        return false;
      }
      
      // Also check for old class-based pattern (backup)
      const thinkingElements = turn.querySelectorAll("[class*='thinking-']");
      const hasThinkingClass = thinkingElements.length > 0;
      if (hasThinkingClass) {
        console.log('[ChatHistory] Skipping thinking message (class):', getTurnId(turn));
        return false;
      }
      
      return true;
    });
    
    // Get last 2 valid turns only
    const last2Turns = validTurns.slice(-2);
    
    console.log(`[ChatHistory] Fetching last ${last2Turns.length} messages for chat ${chatId} (skipped ${turns.length - validTurns.length} thinking messages)`);
    
    const messages = [];
    for (let i = 0; i < last2Turns.length; i++) {
      const msg = await extractMessageFromTurn(last2Turns[i], i);
      messages.push(msg);
    }
    
    return messages;
  }

  /*********************************
   * Event Bus
   *********************************/
  const listeners = {};

  function emit(event, payload) {
    (listeners[event] || []).forEach(fn => fn(payload));
    window.postMessage(
      { source: 'AI_AUTOMATION', type: event, payload },
      '*'
    );
  }

  function on(event, fn) {
    listeners[event] = listeners[event] || [];
    listeners[event].push(fn);
  }

  function off(event, fn) {
    listeners[event] = (listeners[event] || []).filter(f => f !== fn);
  }

  /*********************************
   * Auto-scroll Utils
   *********************************/
  function startAutoScroll() {
    // Clear any existing interval
    stopAutoScroll();
    
    console.log('📜 Bắt đầu auto-scroll...');
    
    autoScrollInterval = setInterval(() => {
      const scrollContainer = document.querySelector('ms-autoscroll-container');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }, 100); // Scroll mỗi 100ms để mượt
  }

  function stopAutoScroll() {
    if (autoScrollInterval) {
      clearInterval(autoScrollInterval);
      autoScrollInterval = null;
      console.log('⏸️ Dừng auto-scroll');
    }
  }

  /*********************************
   * Utils
   *********************************/
  function waitForElement(selector, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const timer = setInterval(() => {
        const el = document.querySelector(selector);
        if (el) {
          clearInterval(timer);
          resolve(el);
        }
        if (Date.now() - start > timeout) {
          clearInterval(timer);
          reject(`Timeout: ${selector}`);
        }
      }, 100);
    });
  }

  function waitForRunFinish(runBtn) {
    return new Promise(resolve => {
      const observer = new MutationObserver(() => {
        const finished =
          runBtn.type === 'submit' &&
          runBtn.getAttribute('aria-disabled') === 'true' &&
          runBtn.innerText.includes('Run');

        if (finished) {
          observer.disconnect();
          resolve();
        }
      });

      observer.observe(runBtn, {
        attributes: true,
        childList: true,
        subtree: true,
        attributeFilter: ['aria-disabled', 'type']
      });
    });
  }

  /**
   * Interval liên tục để tự động skip preference voting
   * Chạy global, không timeout, cứ gặp dialog là skip ngay
   */
  function startAutoSkipPreferenceVoting() {
    console.log('🔄 Bắt đầu auto-skip preference voting (continuous)...');
    
    setInterval(() => {
      // Tìm dialog inline preference voting
      const preferenceDialog = document.querySelector('ms-inline-preference-vote-middleware');
      
      if (preferenceDialog) {
        // Check xem đã skip chưa (tránh click nhiều lần)
        if (preferenceDialog.hasAttribute('data-vg-skipped')) {
          return;
        }
        
        console.log('🔍 Phát hiện dialog "Which response do you prefer?"');
        
        // Tìm nút Skip
        const skipButton = Array.from(preferenceDialog.querySelectorAll('button'))
          .find(btn => btn.textContent.trim() === 'Skip');
        
        if (skipButton) {
          console.log('⏭️ Tự động nhấn Skip...');
          skipButton.click();
          
          // Đánh dấu đã skip để tránh click lại
          preferenceDialog.setAttribute('data-vg-skipped', 'true');
          
          emit('PREFERENCE_SKIPPED');
          console.log('✅ Đã skip preference voting');
        }
      }
    }, 200); // Check liên tục mỗi 200ms
  }

  /**
   * Đọc nội dung từ clipboard
   * Ưu tiên dùng vetgoReadClipboard nếu có, fallback về navigator.clipboard
   */
  async function readClipboard() {
    try {
      if (window.vetgoReadClipboard) {
        const markdown = await window.vetgoReadClipboard();
        console.log('🚀 Đã copy markdown của turn cuối', markdown);
        return markdown;
      } else if (navigator.clipboard && navigator.clipboard.readText) {
        return await navigator.clipboard.readText();
      } else {
        throw new Error('Clipboard API không khả dụng');
      }
    } catch (error) {
      console.error('❌ Lỗi đọc clipboard:', error);
      throw error;
    }
  }

  /**
   * Copy turn as markdown (extracted from copyLastTurnAsMarkdown for reuse)
   * @param {HTMLElement} turnElement - The ms-chat-turn element
   * @returns {Promise<string>} Markdown content
   */
  async function copyTurnAsMarkdown(turnElement) {
    try {
      // 1. Ép hiện actions
      const actions = turnElement.querySelector('.actions.hover-or-edit');
      if (actions) {
        actions.style.opacity = '1';
        actions.style.pointerEvents = 'auto';
        actions.style.visibility = 'visible';
      }

      // 2. Click nút More (⋮) với CDP
      const moreBtn = turnElement.querySelector(
        'ms-chat-turn-options button.mat-mdc-menu-trigger'
      );

      if (!moreBtn) {
        throw new Error('Không tìm thấy nút More (⋮)');
      }

      moreBtn.click();

      // 3. Đợi menu render
      await new Promise(r => setTimeout(r, 400));

      // 4. Tìm & click "Copy as markdown"
      const copyMarkdownBtn =
        document.querySelector('.cdk-overlay-pane .copy-markdown-button')
          ?.closest('button');

      if (!copyMarkdownBtn) {
        throw new Error('Không tìm thấy Copy as markdown');
      }

      // Trigger click body
      window.vetgoCDPClick(copyMarkdownBtn);
    //  copyMarkdownBtn.click();

      // 5. Đợi Angular write vào clipboard
      await new Promise(r => setTimeout(r, 500));

      // 6. Đọc lại từ clipboard
      const markdown = await readClipboard();
      
      return markdown;
      
    } catch (error) {
      console.error('[ChatHistory] Failed to copy turn as markdown:', error);
      throw error;
    }
  }

  /**
   * Copy markdown của turn cuối cùng vào clipboard (Using CDP!)
   * @param {number} retryCount - Số lần retry còn lại
   * @returns {Promise<string>} Nội dung markdown đã copy
   */
  async function copyLastTurnAsMarkdown(retryCount = 3) {
    const attemptNumber = 4 - retryCount; // Attempt 1, 2, 3
    console.log(`📋 [Attempt ${attemptNumber}/3] Bắt đầu copy markdown...`);
    
    try {
      // 1. Lấy ms-chat-turn cuối cùng
      const turns = document.querySelectorAll('ms-chat-turn');
      if (!turns.length) {
        throw new Error('Không tìm thấy ms-chat-turn');
      }

      const lastTurn = turns[turns.length - 1];
      
      // 2. Use refactored copyTurnAsMarkdown
      const markdown = await copyTurnAsMarkdown(lastTurn);
      console.log('✅ Read markdown via server API:', markdown.substring(0, 100) + '...');
      
      // No caching - always fetch fresh
      
      console.log(`✅ [Attempt ${attemptNumber}/3] Copy markdown thành công!`);
      return markdown;
      
    } catch (error) {
      console.error(`❌ [Attempt ${attemptNumber}/3] Lỗi:`, error.message);
      
      // Nếu còn retry, thử lại
      if (retryCount > 1) {
        const waitTime = attemptNumber * 500; // Exponential backoff: 500ms, 1000ms, 1500ms
        console.log(`🔄 Đợi ${waitTime}ms trước khi retry...`);
        await new Promise(r => setTimeout(r, waitTime));
        
        return copyLastTurnAsMarkdown(retryCount - 1);
      }
      
      // Hết retry, emit event để UI có thể hiện nút retry
      console.error('❌ Đã thử 3 lần nhưng vẫn thất bại!');
      emit('COPY_MARKDOWN_FAILED', { error: error.message, attempts: 3 });
      
      throw error;
    }
  }

  /*********************************
   * Core actions
   *********************************/
  async function sendFiles(files) {
    if (!files || !files.length) return;

    const promptBox = await waitForElement('ms-prompt-box');
    const dt = new DataTransfer();
    files.forEach(f => dt.items.add(f));

    promptBox.dispatchEvent(
      new DragEvent('drop', {
        bubbles: true,
        cancelable: true,
        dataTransfer: dt
      })
    );

    emit('FILES_SENT', { count: files.length });
  }

  async function sendPrompt(text) {
    if (!text) return;

    const textarea = await waitForElement(
      'textarea[formcontrolname="promptText"]'
    );

    textarea.focus();
    textarea.value = text;
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.dispatchEvent(new Event('change', { bubbles: true }));

    emit('PROMPT_SENT', { text });
  }

  async function clickRunAndWait() {
    const runBtn = await waitForElement(
      'ms-run-button button[aria-label="Run"]'
    );

    await new Promise(resolve => {
      const i = setInterval(() => {
        if (runBtn.getAttribute('aria-disabled') === 'false') {
          clearInterval(i);
          runBtn.click();
          emit('RUN_CLICKED');
          
          // Bắt đầu auto-scroll ngay sau khi click Run
          startAutoScroll();
          
          resolve();
        }
      }, 100);
    });

    try {
      await waitForRunFinish(runBtn);
      emit('DONE');
    } catch (error) {
      console.error('❌ Lỗi khi chờ AI trả lời:', error);
      emit('ERROR', { error: error.message });
    } finally {
      // Dừng auto-scroll khi AI xong hoặc lỗi
      stopAutoScroll();
    }
  }

  /*********************************
   * Public API
   *********************************/
  async function send({ prompt = '', files = [] }) {
    emit('START', { prompt, files });

    if (files.length) await sendFiles(files);
    if (prompt) await sendPrompt(prompt);

    await clickRunAndWait();

    return { ok: true };
  }

  /*********************************
   * Message Bridge
   *********************************/
  window.addEventListener('message', async e => {
    if (!e.data || e.data.source !== 'AI_AUTOMATION') return;

    if (e.data.type === 'SEND') {
      const { prompt, files } = e.data.payload || {};
      await send({ prompt, files });
    }
  });

  /*********************************
   * Export
   *********************************/
  window.AIChat = {
    send,
    on,
    off,
    readClipboard,              // ← Export hàm đọc clipboard
    copyLastTurnAsMarkdown,     // ← Export hàm copy markdown
    getCurrentMessages,         // ← Export hàm lấy messages hiện tại
    getChatIdFromUrl            // ← Export hàm lấy chat ID
  };

  // Khởi động interval tự động skip preference voting
  startAutoSkipPreferenceVoting();

  console.log('✅ AIChat automation engine ready (Auto-skip preference voting enabled)');
})();
