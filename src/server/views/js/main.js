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
import { initResizeHandler } from './features/resize.js';
import { initSavedCommands } from './features/commands.js';
import { initProjectSwitcher } from './features/project-switcher.js';

document.addEventListener('DOMContentLoaded', async () => {
    // Load system prompt text
    document.getElementById('prompt-text').textContent = SYSTEM_PROMPT;
    
    // Check server status
    await checkServerStatus();

    // Load Project Info
    await loadProjectInfo();

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
    // Initialize Monaco & Tabs
    initMonaco();
    initEditorTabs();

    // Initialize Resize Handler
    initResizeHandler();
    
    // Initialize Saved Commands
    initSavedCommands();
    
    // Initialize Project Switcher
    await initProjectSwitcher();
    
    // Set default tab to AI Assistant
    if (window.switchTab) {
        window.switchTab('ai-assistant');
    }
});

// Global event handler for project switches
window.addEventListener('project-switched', async (event) => {
    const { projectId, projectName, project } = event.detail;
    console.log(`Project switched to: ${projectName}`);
    
    // Reload project info
    await loadProjectInfo();
    
    // Filter terminal visibility (show only terminals for active project)
    if (window.updateTerminalVisibility) {
        window.updateTerminalVisibility(projectId);
    }
    
    // Reload saved commands for new project
    if (window.loadSavedCommands) {
        await window.loadSavedCommands();
    }
    
    // Reset tree view (hide it)
    const treeContainer = document.getElementById('structure-tree');
    if (treeContainer) {
        treeContainer.style.display = 'none';
    }
    
    // Clear tree content
    const treeContent = document.getElementById('tree-content');
    if (treeContent) {
        treeContent.innerHTML = '';
    }
    
    // TODO: Refresh other context-dependent components
    // - Git view refresh
});

async function checkServerStatus() {
    const statusEl = document.getElementById('status');
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
        // Fetch info for current directory (.)
        const res = await fetch('/api/info?path=.');
        const data = await res.json();
        
        const projectNameEl = document.getElementById('project-name');
        const projectMetaEl = document.getElementById('project-meta');
        
        // Extract folder name from path
        const fullPath = data.path;
        // Handle both Windows (\) and Unix (/) paths
        const folderName = fullPath.split(/[\\/]/).pop();
        
        projectNameEl.textContent = folderName;
        projectMetaEl.textContent = `${data.primaryType} • ${fullPath}`;
        
    } catch (err) {
        console.error('Failed to load project info:', err);
        document.getElementById('project-name').textContent = 'Unknown Project';
        document.getElementById('project-meta').textContent = 'Error loading info';
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

window.stopServer = async function() {
    if (!confirm('Are you sure you want to stop the server?')) {
        return;
    }
    
    try {
        await fetch('/api/shutdown', { method: 'POST' });
        showToast('Server stopped successfully', 'success');
        
        // Show a message that server is stopped
        setTimeout(() => {
            document.body.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: center; height: 100vh; flex-direction: column; gap: 20px;">
                    <h2>🛑 Server Stopped</h2>
                    <p>You can close this tab now.</p>
                </div>
            `;
        }, 1000);
    } catch (error) {
        console.error('Failed to stop server:', error);
    }
}
