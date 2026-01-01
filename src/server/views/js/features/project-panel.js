import { getStructure, analyzeProject, copyToClipboard, saveTreeState as apiSaveTreeState, loadTreeState as apiLoadTreeState } from '../api.js';
import { showToast, formatNumber, getById, qsa } from '../utils.js';
import { API_BASE } from '../config.js';
import { switchProject } from './project-switcher.js';

let currentStructureData = null;
let excludedPaths = new Set();
let saveStateTimeout = null;
let isInitialized = false;

// Expose switchProject to window for selector onChange
window.switchProject = switchProject;

/**
 * Initialize Project Panel
 */
export function initProjectPanel() {
    // Listen for panel open events
    document.addEventListener('tool-panel-opened', (event) => {
        if (event.detail.panelId === 'project') {
            if (!isInitialized) {
                renderProjectPanel();
                loadProjectTree();
                isInitialized = true;
            }
        }
    });

    // Listen for project changes to update selector AND reload tree
    window.addEventListener('project-switched', (e) => {
        console.log('[ProjectPanel] 🔄 Project switched event detected:', e.detail);
        
        // Update selector to reflect new project
        loadProjectsIntoSelector();
        
        // Reload project tree for new project
        if (isInitialized) {
            console.log('[ProjectPanel] Reloading project tree for new project...');
            loadProjectTree();
        }
    });

    // Poll for project updates every 5 seconds (since socket.io may not be available in shadow DOM)
    setInterval(() => {
        if (getById('project-panel-selector')) {
            loadProjectsIntoSelector();
        }
    }, 30000);

    console.log('[ProjectPanel] Initialized with polling (Socket.IO not available in shadow DOM)');
}

/**
 * Render the Project Panel UI structure
 */
function renderProjectPanel() {
    const container = getById('project-panel-content');
    if (!container) return;

    // Get current project from main selector (if exists)
    const mainProjectSelector = getById('project-selector');
    const currentProject = mainProjectSelector ? mainProjectSelector.value : '';

    container.innerHTML = `
        <div class="project-panel-selector-wrapper">
            <select id="project-panel-selector" class="project-panel-selector" title="Switch Project">
                <option value="">Loading projects...</option>
            </select>
        </div>
        <div class="project-panel-actions-bar">
            <button class="project-action-btn" id="project-refresh-btn" title="Refresh Project Tree">
                <span>🔄</span>
                <span>Refresh</span>
            </button>
            <button class="project-action-btn" id="project-copy-selected-btn" title="Copy Selected Files">
                <span>📋</span>
                <span>Copy</span>
            </button>
        </div>
        <div class="project-token-summary" id="project-token-summary">
            <span>Selected:</span>
            <span class="project-token-count" id="project-token-count">0 tokens</span>
        </div>
        <div class="project-tree-wrapper" id="project-tree-wrapper">
            <div class="project-loading">Loading project structure...</div>
        </div>
    `;

    // Load projects into selector
    loadProjectsIntoSelector();

    // Attach event listeners
    const refreshBtn = getById('project-refresh-btn');
    const copyBtn = getById('project-copy-selected-btn');
    const projectSelector = getById('project-panel-selector');

    if (refreshBtn) {
        refreshBtn.addEventListener('click', loadProjectTree);
    }

    if (copyBtn) {
        copyBtn.addEventListener('click', handleCopySelected);
    }

    if (projectSelector) {
        console.log('[ProjectPanel] Attaching change listener to project selector');
        projectSelector.addEventListener('change', (e) => {
            const projectId = e.target.value;
            console.log('[ProjectPanel] Project selector changed to:', projectId);
            // Sync with main project selector
            if (window.switchProject) {
                window.switchProject(projectId);
            } else {
                console.warn('[ProjectPanel] window.switchProject not available');
            }
        });
    }
}

/**
 * Load projects into the panel selector
 */
