import { getStructure, analyzeProject, copyToClipboard, saveTreeState as apiSaveTreeState, loadTreeState as apiLoadTreeState } from '../api.js';
import { showToast, showLoading, resetButton, showResponse, formatNumber, showCopiedState, getById, qsa } from '../utils.js';

let currentStructureData = null;
let excludedPaths = new Set();
let saveStateTimeout = null;

// Exported function for Handler
export async function handleStructureView(event) {
    const btn = event.target.closest('.btn');
    const pathInput = getById('structure-path');
    const treeContainer = getById('structure-tree');
    const treeContent = getById('tree-content');
    const errorContainer = getById('structure-response');
    
    if (!pathInput || !treeContainer || !treeContent || !errorContainer) {
        console.error('Structure elements not found');
        return;
    }

    const path = pathInput.value;

    showLoading(btn, btn.innerHTML);
    treeContainer.style.display = 'none';
    errorContainer.style.display = 'none';

    try {
        const data = await getStructure(path);
        currentStructureData = data.structure;

        await loadTreeState();

        treeContent.innerHTML = generateTreeHtml(data.structure);
        
        updateTotalTokens();
        
        treeContainer.style.display = 'block';
        showToast('Tải cấu trúc thành công', 'success');

    } catch (err) {
        showResponse('structure-response', { error: err.message }, true);
        showToast('Lỗi: ' + err.message, 'error');
    }
    
    resetButton(btn);
}

export function handleToggleFolder(event) {
    if (event.target.type === 'checkbox') return;
    const li = event.currentTarget.closest('.tree-li');
    if (li && li.classList.contains('has-children')) {
        li.classList.toggle('collapsed');
    }
}

export function handleCheckboxChange(event) {
    event.stopPropagation();
    const checkbox = event.target;
    const isChecked = checkbox.checked;
    const path = checkbox.dataset.path;
    
    if (isChecked) {
        excludedPaths.delete(path);
    } else {
        excludedPaths.add(path);
    }
    
    const li = checkbox.closest('.tree-li');
    if (li) {
        const childrenCheckboxes = li.querySelectorAll('.tree-checkbox');
        childrenCheckboxes.forEach(child => {
            child.checked = isChecked;
            const childPath = child.dataset.path;
            if (isChecked) {
                excludedPaths.delete(childPath);
            } else {
                excludedPaths.add(childPath);
            }
        });
    }

    updateTotalTokens();
    debouncedSaveState();
}

function updateTotalTokens() {
    const checkedFiles = qsa('.tree-checkbox[data-type="file"]:checked');
    let total = 0;
    checkedFiles.forEach(box => {
        const tokens = parseInt(box.dataset.tokens || '0');
        total += tokens;
    });

    const badge = getById('total-tokens-badge');
    if (badge) {
        badge.textContent = `${formatNumber(total)} tokens`;
        if (total === 0) {
            badge.style.color = 'var(--ios-gray)';
        } else {
            badge.style.color = '';
        }
    }
}

export async function handleCopySelected(event) {
    const btn = event.target.closest('.btn-copy') || event.target.closest('.btn-icon-head');
    const icon = getById('copy-structure-icon') || btn; 
    const text = getById('copy-structure-text') || { textContent: '' }; 

    const checkedBoxes = qsa('.tree-checkbox[data-type="file"]:checked');
    const checkedPaths = [];
    
    checkedBoxes.forEach(box => {
        if (box.dataset.path) checkedPaths.push(box.dataset.path);
    });

    if (checkedPaths.length === 0) {
        showToast('Chưa chọn file nào', 'error');
        return;
    }

    if (btn.classList.contains('btn-copy')) {
        showLoading(btn, btn.innerHTML);
    } else {
        btn.style.opacity = '0.5';
    }

    try {
        const pathInput = getById('structure-path');
        const path = pathInput ? pathInput.value : '.';
        
        const content = await analyzeProject(path, checkedPaths);
        await copyToClipboard(content);

        if (btn.classList.contains('btn-copy')) {
            showCopiedState(btn, icon, text, '📋', 'Copy Selected');
            resetButton(btn);
        } else {
            btn.style.opacity = '1';
            const originalIcon = btn.textContent;
            btn.textContent = '✓';
            setTimeout(() => btn.textContent = originalIcon, 2000);
        }
        
        showToast(`Đã copy nội dung ${checkedPaths.length} file!`, 'success');

    } catch (err) {
        resetButton(btn);
        if (!btn.classList.contains('btn-copy')) btn.style.opacity = '1';
        showToast('Lỗi copy: ' + err.message, 'error');
    }
}

function generateTreeHtml(node) {
    if (!node) return '';

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
    
    let tokenClass = 'token-low';
    if (tokens > 5000) tokenClass = 'token-high';
    else if (tokens > 2000) tokenClass = 'token-med';

    const icon = isDir ? (hasChildren ? '📁' : '📂') : '📄';
    const arrow = hasChildren ? '▼' : '';
    const liClass = `tree-li ${hasChildren ? 'has-children' : ''}`;
    
    let clickAction = '';
    let cursorStyle = '';

    if (isDir) {
        if (hasChildren) {
            clickAction = 'onclick="toggleFolder(event)"';
            cursorStyle = 'cursor: pointer;';
        }
    } else {
        const safePath = (currentNode.relativePath || currentNode.path).replace(/\\/g, '\\\\');
        clickAction = `onclick="window.openFileTab('${safePath}', '${currentNode.name}')"`;
        cursorStyle = 'cursor: pointer; color: var(--text-primary);';
    }
    
    let html = `<li class="${liClass}">`;
    
    const nodePath = currentNode.relativePath || currentNode.path;
    const isExcluded = excludedPaths.has(nodePath);
    
    html += `
        <div class="tree-item-row" ${isDir ? clickAction : ''}>
            <span class="arrow">${arrow}</span>
            <input type="checkbox" class="tree-checkbox" 
                   data-path="${nodePath}" 
                   data-tokens="${tokens}"
                   data-type="${currentNode.type}"
                   ${isExcluded ? '' : 'checked'} 
                   onclick="handleCheckboxChange(event)">
            <span class="tree-icon">${icon}</span>
            <span class="tree-name" style="${cursorStyle}" ${!isDir ? clickAction : ''} title="${displayName}">${displayName}</span>
            <span class="token-badge ${tokenClass}">${formatNumber(tokens)}</span>
        </div>
    `;

    if (hasChildren) {
        html += '<ul class="tree-ul">';
        currentNode.children.forEach(child => {
            html += generateTreeHtml(child);
        });
        html += '</ul>';
    }

    html += '</li>';
    return isDir ? `<ul class="tree-ul">${html}</ul>` : html; 
}

async function loadTreeState() {
    try {
        const data = await apiLoadTreeState();
        excludedPaths = new Set(data.excludedPaths || []);
    } catch (err) {
        console.error('Failed to load tree state:', err);
        excludedPaths = new Set();
    }
}

function debouncedSaveState() {
    if (saveStateTimeout) clearTimeout(saveStateTimeout);
    saveStateTimeout = setTimeout(() => {
        saveTreeState();
    }, 500);
}

async function saveTreeState() {
    try {
        const excludedArray = Array.from(excludedPaths);
        await apiSaveTreeState(excludedArray);
    } catch (err) {
        console.error('Failed to save tree state:', err);
    }
}

// FIX: Expose functions to window so HTML onclick works
window.testStructure = handleStructureView;
window.toggleFolder = handleToggleFolder;
window.handleCheckboxChange = handleCheckboxChange;
window.copySelectedStructure = handleCopySelected;
