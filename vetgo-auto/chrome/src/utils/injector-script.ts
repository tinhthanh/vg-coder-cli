// VG Coder Iframe Injector Script (Bundled for Extension)
// Two-Button Toggle with hidden fullscreen when collapsed

export const VG_CODER_INJECTOR_SCRIPT = `
(function() {
  'use strict';
  
  const CONFIG = {
    VG_CODER_URL: 'http://localhost:6868?embedded=true',
    IFRAME_ID: 'vg-coder-side-iframe',
    CONTAINER_ID: 'vg-coder-container',
    CONTROLS_ID: 'vg-coder-controls',
    RESIZE_HANDLE_ID: 'vg-coder-resize-handle',
    DEFAULT_WIDTH: '420px',
    FULLSCREEN_WIDTH: '100%',
    MIN_WIDTH: 300,
    MAX_WIDTH_PERCENT: 70,
    STATE_DEFAULT: 'default',
    STATE_FULLSCREEN: 'fullscreen',
    STATE_COLLAPSED: 'collapsed',
    Z_INDEX: 9999,
    STORAGE_KEY_WIDTH: 'vg_coder_width',
    STORAGE_KEY_STATE: 'vg_coder_state',
  };
  
  if (sessionStorage.getItem('VG_CODER_NESTED') === 'true') {
    console.log('🚫 VG Coder iframe injection skipped - nested context');
    return;
  }
  
  if (window.self !== window.top && document.referrer.includes(':6868')) {
    console.log('🚫 VG Coder iframe injection skipped - parent is :6868');
    return;
  }
  
  if (document.getElementById(CONFIG.CONTAINER_ID)) {
    console.log('⚠️ VG Coder iframe already injected');
    return;
  }
  
  function getState() {
    return localStorage.getItem(CONFIG.STORAGE_KEY_STATE) || CONFIG.STATE_DEFAULT;
  }
  
  function getWidth() {
    return localStorage.getItem(CONFIG.STORAGE_KEY_WIDTH) || CONFIG.DEFAULT_WIDTH;
  }
  
  function setState(state) {
    localStorage.setItem(CONFIG.STORAGE_KEY_STATE, state);
  }
  
  function setWidth(width) {
    localStorage.setItem(CONFIG.STORAGE_KEY_WIDTH, width);
  }
  
  function injectStyles() {
    const style = document.createElement('style');
    style.textContent = '#' + CONFIG.CONTAINER_ID + ' {' +
      'position: fixed; top: 0; left: 0; bottom: 0;' +
      'width: ' + getWidth() + ';' +
      'background: #1a1a1a; z-index: ' + CONFIG.Z_INDEX + ';' +
      'display: flex; flex-direction: column;' +
      'box-shadow: 4px 0 12px rgba(0, 0, 0, 0.3);' +
      'transition: width 0.3s ease, transform 0.3s ease;' +
      '}' +
      '#' + CONFIG.CONTAINER_ID + '.collapsed { transform: translateX(-100%); }' +
      '#' + CONFIG.IFRAME_ID + ' {' +
      'flex: 1; border: none; width: 100%; height: 100%; background: white;' +
      '}' +
      '#' + CONFIG.CONTROLS_ID + ' {' +
      'position: absolute; top: 50%; right: -36px; transform: translateY(-50%);' +
      'z-index: ' + (CONFIG.Z_INDEX + 1) + '; display: flex; flex-direction: column; gap: 4px;' +
      'transition: right 0.3s ease;' +
      '}' +
      '#' + CONFIG.CONTROLS_ID + '.fullscreen {' +
      'right: 12px;' +
      '}' +
      '#' + CONFIG.CONTROLS_ID + ' button {' +
      'background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);' +
      'color: white; border: none; border-radius: 0 6px 6px 0;' +
      'padding: 8px 6px; cursor: pointer; font-size: 18px;' +
      'box-shadow: -2px 2px 6px rgba(0, 0, 0, 0.2);' +
      'transition: all 0.2s ease; width: 32px; height: 32px;' +
      'display: flex; align-items: center; justify-content: center;' +
      '}' +
      '#' + CONFIG.CONTROLS_ID + ' button.hidden {' +
      'display: none;' +
      '}' +
      '#' + CONFIG.CONTROLS_ID + ' button:hover {' +
      'background: linear-gradient(135deg, #764ba2 0%, #667eea 100%);' +
      'box-shadow: -3px 3px 8px rgba(0, 0, 0, 0.3);' +
      '}' +
      '#' + CONFIG.RESIZE_HANDLE_ID + ' {' +
      'position: absolute; right: 0; top: 0; bottom: 0; width: 6px;' +
      'cursor: ew-resize; background: transparent; transition: background 0.2s ease;' +
      '}' +
      '#' + CONFIG.RESIZE_HANDLE_ID + ':hover { background: rgba(102, 126, 234, 0.5); }' +
      '#' + CONFIG.RESIZE_HANDLE_ID + '.resizing { background: rgba(102, 126, 234, 0.8); }';
    document.head.appendChild(style);
  }
  
  function createContainer() {
    const container = document.createElement('div');
    container.id = CONFIG.CONTAINER_ID;
    const currentState = getState();
    if (currentState === CONFIG.STATE_COLLAPSED) {
      container.classList.add('collapsed');
    } else if (currentState === CONFIG.STATE_FULLSCREEN) {
      container.style.width = CONFIG.FULLSCREEN_WIDTH;
    }
    return container;
  }
  
  function createIframe() {
    const iframe = document.createElement('iframe');
    iframe.id = CONFIG.IFRAME_ID;
    iframe.src = CONFIG.VG_CODER_URL;
    iframe.title = 'VG Coder Dashboard';
    iframe.allow = 'clipboard-read; clipboard-write';
    return iframe;
  }
  
  function createResizeHandle() {
    const handle = document.createElement('div');
    handle.id = CONFIG.RESIZE_HANDLE_ID;
    return handle;
  }
  
  function createControls() {
    const controls = document.createElement('div');
    controls.id = CONFIG.CONTROLS_ID;
    const currentState = getState();
    if (currentState === CONFIG.STATE_FULLSCREEN) {
      controls.classList.add('fullscreen');
    }
    const btnFullscreen = document.createElement('button');
    btnFullscreen.innerHTML = currentState === CONFIG.STATE_FULLSCREEN ? '◧' : '▣';
    btnFullscreen.title = currentState === CONFIG.STATE_FULLSCREEN ? 'Default (45%)' : 'Fullscreen (100%)';
    if (currentState === CONFIG.STATE_COLLAPSED) {
      btnFullscreen.classList.add('hidden');
    }
    const btnCollapse = document.createElement('button');
    btnCollapse.innerHTML = currentState === CONFIG.STATE_COLLAPSED ? '▶' : '◄';
    btnCollapse.title = currentState === CONFIG.STATE_COLLAPSED ? 'Expand' : 'Collapse';
    controls.appendChild(btnFullscreen);
    controls.appendChild(btnCollapse);
    return controls;
  }
  
  function initResize(container, handle, controls) {
    let isResizing = false, startX = 0, startWidth = 0;
    handle.addEventListener('mousedown', (e) => {
      isResizing = true; startX = e.clientX; startWidth = container.offsetWidth;
      handle.classList.add('resizing');
      document.body.style.cursor = 'ew-resize';
      document.body.style.userSelect = 'none';
      e.preventDefault();
    });
    document.addEventListener('mousemove', (e) => {
      if (!isResizing) return;
      const deltaX = e.clientX - startX;
      const newWidth = startWidth + deltaX;
      const maxWidth = window.innerWidth * (CONFIG.MAX_WIDTH_PERCENT / 100);
      if (newWidth >= CONFIG.MIN_WIDTH && newWidth <= maxWidth) {
        const widthPercent = (newWidth / window.innerWidth) * 100;
        container.style.width = widthPercent + '%';
        setWidth(widthPercent + '%');
      }
    });
    document.addEventListener('mouseup', () => {
      if (isResizing) {
        isResizing = false; handle.classList.remove('resizing');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    });
  }
  
  function initControls(container, controls) {
    const buttons = controls.querySelectorAll('button');
    const btnFullscreen = buttons[0];
    const btnCollapse = buttons[1];
    btnFullscreen.addEventListener('click', () => {
      const currentState = getState();
      if (currentState === CONFIG.STATE_FULLSCREEN) {
        setState(CONFIG.STATE_DEFAULT);
        container.style.width = CONFIG.DEFAULT_WIDTH;
        controls.classList.remove('fullscreen');
        btnFullscreen.innerHTML = '▣';
        btnFullscreen.title = 'Fullscreen (100%)';
      } else {
        setState(CONFIG.STATE_FULLSCREEN);
        container.style.width = CONFIG.FULLSCREEN_WIDTH;
        controls.classList.add('fullscreen');
        btnFullscreen.innerHTML = '◧';
        btnFullscreen.title = 'Default (45%)';
      }
    });
    btnCollapse.addEventListener('click', () => {
      const currentState = getState();
      if (currentState === CONFIG.STATE_COLLAPSED) {
        setState(CONFIG.STATE_DEFAULT);
        container.classList.remove('collapsed');
        container.style.width = CONFIG.DEFAULT_WIDTH;
        controls.classList.remove('fullscreen');
        btnCollapse.innerHTML = '◄';
        btnCollapse.title = 'Collapse';
        btnFullscreen.classList.remove('hidden');
        btnFullscreen.innerHTML = '▣';
        btnFullscreen.title = 'Fullscreen (100%)';
      } else {
        const wasFullscreen = currentState === CONFIG.STATE_FULLSCREEN;
        setState(CONFIG.STATE_COLLAPSED);
        container.classList.add('collapsed');
        if (wasFullscreen) {
          controls.classList.remove('fullscreen');
        }
        btnFullscreen.classList.add('hidden');
        btnCollapse.innerHTML = '▶';
        btnCollapse.title = 'Expand';
      }
    });
  }
  
  function init() {
    if (!document.body) {
      setTimeout(init, 100);
      return;
    }
    console.log('🚀 Initializing VG Coder iframe injection...');
    injectStyles();
    const container = createContainer();
    const iframe = createIframe();
    const resizeHandle = createResizeHandle();
    const controls = createControls();
    container.appendChild(resizeHandle);
    container.appendChild(iframe);
    container.appendChild(controls);
    document.body.appendChild(container);
    initResize(container, resizeHandle, controls);
    initControls(container, controls);
    console.log('✅ VG Coder iframe injected successfully');
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
`;