async function loadProjectsIntoSelector() {
    const selector = getById('project-panel-selector');
    console.log('[ProjectPanel] loadProjectsIntoSelector called, selector exists:', !!selector);
    
    if (!selector) {
        console.warn('[ProjectPanel] Project selector not found in DOM');
        return;
    }

    // Save current selection to preserve it
    const currentValue = selector.value;
    
    try {
        const apiBase = window.API_BASE || 'http://localhost:6868';
        
        const response = await fetch(`${apiBase}/api/projects`);
        const data = await response.json();
        
        if (data.projects && data.projects.length > 0) {
            const options = data.projects.map(p => 
                `<option value="${p.id}" ${p.isActive ? 'selected' : ''}>${p.name}</option>`
            ).join('');
            
            selector.innerHTML = options;
            
            // IMPORTANT: Restore previous selection if it still exists
            // This prevents auto-switching when new projects join
            if (currentValue && data.projects.some(p => p.id === currentValue)) {
                selector.value = currentValue;
            } else {
            }
        } else {
            selector.innerHTML = '<option value="">No projects</option>';
        }
    } catch (err) {
        console.error('[ProjectPanel] Failed to load projects:', err);
        selector.innerHTML = '<option value="">Error loading projects</option>';
    }
}



/**
 * Load and render project tree
 */
async function loadProjectTree() {
    const wrapper = getById('project-tree-wrapper');
    if (!wrapper) return;

    wrapper.innerHTML = '<div class="project-loading">Loading project structure...</div>';

    try {
        // Get the current project path from the structure-path input (if exists) or use default
        const pathInput = getById('structure-path');
        const path = pathInput ? pathInput.value : '.';

        const data = await getStructure(path);
        currentStructureData = data.structure;

        // Load saved state
        await loadTreeState();

        // Render tree
        const treeHtml = generateProjectTree(currentStructureData);
        wrapper.innerHTML = `<ul class="project-tree-ul">${treeHtml}</ul>`;

        // IMPORTANT: Re-attach event listeners after rendering
        attachProjectTreeListeners();

        // Update token count
        updateTokenCount();

        showToast('Project tree loaded', 'success');
    } catch (err) {
        wrapper.innerHTML = `<div class="project-empty-state">Error loading project: ${err.message}</div>`;
        showToast('Error loading project: ' + err.message, 'error');
    }
}

/**
 * Generate project tree HTML
 */
function generateProjectTree(node, depth = 0) {
    if (!node) return '';

    // Handle compact folders (merge single-child directories)
    let currentNode = node;
    let displayName = node.name;
    
    if (currentNode.type === 'directory') {
        while (
            currentNode.children && 
            currentNode.children.length === 1 && 
            currentNode.children[0].type === 'directory'
        ) {
            const child = currentNode.children[0];
            displayName += '/' + child.name;
            currentNode = child;
        }
    }

    const isDir = currentNode.type === 'directory';
    const hasChildren = isDir && currentNode.children && currentNode.children.length > 0;
    const tokens = currentNode.tokens || 0;
    
    let tokenClass = 'project-token-low';
    if (tokens > 5000) tokenClass = 'project-token-high';
    else if (tokens > 2000) tokenClass = 'project-token-med';

    const icon = isDir ? '📁' : '📄';
    const arrow = hasChildren ? '▼' : '';
    const liClass = `project-tree-li ${hasChildren ? 'has-children' : ''}`;
    
    const nodePath = currentNode.relativePath || currentNode.path;
    const isExcluded = excludedPaths.has(nodePath);
    
    let html = `<li class="${liClass}">`;
    
    html += `
        <div class="project-tree-row" data-path="${nodePath}" data-type="${currentNode.type}">
            <span class="project-arrow">${arrow}</span>
            <input type="checkbox" class="project-checkbox" 
                   data-path="${nodePath}" 
                   data-tokens="${tokens}"
                   data-type="${currentNode.type}"
                   ${isExcluded ? '' : 'checked'}>
            <span class="project-icon">${icon}</span>
            <span class="project-name" title="${displayName}">${displayName}</span>
            <span class="project-token-badge ${tokenClass}">${formatNumber(tokens)}</span>
        </div>
    `;

    if (hasChildren) {
        html += '<ul class="project-tree-ul">';
        currentNode.children.forEach(child => {
            html += generateProjectTree(child, depth + 1);
        });
        html += '</ul>';
    }

    html += '</li>';
    return html;
}

/**
 * Handle tree interactions after render
 */
