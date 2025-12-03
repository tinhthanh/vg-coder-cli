// Main entry point - Initialize application
import { SYSTEM_PROMPT } from './config.js';
import { checkHealth } from './api.js';
import './handlers.js'; // Import to register global functions

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
