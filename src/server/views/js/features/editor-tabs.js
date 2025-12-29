import { openFileInMonaco, saveViewState, disposeModel } from './monaco-manager.js';
import { getById, qsa, qs } from '../utils.js';

let activeTabs = [];
let currentPath = null; // Default to null (empty editor)

export function initEditorTabs() {
    renderTabs();
}

export async function openFileTab(path, name, icon = '📄') {
    // Luôn hiển thị code view
    toggleViewMode('code');

    if (currentPath && currentPath !== path) {
        saveViewState(currentPath);
    }

    const existingTab = activeTabs.find(t => t.path === path);
    if (!existingTab) {
        activeTabs.push({ path, name, icon });
        renderTabs();
    }
    
    currentPath = path;
    updateTabUI();

    await openFileInMonaco(path);
}

export function switchTab(path) {
    if (currentPath) {
        saveViewState(currentPath);
    }

    currentPath = path;
    updateTabUI();
    
    // Luôn mở code mode
    toggleViewMode('code');
    openFileInMonaco(path);
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
            currentPath = null;
            updateTabUI();
            // Clear editor content or show welcome message
            const monacoContainer = getById('monaco-container');
            if (monacoContainer) monacoContainer.innerHTML = ''; 
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
    // Không cần update AI tab nữa vì nó đã bị xóa
    const fileTabs = qsa('#file-tabs-container .tab-item');
    fileTabs.forEach(el => {
        if (el.dataset.path === currentPath) el.classList.add('active');
        else el.classList.remove('active');
    });
}

function toggleViewMode(mode) {
    // Hàm này giờ chỉ còn tác dụng đảm bảo monaco visible
    // vì iframe container đã bị xóa
    const monacoContainer = getById('monaco-container');
    if(monacoContainer) monacoContainer.classList.remove('view-mode-hidden');
}

window.switchTab = switchTab;
window.closeTab = closeTab;
window.openFileTab = openFileTab;