export function attachProjectTreeListeners() {
    const wrapper = getById('project-tree-wrapper');
    if (!wrapper) return;

    // Delegate events
    wrapper.addEventListener('click', (e) => {
        const row = e.target.closest('.project-tree-row');
        if (!row) return;

        // If clicking checkbox, don't toggle folder
        if (e.target.classList.contains('project-checkbox')) {
            handleCheckboxChange(e);
            return;
        }

        const type = row.dataset.type;
        const path = row.dataset.path;

        if (type === 'directory') {
            console.log('[ProjectPanel] Toggling directory:', path);
            // Toggle folder
            const li = row.closest('.project-tree-li');
            if (li && li.classList.contains('has-children')) {
                li.classList.toggle('collapsed');
            }
        } else {
            console.log('[ProjectPanel] 🔥 FILE CLICKED:', path);
            // Open file in editor
            const fileName = row.querySelector('.project-name').textContent;
            console.log('[ProjectPanel] File name:', fileName);
            console.log('[ProjectPanel] window.openFileTab exists:', typeof window.openFileTab !== 'undefined');
            
            if (window.openFileTab) {
                console.log('[ProjectPanel] Opening file tab:', path, fileName);
                window.openFileTab(path, fileName);
            } else {
                console.error('[ProjectPanel] window.openFileTab is not defined!');
            }
            
            // Highlight selected row
            qsa('.project-tree-row').forEach(r => r.classList.remove('selected'));
            row.classList.add('selected');
            console.log('[ProjectPanel] Row highlighted');
        }
    });

    // Checkbox changes
    wrapper.addEventListener('change', (e) => {
        if (e.target.classList.contains('project-checkbox')) {
            handleCheckboxChange(e);
        }
    });
}

/**
 * Handle checkbox state change
 */
function handleCheckboxChange(event) {
    const checkbox = event.target;
    const isChecked = checkbox.checked;
    const path = checkbox.dataset.path;
    
    if (isChecked) {
        excludedPaths.delete(path);
    } else {
        excludedPaths.add(path);
    }
    
    // Update children
    const li = checkbox.closest('.project-tree-li');
    if (li) {
        const childCheckboxes = li.querySelectorAll('.project-checkbox');
        childCheckboxes.forEach(child => {
            child.checked = isChecked;
            const childPath = child.dataset.path;
            if (isChecked) {
                excludedPaths.delete(childPath);
            } else {
                excludedPaths.add(childPath);
            }
        });
    }

    updateTokenCount();
    debouncedSaveState();
}

/**
 * Update token count summary
 */
function updateTokenCount() {
    const checkedFiles = qsa('.project-checkbox[data-type="file"]:checked');
    let total = 0;
    checkedFiles.forEach(box => {
        const tokens = parseInt(box.dataset.tokens || '0');
        total += tokens;
    });

    const countEl = getById('project-token-count');
    if (countEl) {
        countEl.textContent = `${formatNumber(total)} tokens`;
    }
}

/**
 * Handle copy selected files
 */
async function handleCopySelected() {
    const checkedBoxes = qsa('.project-checkbox[data-type="file"]:checked');
    const checkedPaths = [];
    
    checkedBoxes.forEach(box => {
        if (box.dataset.path) checkedPaths.push(box.dataset.path);
    });

    if (checkedPaths.length === 0) {
        showToast('No files selected', 'error');
        return;
    }

    const btn = getById('project-copy-selected-btn');
    if (btn) btn.disabled = true;

    try {
        const pathInput = getById('structure-path');
        const path = pathInput ? pathInput.value : '.';
        
        const content = await analyzeProject(path, checkedPaths);
        await copyToClipboard(content);
        
        showToast(`Copied ${checkedPaths.length} files to clipboard!`, 'success');
    } catch (err) {
        showToast('Copy error: ' + err.message, 'error');
    } finally {
        if (btn) btn.disabled = false;
    }
}

/**
 * Load saved tree state
 */
async function loadTreeState() {
    try {
        const data = await apiLoadTreeState();
        excludedPaths = new Set(data.excludedPaths || []);
    } catch (err) {
        console.error('[ProjectPanel] Failed to load tree state:', err);
        excludedPaths = new Set();
    }
}

/**
 * Debounced save state
 */
function debouncedSaveState() {
    if (saveStateTimeout) clearTimeout(saveStateTimeout);
    saveStateTimeout = setTimeout(() => {
        saveTreeState();
    }, 500);
}

/**
 * Save tree state
 */
async function saveTreeState() {
    try {
        const excludedArray = Array.from(excludedPaths);
        await apiSaveTreeState(excludedArray);
    } catch (err) {
        console.error('[ProjectPanel] Failed to save tree state:', err);
    }
}

// Export loadProjectTree wrapped with listener attachment
export { loadProjectTree };
