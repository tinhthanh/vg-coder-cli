  const RUN_BTN_CLASS = 'ms-run-bash-btn';
  const EVENT_TYPE = 'vg:paste-run';

  function isBashCodeBlock(msCodeBlock) {
    const title = msCodeBlock.querySelector(
      'mat-panel-title, .mat-expansion-panel-header-title'
    );
    return title?.innerText?.toLowerCase().includes('bash');
  }

  function dispatchPasteRun(code) {
    // Ưu tiên dùng globalDispatcher nếu có
    const dispatcher =
      window.__VG_EVENT_DISPATCHER__ ||
      window.globalDispatcher ||
      null;

    const eventPayload = {
      type: EVENT_TYPE,
      source: 'ms-code-block',
      target: 'bubble-runner',
      payload: {
        code,
        from: 'run-bash-button',
      },
      context: 'window',
    };

    if (dispatcher?.dispatchCrossContext) {
      dispatcher.dispatchCrossContext(eventPayload);
      console.log('📡 Dispatched via globalDispatcher:', EVENT_TYPE);
      return;
    }

    // Fallback: CustomEvent
    window.dispatchEvent(
      new CustomEvent(EVENT_TYPE, {
        detail: eventPayload,
      })
    );

    console.log('📡 Dispatched via CustomEvent:', EVENT_TYPE);
  }

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.error('❌ Clipboard write failed', err);
      return false;
    }
  }

  function addRunButton(msCodeBlock) {
    if (msCodeBlock.querySelector(`.${RUN_BTN_CLASS}`)) return;

    const actionsContainer = msCodeBlock.querySelector('.actions-container');
    if (!actionsContainer) return;

    const btn = document.createElement('button');
    btn.className = `${RUN_BTN_CLASS} ms-button-borderless ms-button-icon`;
    btn.innerHTML = `
       Run bash
    `;
    btn.title = 'Run bash';

    const stopAll = e => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
    };

    btn.addEventListener('mousedown', stopAll);
    btn.addEventListener('mouseup', stopAll);

    btn.addEventListener('click', async e => {
      stopAll(e);

      const code =
        msCodeBlock.querySelector('pre code')?.innerText ||
        msCodeBlock.querySelector('pre')?.innerText ||
        '';

      if (!code.trim()) {
        console.warn('⚠️ No bash code found');
        return;
      }

      console.log('▶ Run bash triggered');

      const copied = await copyToClipboard(code);
      if (!copied) {
        console.warn('⚠️ Clipboard copy failed, abort run');
        return;
      }

      dispatchPasteRun(code);
    });

    actionsContainer.prepend(btn);
    console.log('✅ Run bash button injected');
  }

  // Polling vì ms-code-block render động
  const scanInterval = setInterval(() => {
    document.querySelectorAll('ms-code-block').forEach(block => {
      if (isBashCodeBlock(block)) {
        addRunButton(block);
      }
    });
  }, 1000);

  console.log('🚀 Bash Run detector active (vg:paste-run)');
