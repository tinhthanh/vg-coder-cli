import { API_BASE, SYSTEM_PROMPT } from './config.js';
import { checkHealth } from './api.js';
import { initEventHandlers } from './handlers.js'; 
import { showToast, getById, setRoot, qs } from './utils.js';
import { initGitView } from './features/git-view.js';
import { initTerminal } from './features/terminal.js';
import { initEditorTabs } from './features/editor-tabs.js';
// REMOVED: initMonaco
import { initResizeHandler } from './features/resize.js';
import { initSavedCommands } from './features/commands.js';
import './features/structure.js';
import { initBubble } from './features/bubble.js';
import { initKeyboardShortcuts } from './features/keyboard-shortcuts.js';

// NEW: Import Tool Window modules
import { initToolWindow } from './features/tool-window.js';
import { initProjectPanel } from './features/project-panel.js';
import { initGitPanel } from './features/git-panel.js';
import { initCommandsPanel } from './features/commands-panel.js';

export async function initMain() {
    console.log('VG Coder: Starting Main Logic...');

    try {
        const promptEl = getById('prompt-text');
        if (promptEl) promptEl.textContent = SYSTEM_PROMPT;
        

        initTheme();
        loadExtensionPath();
        
        // Initialize event handlers FIRST (before bubble which dispatches events)
        initEventHandlers();
        
        // NEW: Initialize Tool Window system
        initToolWindow();
        initProjectPanel();
        initGitPanel();
        initCommandsPanel();
        
        initGitView();
        initTerminal();
        initEditorTabs();
        initResizeHandler();
        initSavedCommands();
        // initProjectSwitcher(); // REMOVED: project-panel.js now handles project polling
        
        // Init Bubble (will use event protocol)
        initBubble();
        
        // Initialize keyboard shortcuts (global hotkeys for Shadow DOM)
        initKeyboardShortcuts();

        console.log('✅ VG Coder: Initialization Complete');
    } catch (e) {
        console.error('VG Coder Init Failed:', e);
    }
}

// Để ngắn gọn, tôi copy lại phần còn lại của main.js
window.addEventListener('project-switched', async (event) => {
    const { projectId, projectName } = event.detail;
    if (window.updateTerminalVisibility) window.updateTerminalVisibility(projectId);
    if (window.loadSavedCommands) await window.loadSavedCommands();
    const treeContainer = getById('structure-tree');
    if (treeContainer) treeContainer.style.display = 'none';
    const treeContent = getById('tree-content');
    if (treeContent) treeContent.innerHTML = '';
});


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
