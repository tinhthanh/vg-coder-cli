// Main entry point - Initialize application
import { SYSTEM_PROMPT } from './config.js';
import { checkHealth } from './api.js';
import './handlers.js'; 
import { showToast, showCopiedState } from './utils.js';
import { initIframeManager } from './features/iframe-manager.js';
import { initGitView } from './features/git-view.js';
import { initTerminal, createNewTerminal } from './features/terminal.js';
import { initEditorTabs } from './features/editor-tabs.js';
import { initMonaco, updateMonacoTheme } from './features/monaco-manager.js';

document.addEventListener('DOMContentLoaded', async () => {
    // Load system prompt text
    document.getElementById('prompt-text').textContent = SYSTEM_PROMPT;
    
    // Check server status
    await checkServerStatus();

    // Initialize Theme
    initTheme();

    // Load Extension Path
    loadExtensionPath();

    // Initialize Iframe Manager
    initIframeManager();

    // Initialize Git View
    initGitView();
    
    // Initialize Terminal System
    initTerminal();

    // Initialize Monaco & Tabs
    initMonaco();
    initEditorTabs();
    
    // Set default tab to AI Assistant
    if (window.switchTab) {
        window.switchTab('ai-assistant');
    }
});

async function checkServerStatus() {
    const statusEl = document.getElementById('status');
    const isHealthy = await checkHealth();
    
    if (isHealthy) {
        statusEl.textContent = '●';
        statusEl.style.background = 'transparent';
        statusEl.style.color = 'var(--ios-green)';
        statusEl.style.fontSize = '14px';
    } else {
        statusEl.textContent = '●';
        statusEl.style.background = 'transparent';
        statusEl.style.color = 'var(--ios-red)';
        statusEl.style.fontSize = '14px';
    }
}

function initTheme() {
    const themeBtn = document.getElementById('theme-toggle');
    let currentTheme = localStorage.getItem('theme') || 'light';
    updateThemeIcon(currentTheme);

    themeBtn.addEventListener('click', () => {
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        currentTheme = newTheme;
        updateThemeIcon(newTheme);
        updateMonacoTheme(newTheme);
    });
}

function updateThemeIcon(theme) {
    const themeIcon = document.getElementById('theme-icon');
    if (theme === 'dark') {
        themeIcon.textContent = '☀️';
    } else {
        themeIcon.textContent = '🌙';
    }
}

async function loadExtensionPath() {
    try {
        const res = await fetch('/api/extension-path');
        const data = await res.json();
        // Updated ID for the input in center guide
        const input = document.getElementById('extension-path-input-center');
        if (input) {
            if (data.exists) input.value = data.path;
            else {
                input.value = "Error: Extension folder not found.";
                input.style.color = "var(--ios-red)";
            }
        }
    } catch (err) {}
}

window.copyExtensionPath = function(event) {
    const input = document.getElementById('extension-path-input-center');
    const btn = event.currentTarget;
    const originalText = btn.textContent;
    
    navigator.clipboard.writeText(input.value).then(() => {
        btn.textContent = '✓';
        btn.style.background = 'var(--ios-green)';
        btn.style.color = 'white';
        btn.style.borderColor = 'var(--ios-green)';
        showToast('Đã copy đường dẫn extension', 'success');
        
        setTimeout(() => {
            btn.textContent = originalText;
            btn.style.background = '';
            btn.style.color = '';
            btn.style.borderColor = '';
        }, 2000);
    });
}

window.copyChromeUrl = function(event) {
    const input = document.getElementById('chrome-url-input-center');
    const btn = event.currentTarget;
    const originalText = btn.textContent;
    
    navigator.clipboard.writeText(input.value).then(() => {
        btn.textContent = '✓';
        btn.style.background = 'var(--ios-green)';
        btn.style.color = 'white';
        btn.style.borderColor = 'var(--ios-green)';
        showToast('Đã copy URL', 'success');
        
        setTimeout(() => {
            btn.textContent = originalText;
            btn.style.background = '';
            btn.style.color = '';
            btn.style.borderColor = '';
        }, 2000);
    });
}
