
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

      // 2. Ép hiện actions
      const actions = lastTurn.querySelector('.actions.hover-or-edit');
      if (actions) {
        actions.style.opacity = '1';
        actions.style.pointerEvents = 'auto';
        actions.style.visibility = 'visible';
      }

      // 3. Click nút More (⋮) với CDP - REAL click!
      const moreBtn = lastTurn.querySelector(
        'ms-chat-turn-options button.mat-mdc-menu-trigger'
      );

      if (!moreBtn) {
        throw new Error('Không tìm thấy nút More (⋮)');
      }

      console.log('📋 CDP Clicking More button...');
      // trigger click body 
      window.vetgoCDPClick(document.querySelector('body'));
      moreBtn.click();
      console.log('✅ More button clicked via CDP');

      // 4. Đợi menu render (Angular CDK overlay) - Tăng thời gian đợi
      await new Promise(r => setTimeout(r, 400));

      // 5. Tìm & click "Copy as markdown" với CDP
      const copyMarkdownBtn =
        document.querySelector('.cdk-overlay-pane .copy-markdown-button')
          ?.closest('button');

      if (!copyMarkdownBtn) {
        throw new Error('Không tìm thấy Copy as markdown');
      }

      console.log('📋 CDP Clicking Copy button...');
      await window.vetgoCDPClick(copyMarkdownBtn);
      console.log('✅ Copy button clicked via CDP');

      // 6. Đợi Angular write vào clipboard (CDP click = real user gesture!)
      await new Promise(r => setTimeout(r, 500));

      // 7. Đọc lại từ clipboard bằng server API (bypass restrictions!)
      const markdown = await readClipboard();
      console.log('✅ Read markdown via server API:', markdown.substring(0, 100) + '...');
      
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
    copyLastTurnAsMarkdown      // ← Export hàm copy markdown
  };

  // Khởi động interval tự động skip preference voting
  startAutoSkipPreferenceVoting();

  console.log('✅ AIChat automation engine ready (Auto-skip preference voting enabled)');
})();
