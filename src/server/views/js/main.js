// Main entry point - Initialize application
import { SYSTEM_PROMPT } from './config.js';
import { checkHealth } from './api.js';
import './handlers.js'; // Import to register global functions
import { showToast, showCopiedState } from './utils.js';
import { initIframeManager } from './features/iframe-manager.js';
import { initGitView } from './features/git-view.js';

/**
 * Initialize application on DOM ready
 */
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
});

/**
 * Check and update server status
 */
async function checkServerStatus() {
    const statusEl = document.getElementById('status');
    const isHealthy = await checkHealth();
    
    if (isHealthy) {
        statusEl.textContent = '● Online';
        statusEl.style.background = 'rgba(52, 199, 89, 0.15)';
        statusEl.style.color = 'var(--ios-green)';
    } else {
        statusEl.textContent = '● Offline';
        statusEl.style.background = 'rgba(255, 59, 48, 0.15)';
        statusEl.style.color = 'var(--ios-red)';
    }
}

/**
 * Initialize Theme Logic
 */
function initTheme() {
    const themeBtn = document.getElementById('theme-toggle');
    const themeIcon = document.getElementById('theme-icon');
    
    // Get current theme from DOM (set by inline script) or localStorage
    let currentTheme = localStorage.getItem('theme') || 'light';
    
    // Update icon initially
    updateThemeIcon(currentTheme);

    themeBtn.addEventListener('click', () => {
        // Toggle theme
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        
        // Update DOM
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        
        // Update local state
        currentTheme = newTheme;
        updateThemeIcon(newTheme);
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

// Extension Helpers
async function loadExtensionPath() {
    try {
        const res = await fetch('/api/extension-path');
        const data = await res.json();
        const input = document.getElementById('extension-path-input');
        
        if (data.exists) {
            input.value = data.path;
        } else {
            input.value = "Error: Extension folder not found. Run 'npm run build' first.";
            input.style.color = "var(--ios-red)";
        }
    } catch (err) {
        console.error('Failed to load extension path', err);
    }
}

// Expose extension handlers to window for onclick events
window.toggleExtensionGuide = function() {
    const content = document.getElementById('extension-content');
    const icon = document.getElementById('ext-toggle-icon');
    content.classList.toggle('open');
    icon.classList.toggle('open');
}

window.copyExtensionPath = function(event) {
    const input = document.getElementById('extension-path-input');
    const btn = event.currentTarget;
    const icon = document.getElementById('ext-copy-icon');
    const text = document.getElementById('ext-copy-text');

    navigator.clipboard.writeText(input.value).then(() => {
        showCopiedState(btn, icon, text, '📋', 'Copy Path');
        showToast('Đã copy đường dẫn extension', 'success');
    }).catch(err => {
        showToast('Lỗi copy: ' + err.message, 'error');
    });
}

window.copyChromeUrl = function(event) {
    const input = document.getElementById('chrome-url-input');
    const btn = event.currentTarget;
    const originalText = btn.innerHTML;

    navigator.clipboard.writeText(input.value).then(() => {
        btn.innerHTML = '✓';
        showToast('Đã copy URL', 'success');
        setTimeout(() => {
            btn.innerHTML = originalText;
        }, 1500);
    }).catch(err => {
        showToast('Lỗi copy: ' + err.message, 'error');
    });
}
