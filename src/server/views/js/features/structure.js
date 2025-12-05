import { getStructure } from '../api.js';
import { showToast, showLoading, resetButton, showResponse, formatNumber } from '../utils.js';

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
        
        // Render Token Badge for Total
        const totalTokens = data.rootTokens || 0;
        document.getElementById('total-tokens-badge').textContent = `${formatNumber(totalTokens)} tokens`;
        
        // Render Tree HTML using recursive function
        treeContent.innerHTML = generateTreeHtml(data.structure);
        
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
 */
export function handleToggleFolder(event) {
    // Find closest parent LI
    const li = event.currentTarget.closest('.tree-li');
    if (li && li.classList.contains('has-children')) {
        li.classList.toggle('collapsed');
    }
}

/**
 * Recursive function to generate Tree HTML
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
    
    // Build HTML
    let html = `<li class="${liClass}">`;
    
    // Row content (Clickable for folders)
    // Note: onclick is global, so we use the window.toggleFolder reference
    const clickAttr = hasChildren ? 'onclick="toggleFolder(event)"' : '';
    
    html += `
        <div class="tree-item-row" ${clickAttr}>
            <span class="arrow">${arrow}</span>
            <span class="tree-icon">${icon}</span>
            <span class="tree-name">${node.name}</span>
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
    
    // Wrapper for root node to ensure proper UL structure
    return isDir ? `<ul class="tree-ul">${html}</ul>` : html; 
}
