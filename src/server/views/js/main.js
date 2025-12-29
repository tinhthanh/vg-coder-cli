import { API_BASE, SYSTEM_PROMPT } from './config.js';
import { checkHealth } from './api.js';
import './handlers.js'; 
import { showToast, getById, setRoot, qs } from './utils.js';
import { initGitView } from './features/git-view.js';
import { initTerminal } from './features/terminal.js';
import { initEditorTabs } from './features/editor-tabs.js';
import { initMonaco, updateMonacoTheme } from './features/monaco-manager.js';
// Resize is not strictly needed for 100% view but kept if we want internal resizing
import { initResizeHandler } from './features/resize.js'; 
import { initSavedCommands } from './features/commands.js';
import { initProjectSwitcher } from './features/project-switcher.js';
import './features/structure.js';
// NEW: Import Bubble
import { initBubble } from './features/bubble.js';

export async function initMain() {
    console.log('VG Coder: Starting Main Logic...');

    try {
        const promptEl = getById('prompt-text');
        if (promptEl) promptEl.textContent = SYSTEM_PROMPT;
        
        await checkServerStatus();
        await loadProjectInfo();

        initTheme();
        loadExtensionPath();
        
        initGitView();
        initTerminal();
        initMonaco();
        initEditorTabs();
        initResizeHandler();
        initSavedCommands();
        await initProjectSwitcher();
        
        // Init Bubble
        initBubble();

        console.log('✅ VG Coder: Initialization Complete');
    } catch (e) {
        console.error('VG Coder Init Failed:', e);
    }
}

// ... (Giữ nguyên các hàm helper khác: switchProject, loadProjectInfo, initTheme...)
// Để ngắn gọn, tôi copy lại phần còn lại của main.js
window.addEventListener('project-switched', async (event) => {
    const { projectId, projectName } = event.detail;
    await loadProjectInfo();
    if (window.updateTerminalVisibility) window.updateTerminalVisibility(projectId);
    if (window.loadSavedCommands) await window.loadSavedCommands();
    const treeContainer = getById('structure-tree');
    if (treeContainer) treeContainer.style.display = 'none';
    const treeContent = getById('tree-content');
    if (treeContent) treeContent.innerHTML = '';
});

async function checkServerStatus() {
    const statusEl = getById('status');
    if (!statusEl) return;
    const isHealthy = await checkHealth();
    if (isHealthy) {
        statusEl.textContent = '●';
        statusEl.style.background = 'transparent';
        statusEl.style.color = 'var(--ios-green)';
    } else {
        statusEl.textContent = '●';
        statusEl.style.background = 'transparent';
        statusEl.style.color = 'var(--ios-red)';
    }
}

async function loadProjectInfo() {
    try {
        const res = await fetch(`${API_BASE}/api/info?path=.`);
        const data = await res.json();
        const projectNameEl = getById('project-name');
        const projectMetaEl = getById('project-meta');
        if (projectNameEl) projectNameEl.textContent = data.path.split(/[\\/]/).pop();
        if (projectMetaEl) projectMetaEl.textContent = `${data.primaryType} • ${data.path}`;
    } catch (err) {}
}

function initTheme() {
    const themeBtn = getById('theme-toggle');
    if (!themeBtn) return;
    let currentTheme = localStorage.getItem('theme') || 'light';
    applyTheme(currentTheme);
    themeBtn.addEventListener('click', () => {
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        localStorage.setItem('theme', newTheme);
        currentTheme = newTheme;
        applyTheme(newTheme);
    });
}

function applyTheme(theme) {
    const themeIcon = getById('theme-icon');
    if (themeIcon) themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
    updateMonacoTheme(theme);
    const wrapper = getById('vg-app-root');
    if (wrapper) wrapper.setAttribute('data-theme', theme);
}

async function loadExtensionPath() {
    try {
        const res = await fetch(`${API_BASE}/api/extension-path`);
        const data = await res.json();
        const input = getById('extension-path-input-center');
        if (input && data.exists) input.value = data.path;
    } catch (err) {}
}

window.stopServer = async function() {
    if (!confirm('Are you sure you want to stop the server?')) return;
    try {
        await fetch(`${API_BASE}/api/shutdown`, { method: 'POST' });
        showToast('Server stopped successfully', 'success');
        setTimeout(() => {
            const wrapper = getById('vg-app-root');
            if(wrapper) wrapper.innerHTML = '<div style="display:flex;justify-content:center;align-items:center;height:100vh;"><h2>🛑 Server Stopped</h2></div>';
        }, 1000);
    } catch (error) {}
}

if (!window.__VG_CODER_ROOT__) {
    document.addEventListener('DOMContentLoaded', () => {
        setRoot(document);
        initMain();
    });
}
