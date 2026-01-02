(() => {
  if (document.getElementById('ai-automation-ui')) {
    console.warn('UI already exists');
    return;
  }

  /*********************************
   * UI Helpers
   *********************************/
  function setStatus(text, type = 'info') {
    const el = document.getElementById('ai-ui-status');
    if (!el) return;
    el.innerText = text;
    el.style.color =
      type === 'error' ? '#ef4444' :
      type === 'success' ? '#22c55e' :
      '#a1a1aa';
  }

  function setWaiting(waiting) {
    const btn = document.getElementById('ai-ui-send');
    const input = document.getElementById('ai-ui-prompt');

    btn.disabled = waiting;
    input.disabled = waiting;

    btn.innerText = waiting ? 'Waiting…' : 'Send';
    btn.style.opacity = waiting ? '0.6' : '1';
  }

  function resetForm() {
    document.getElementById('ai-ui-files').value = '';
    document.getElementById('ai-ui-prompt').value = '';
    document.getElementById('ai-ui-filelist').innerHTML = '';
  }

  /*********************************
   * UI Render
   *********************************/
  const panel = document.createElement('div');
  panel.id = 'ai-automation-ui';
  panel.innerHTML = `
    <div style="
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: 340px;
      background: #0f172a;
      color: #e5e7eb;
      border-radius: 12px;
      box-shadow: 0 10px 30px rgba(0,0,0,.45);
      z-index: 999999;
      font-family: system-ui;
    ">
      <div style="
        padding: 10px 12px;
        background: #020617;
        font-weight: 600;
        display: flex;
        justify-content: space-between;
        align-items: center;
      ">
        AI Automation UI
        <button id="ai-ui-close" style="
          background: none;
          border: none;
          color: #94a3b8;
          cursor: pointer;
        ">✕</button>
      </div>

      <div style="padding: 12px; display: grid; gap: 8px">
        <input
          id="ai-ui-files"
          type="file"
          multiple
          style="color:#cbd5f5"
        />

        <div id="ai-ui-filelist" style="
          font-size: 12px;
          color: #94a3b8;
          max-height: 80px;
          overflow: auto;
        "></div>

        <textarea
          id="ai-ui-prompt"
          placeholder="Prompt… (optional)"
          style="
            width: 100%;
            height: 60px;
            border-radius: 8px;
            border: none;
            padding: 6px;
            font-size: 13px;
            resize: vertical;
          "
        ></textarea>

        <button
          id="ai-ui-send"
          style="
            padding: 8px;
            border-radius: 8px;
            border: none;
            background: #4f46e5;
            color: #fff;
            font-weight: 600;
            cursor: pointer;
          "
        >
          Send
        </button>

        <div id="ai-ui-status" style="
          font-size: 12px;
          min-height: 16px;
        "></div>
      </div>
    </div>
  `;

  document.body.appendChild(panel);

  /*********************************
   * UI Events
   *********************************/
  const fileInput = panel.querySelector('#ai-ui-files');
  const fileList = panel.querySelector('#ai-ui-filelist');

  fileInput.onchange = () => {
    fileList.innerHTML = '';
    [...fileInput.files].forEach(f => {
      const div = document.createElement('div');
      div.innerText = `📎 ${f.name}`;
      fileList.appendChild(div);
    });
  };

  panel.querySelector('#ai-ui-send').onclick = () => {
    const files = [...fileInput.files];
    const prompt = panel.querySelector('#ai-ui-prompt').value.trim();

    if (!files.length && !prompt) {
      setStatus('⚠️ Không có dữ liệu gửi', 'error');
      return;
    }

    setWaiting(true);
    setStatus('🚀 Sending…');

    window.postMessage({
      source: 'AI_AUTOMATION',
      type: 'SEND',
      payload: { prompt, files }
    }, '*');
  };

  panel.querySelector('#ai-ui-close').onclick = () => panel.remove();

  /*********************************
   * Message Listener
   *********************************/
  window.addEventListener('message', e => {
    if (!e.data || e.data.source !== 'AI_AUTOMATION') return;

    switch (e.data.type) {
      case 'START':
        setStatus('⏳ AI processing…');
        setWaiting(true);
        break;

      case 'FILES_SENT':
        setStatus(`📎 Sent ${e.data.payload.count} file(s)`);
        break;

      case 'PROMPT_SENT':
        setStatus('✏️ Prompt sent');
        break;

      case 'RUN_CLICKED':
        setStatus('🤖 AI running…');
        break;

      case 'DONE':
        setStatus('✅ Done', 'success');
        setWaiting(false);
        resetForm();
        break;

      case 'ERROR':
        setStatus(`❌ ${e.data.payload}`, 'error');
        setWaiting(false);
        break;
    }
  });

  console.log('✅ AI Automation UI injected (postMessage based)');
})();

(() => {
  if (window.AIChat) {
    console.warn('AIChat already injected');
    return;
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
          resolve();
        }
      }, 100);
    });

    await waitForRunFinish(runBtn);
    emit('DONE');
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
    off
  };

  console.log('✅ AIChat automation engine ready');
})();
