import { getStructure, analyzeProject, copyToClipboard } from '../api.js';
import { showToast, showLoading, resetButton, showResponse, formatNumber, showCopiedState } from '../utils.js';

// Global variable to store current structure data
let currentStructureData = null;

/**
 * Handle Structure button click logic
 */
export async function handleStructureView(event) {
    const btn = event.target.closest('.btn');
    const pathInput = document.getElementById('structure-path');
    const treeContainer = document.getElementById('structure-tree');
    const treeContent = document.getElementById('tree-content');
    const errorContainer = document.getElementById('structure-response');
    
    const path = pathInput.value;

    showLoading(btn, btn.innerHTML);
    treeContainer.style.display = 'none';
    errorContainer.style.display = 'none';

    try {
        const data = await getStructure(path);
        currentStructureData = data.structure;

        // Render Tree HTML using recursive function
        treeContent.innerHTML = generateTreeHtml(data.structure);
        
        // Initial token update
        updateTotalTokens();
        
        treeContainer.style.display = 'block';
        showToast('Tải cấu trúc thành công', 'success');

    } catch (err) {
        showResponse('structure-response', { error: err.message }, true);
        showToast('Lỗi: ' + err.message, 'error');
    }
    
    resetButton(btn);
}

/**
 * Toggle folder collapse/expand
 * Only triggers if clicked on row but NOT on checkbox
 */
export function handleToggleFolder(event) {
    if (event.target.type === 'checkbox') return;

    // Find closest parent LI
    const li = event.currentTarget.closest('.tree-li');
    if (li && li.classList.contains('has-children')) {
        li.classList.toggle('collapsed');
    }
}

/**
 * Handle Checkbox Logic (Parent <-> Child sync) & Update Token Total
 */
export function handleCheckboxChange(event) {
    event.stopPropagation();
    const checkbox = event.target;
    const isChecked = checkbox.checked;
    
    // 1. Sync Children: If this is a folder, update all children checkboxes
    const li = checkbox.closest('.tree-li');
    if (li) {
        const childrenCheckboxes = li.querySelectorAll('.tree-checkbox');
        childrenCheckboxes.forEach(child => {
            child.checked = isChecked;
        });
    }

    // 2. Recalculate Tokens
    updateTotalTokens();
}

/**
 * Calculate total tokens of CHECKED files only
 */
function updateTotalTokens() {
    // Select all checked checkboxes that are FILES (have data-tokens)
    const checkedFiles = document.querySelectorAll('.tree-checkbox[data-type="file"]:checked');
    
    let total = 0;
    checkedFiles.forEach(box => {
        const tokens = parseInt(box.dataset.tokens || '0');
        total += tokens;
    });

    // Update Badge
    const badge = document.getElementById('total-tokens-badge');
    badge.textContent = `${formatNumber(total)} tokens`;
    
    // Optional: Visual styling if 0
    if (total === 0) {
        badge.style.color = 'var(--ios-gray)';
    } else {
        badge.style.color = ''; // reset to default
    }
}

/**
 * Copy Content of Selected Files (via API)
 */
export async function handleCopySelected(event) {
    const btn = event.target.closest('.btn-copy') || event.target.closest('.btn-icon-head');
    const icon = document.getElementById('copy-structure-icon') || btn; 
    const text = document.getElementById('copy-structure-text') || { textContent: '' }; 

    // 1. Get all checked FILE paths
    const checkedBoxes = document.querySelectorAll('.tree-checkbox[data-type="file"]:checked');
    const checkedPaths = [];
    
    checkedBoxes.forEach(box => {
        if (box.dataset.path) {
            checkedPaths.push(box.dataset.path);
        }
    });

    if (checkedPaths.length === 0) {
        showToast('Chưa chọn file nào', 'error');
        return;
    }

    // Save original button state
    const originalText = btn.innerHTML;
    if (btn.classList.contains('btn-copy')) {
        showLoading(btn, btn.innerHTML);
    } else {
        // For header icon, just show visual feedback
        btn.style.opacity = '0.5';
    }

    try {
        const path = document.getElementById('structure-path').value;
        
        // 2. Call Analyze API with specific files
        const content = await analyzeProject(path, checkedPaths);

        // 3. Copy to clipboard
        await copyToClipboard(content);

        // UI Feedback
        if (btn.classList.contains('btn-copy')) {
            showCopiedState(btn, icon, text, '📋', 'Copy Selected');
            resetButton(btn);
        } else {
            // Header icon feedback
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

/**
 * Recursive function to generate Tree HTML with Checkboxes
 */
function generateTreeHtml(node) {
    if (!node) return '';

    const isDir = node.type === 'directory';
    const hasChildren = isDir && node.children && node.children.length > 0;
    
    // Determine Token Color
    const tokens = node.tokens || 0;
    let tokenClass = 'token-low';
    if (tokens > 5000) tokenClass = 'token-high';
    else if (tokens > 2000) tokenClass = 'token-med';

    // Icon
    const icon = isDir ? (hasChildren ? '📁' : '📂') : '📄';
    const arrow = hasChildren ? '▼' : '';
    const liClass = `tree-li ${hasChildren ? 'has-children' : ''}`;
    
    // Actions
    // On click: Toggle if folder, Open Tab if file
    let clickAction = '';
    let cursorStyle = '';

    if (isDir) {
        if (hasChildren) {
            clickAction = 'onclick="toggleFolder(event)"';
            cursorStyle = 'cursor: pointer;';
        }
    } else {
        // File click -> Open in Editor
        // Escape backslashes for Windows paths
        const safePath = (node.relativePath || node.path).replace(/\\/g, '\\\\');
        clickAction = `onclick="window.openFileTab('${safePath}', '${node.name}')"`;
        cursorStyle = 'cursor: pointer; color: var(--text-primary);';
    }
    
    // Build HTML
    let html = `<li class="${liClass}">`;
    
    html += `
        <div class="tree-item-row" ${isDir ? clickAction : ''}>
            <span class="arrow">${arrow}</span>
            <input type="checkbox" class="tree-checkbox" 
                   data-path="${node.relativePath || node.path}" 
                   data-tokens="${tokens}"
                   data-type="${node.type}"
                   checked 
                   onclick="handleCheckboxChange(event)">
            <span class="tree-icon">${icon}</span>
            <span class="tree-name" style="${cursorStyle}" ${!isDir ? clickAction : ''}>${node.name}</span>
            <span class="token-badge ${tokenClass}">${formatNumber(tokens)}</span>
        </div>
    `;

    // Children recursion
    if (hasChildren) {
        html += '<ul class="tree-ul">';
        // Sort: Folders first, then files
        node.children.forEach(child => {
            html += generateTreeHtml(child);
        });
        html += '</ul>';
    }

    html += '</li>';
    
    return isDir ? `<ul class="tree-ul">${html}</ul>` : html; 
}
