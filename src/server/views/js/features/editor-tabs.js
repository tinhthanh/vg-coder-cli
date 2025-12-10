import { openFileInMonaco, saveViewState, disposeModel } from './monaco-manager.js';

let activeTabs = []; // Array of { path, name, icon }
let currentPath = 'ai-assistant'; // Default

export function initEditorTabs() {
    renderTabs();
}

export async function openFileTab(path, name, icon = '📄') {
    // 1. Ẩn AI, hiện Monaco
    toggleViewMode('code');

    // 2. Lưu state tab cũ
    if (currentPath && currentPath !== 'ai-assistant' && currentPath !== path) {
        saveViewState(currentPath);
    }

    // 3. Logic Tabs Array
    const existingTab = activeTabs.find(t => t.path === path);
    if (!existingTab) {
        activeTabs.push({ path, name, icon });
        renderTabs();
    }
    
    // 4. Update UI
    currentPath = path;
    updateTabUI();

    // 5. Open in Monaco
    await openFileInMonaco(path);
}

export function switchTab(path) {
    if (currentPath && currentPath !== 'ai-assistant') {
        saveViewState(currentPath);
    }

    currentPath = path;
    updateTabUI();

    if (path === 'ai-assistant') {
        toggleViewMode('ai');
    } else {
        toggleViewMode('code');
        openFileInMonaco(path);
    }
}

export function closeTab(event, path) {
    event.stopPropagation();
    
    const index = activeTabs.findIndex(t => t.path === path);
    if (index === -1) return;

    activeTabs.splice(index, 1);
    disposeModel(path);

    if (currentPath === path) {
        if (activeTabs.length > 0) {
            const nextTab = activeTabs[activeTabs.length - 1];
            switchTab(nextTab.path);
        } else {
            switchTab('ai-assistant');
        }
    }
    renderTabs();
}

function renderTabs() {
    // Chỉ render các file tabs vào container con
    const container = document.getElementById('file-tabs-container');
    if (!container) return;
    
    let html = '';
    activeTabs.forEach(tab => {
        html += `
            <div class="tab-item" 
                 onclick="window.switchTab('${tab.path}')" 
                 data-path="${tab.path}"
                 title="${tab.path}">
                <span class="tab-icon">${tab.icon}</span>
                <span class="tab-name">${tab.name}</span>
                <span class="tab-close" onclick="window.closeTab(event, '${tab.path}')">×</span>
            </div>
        `;
    });

    container.innerHTML = html;
    updateTabUI();
}

function updateTabUI() {
    // 1. Update Static AI Tab
    const aiTab = document.getElementById('ai-tab');
    if (currentPath === 'ai-assistant') aiTab.classList.add('active');
    else aiTab.classList.remove('active');

    // 2. Update Dynamic Tabs
    const fileTabs = document.querySelectorAll('#file-tabs-container .tab-item');
    fileTabs.forEach(el => {
        if (el.dataset.path === currentPath) el.classList.add('active');
        else el.classList.remove('active');
    });
}

function toggleViewMode(mode) {
    const aiContainer = document.querySelector('.ai-iframe-container');
    const monacoContainer = document.getElementById('monaco-container');

    if (mode === 'code') {
        aiContainer.classList.add('view-mode-hidden');
        monacoContainer.classList.remove('view-mode-hidden');
    } else {
        aiContainer.classList.remove('view-mode-hidden');
        monacoContainer.classList.add('view-mode-hidden');
    }
}

// Export global helpers
window.switchTab = switchTab;
window.closeTab = closeTab;
window.openFileTab = openFileTab;
