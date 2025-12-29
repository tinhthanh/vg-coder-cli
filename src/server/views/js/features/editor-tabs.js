import { openFileInViewer } from './code-viewer.js';
import { getById, qsa, qs } from '../utils.js';

let activeTabs = [];
let currentPath = null;

export function initEditorTabs() {
    renderTabs();
}

export async function openFileTab(path, name, icon = '📄') {
    // Switch to code mode
    toggleViewMode('code');

    const existingTab = activeTabs.find(t => t.path === path);
    if (!existingTab) {
        activeTabs.push({ path, name, icon });
        renderTabs();
    }
    
    currentPath = path;
    updateTabUI();

    await openFileInViewer(path);
}

export function switchTab(path) {
    currentPath = path;
    updateTabUI();
    toggleViewMode('code');
    openFileInViewer(path);
}

export function closeTab(event, path) {
    event.stopPropagation();
    
    const index = activeTabs.findIndex(t => t.path === path);
    if (index === -1) return;

    activeTabs.splice(index, 1);

    if (currentPath === path) {
        if (activeTabs.length > 0) {
            const nextTab = activeTabs[activeTabs.length - 1];
            switchTab(nextTab.path);
        } else {
            currentPath = null;
            updateTabUI();
            const container = getById('code-viewer-container');
            if (container) container.innerHTML = '<div class="cv-empty">No file open</div>'; 
        }
    }
    renderTabs();
}

function renderTabs() {
    const container = getById('file-tabs-container');
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
    const fileTabs = qsa('#file-tabs-container .tab-item');
    fileTabs.forEach(el => {
        if (el.dataset.path === currentPath) el.classList.add('active');
        else el.classList.remove('active');
    });
}

function toggleViewMode(mode) {
    // Placeholder for view switching logic if needed in future
    // For now, it just ensures the container is visible if we were to hide it
    const container = getById('code-viewer-container');
    if (container) container.style.display = 'block';
}

// Expose to window for onclick handlers
window.switchTab = switchTab;
window.closeTab = closeTab;
window.openFileTab = openFileTab;
