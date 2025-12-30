import { getGitStatus, getGitDiff, stageFile, unstageFile, commitChanges, discardChange, gitPush } from '../api.js';
 import { showToast, getById, qsa } from '../utils.js';

let currentStaged = [];
let currentChanges = [];
let isInitialized = false;

/**
 * Initialize Git Panel
 */
export function initGitPanel() {
    // Listen for panel open events
    document.addEventListener('tool-panel-opened', (event) => {
        if (event.detail.panelId === 'git') {
            if (!isInitialized) {
                renderGitPanel();
                isInitialized = true;
            }
            loadGitData();
        }
    });

    // Listen for project switched to reload git data
    window.addEventListener('project-switched', (e) => {
        console.log('[GitPanel] 🔄 Project switched event detected:', e.detail);
        
        // Wait a bit for backend to switch project context
        setTimeout(() => {
            // Reload git data for new project if panel has been rendered
            const gitPanelContent = getById('git-panel-content');
            if (gitPanelContent && gitPanelContent.innerHTML.trim() !== '') {
                console.log('[GitPanel] ✅ Git panel is visible, reloading git data for new project...');
                loadGitData();
            } else {
                console.log('[GitPanel] ⏭️ Git panel not rendered yet, will load when opened');
            }
        }, 200); // Small delay to ensure backend has switched context
    });

    // Listen for refresh button in panel header
    const refreshBtn = getById('git-panel-refresh-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', loadGitData);
    }

    console.log('[GitPanel] Initialized');
}

/**
 * Render Git Panel UI structure
 */
function renderGitPanel() {
    const container = getById('git-panel-content');
    if (!container) return;

    container.innerHTML = `
        <div class="git-panel-commit-section">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                <span style="font-size:11px;font-weight:bold;color:#8b949e;text-transform:uppercase;">Commit</span>
                <button id="git-panel-push-btn" class="git-panel-push-btn" title="Push to remote">
                    ↑ Push
                </button>
            </div>
            <textarea id="git-panel-commit-message" class="git-panel-commit-input" placeholder="Commit message (Ctrl+Enter to commit)" rows="2"></textarea>
            <button id="git-panel-commit-btn" class="git-panel-commit-btn">
                <span>✓</span> Commit
            </button>
        </div>
        <div>
            <div class="git-panel-section-header">
                <div style="display:flex;align-items:center;gap:6px;">
                    <span>Staged Changes</span>
                    <span class="git-panel-badge" id="git-panel-badge-staged">0</span>
                </div>
                <div class="git-panel-section-actions">
                    <button class="git-panel-section-action-btn" id="git-panel-unstage-all" title="Unstage All" style="display:none;">−</button>
                </div>
            </div>
            <ul class="git-panel-tree" id="git-panel-tree-staged"></ul>
        </div>
        <div>
            <div class="git-panel-section-header">
                <div style="display:flex;align-items:center;gap:6px;">
                    <span>Changes</span>
                    <span class="git-panel-badge" id="git-panel-badge-changes">0</span>
                </div>
                <div class="git-panel-section-actions">
                    <button class="git-panel-section-action-btn destructive" id="git-panel-discard-all" title="Discard All" style="display:none;">↺</button>
                    <button class="git-panel-section-action-btn" id="git-panel-stage-all" title="Stage All" style="display:none;">+</button>
                </div>
            </div>
            <ul class="git-panel-tree" id="git-panel-tree-changes"></ul>
        </div>
    `;

    // Attach event listeners
    setTimeout(() => {
        const stageAllBtn = getById('git-panel-stage-all');
        const unstageAllBtn = getById('git-panel-unstage-all');
        const discardAllBtn = getById('git-panel-discard-all');
        const commitBtn = getById('git-panel-commit-btn');
        const pushBtn = getById('git-panel-push-btn');
        const commitInput = getById('git-panel-commit-message');

        if (stageAllBtn) stageAllBtn.addEventListener('click', () => handleStage('*'));
        if (unstageAllBtn) unstageAllBtn.addEventListener('click', () => handleUnstage('*'));
        if (discardAllBtn) discardAllBtn.addEventListener('click', () => handleDiscard('*'));
        if (commitBtn) commitBtn.addEventListener('click', handleCommit);
        if (pushBtn) pushBtn.addEventListener('click', handlePush);
        
        if (commitInput) {
            commitInput.addEventListener('keydown', (e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                    e.preventDefault();
                    handleCommit();
                }
            });
        }
    }, 0);
}

/**
 * Load Git data
 */
export async function loadGitData() {
    const stagedTree = getById('git-panel-tree-staged');
    const changesTree = getById('git-panel-tree-changes');

    if (stagedTree) stagedTree.innerHTML = '<li class="git-panel-loading">Loading...</li>';
    if (changesTree) changesTree.innerHTML = '<li class="git-panel-loading">Loading...</li>';

    try {
        const { staged, changes } = await getGitStatus();
        currentStaged = staged;
        currentChanges = changes;
        renderTrees();
    } catch (err) {
        if (stagedTree) stagedTree.innerHTML = '';
        if (changesTree) changesTree.innerHTML = `<li class="git-panel-empty">Error: ${err.message}</li>`;
        showToast('Error loading git status: ' + err.message, 'error');
    }
}

/**
 * Render trees
 */
function renderTrees() {
    const stagedTree = getById('git-panel-tree-staged');
    const stagedBadge = getById('git-panel-badge-staged');
    const unstageAllBtn = getById('git-panel-unstage-all');

    if (stagedBadge) stagedBadge.textContent = currentStaged.length;
    if (unstageAllBtn) unstageAllBtn.style.display = currentStaged.length > 0 ? 'block' : 'none';
    
    if (stagedTree) {
        stagedTree.innerHTML = '';
        if (currentStaged.length > 0) {
            const root = buildFileTree(currentStaged);
            renderTreeNodes(root, stagedTree, 'staged', 0);
        } else {
            stagedTree.innerHTML = '<li class="git-panel-empty">No staged changes</li>';
        }
    }

    const changesTree = getById('git-panel-tree-changes');
    const changesBadge = getById('git-panel-badge-changes');
    const stageAllBtn = getById('git-panel-stage-all');
    const discardAllBtn = getById('git-panel-discard-all');

    if (changesBadge) changesBadge.textContent = currentChanges.length;
    if (stageAllBtn) stageAllBtn.style.display = currentChanges.length > 0 ? 'block' : 'none';
    if (discardAllBtn) discardAllBtn.style.display = currentChanges.length > 0 ? 'block' : 'none';
    
    if (changesTree) {
        changesTree.innerHTML = '';
        if (currentChanges.length > 0) {
            const root = buildFileTree(currentChanges);
            renderTreeNodes(root, changesTree, 'changes', 0);
        } else {
            changesTree.innerHTML = '<li class="git-panel-empty">No changes</li>';
        }
    }
}

/**
 * Build file tree from flat list
 */
function buildFileTree(files) {
    const root = {};
    files.forEach(file => {
        const parts = file.path.split('/');
        let current = root;
        parts.forEach((part, index) => {
            if (!current[part]) {
                current[part] = { name: part, children: {}, fileData: null };
            }
            if (index === parts.length - 1) {
                current[part].fileData = file;
            }
            current = current[part].children;
        });
    });
    return root;
}

/**
 * Render tree nodes
 */
function renderTreeNodes(nodes, container, type, depth) {
    const items = Object.values(nodes);
    items.sort((a, b) => {
        const aIsFolder = Object.keys(a.children).length > 0;
        const bIsFolder = Object.keys(b.children).length > 0;
        if (aIsFolder && !bIsFolder) return -1;
        if (!aIsFolder && bIsFolder) return 1;
        return a.name.localeCompare(b.name);
    });

    items.forEach(node => {
        const isFolder = Object.keys(node.children).length > 0;
        const li = document.createElement('li');
        li.className = 'git-panel-tree-node';

        const content = document.createElement('div');
        content.className = 'git-panel-tree-content';
        content.style.paddingLeft = (depth * 16 + 8) + 'px';

        const arrow = document.createElement('span');
        arrow.className = 'git-panel-arrow';
        arrow.textContent = isFolder ? '▼' : '';
        content.appendChild(arrow);

        const iconSpan = document.createElement('span');
        iconSpan.className = 'git-panel-icon';
        if (isFolder) {
            iconSpan.textContent = '📂';
        } else {
            const status = node.fileData.status;
            iconSpan.textContent = getStatusIcon(status);
            iconSpan.className += ' git-status-' + status;
        }
        content.appendChild(iconSpan);

        const label = document.createElement('span');
        label.className = isFolder ? 'git-panel-label git-panel-dir-label' : 'git-panel-label git-panel-file-label';
        label.textContent = node.name;
        content.appendChild(label);

        if (!isFolder && node.fileData) {
            const actions = document.createElement('div');
            actions.className = 'git-panel-actions';
            
            if (type === 'changes') {
                const discardBtn = document.createElement('button');
                discardBtn.className = 'git-panel-btn-action destructive';
                discardBtn.textContent = '↺';
                discardBtn.title = 'Discard';
                discardBtn.onclick = (e) => { e.stopPropagation(); handleDiscard(node.fileData.path); };
                actions.appendChild(discardBtn);
            }

            const btn = document.createElement('button');
            btn.className = 'git-panel-btn-action';
            if (type === 'staged') {
                btn.textContent = '−';
                btn.title = 'Unstage';
                btn.onclick = (e) => { e.stopPropagation(); handleUnstage(node.fileData.path); };
            } else {
                btn.textContent = '+';
                btn.title = 'Stage';
                btn.onclick = (e) => { e.stopPropagation(); handleStage(node.fileData.path); };
            }
            actions.appendChild(btn);
            content.appendChild(actions);
        }

        content.addEventListener('click', (e) => {
            e.stopPropagation();
            if (isFolder) {
                console.log('[GitPanel] Toggling folder');
                li.classList.toggle('collapsed');
            } else {
                console.log('[GitPanel] 🔥 FILE CLICKED:', node.fileData.path, 'Type:', type);
                qsa('.git-panel-tree-content').forEach(el => el.classList.remove('selected'));
                content.classList.add('selected');
                console.log('[GitPanel] File selected, attempting to open diff view');
                
                // Open file diff in the existing Git view overlay
                if (node.fileData) {
                    console.log('[GitPanel] Calling openGitDiffView with:', {
                        path: node.fileData.path,
                        type: type
                    });
                    openGitDiffView(node.fileData.path, type);
                } else {
                    console.error('[GitPanel] No fileData found for node!');
                }
            }
        });

        li.appendChild(content);

        if (isFolder) {
            const ul = document.createElement('ul');
            renderTreeNodes(node.children, ul, type, depth + 1);
            li.appendChild(ul);
        }

        container.appendChild(li);
    });
}

/**
 * Get status icon
 */
function getStatusIcon(status) {
    if (status === 'M') return 'M';
    if (status === 'A' || status === 'U') return 'U';
    if (status === 'D') return 'D';
    if (status === 'R') return 'R';
    return '?';
}

/**
 * Handle stage
 */
async function handleStage(path) {
    try {
        await stageFile(path);
        await loadGitData();
        showToast(path === '*' ? 'All changes staged' : 'File staged', 'success');
    } catch (err) {
        showToast('Stage failed: ' + err.message, 'error');
    }
}

/**
 * Handle unstage
 */
async function handleUnstage(path) {
    try {
        await unstageFile(path);
        await loadGitData();
        showToast(path === '*' ? 'All changes unstaged' : 'File unstaged', 'success');
    } catch (err) {
        showToast('Unstage failed: ' + err.message, 'error');
    }
}

/**
 * Handle discard
 */
async function handleDiscard(path) {
    const isAll = path === '*';
    const msg = isAll
        ? 'Discard ALL changes? This is irreversible!'
        : `Discard changes to ${path}? This is irreversible!`;

    if (confirm(msg)) {
        try {
            await discardChange(path);
            await loadGitData();
            showToast('Changes discarded', 'success');
        } catch (err) {
            showToast('Discard failed: ' + err.message, 'error');
        }
    }
}

/**
 * Handle commit
 */
async function handleCommit() {
    const input = getById('git-panel-commit-message');
    const message = input ? input.value.trim() : '';
    const btn = getById('git-panel-commit-btn');

    if (!message) {
        showToast('Please enter a commit message', 'error');
        if (input) input.focus();
        return;
    }

    if (currentStaged.length === 0) {
        showToast('Nothing to commit. Stage changes first.', 'error');
        return;
    }

    if (btn) btn.disabled = true;
    if (btn) btn.innerHTML = '<span>...</span> Committing...';

    try {
        await commitChanges(message);
        showToast('Commit successful', 'success');
        if (input) input.value = '';
        await loadGitData();
    } catch (err) {
        showToast('Commit failed: ' + err.message, 'error');
    } finally {
        if (btn) btn.disabled = false;
        if (btn) btn.innerHTML = '<span>✓</span> Commit';
    }
}

/**
 * Open Git diff view in the overlay (uses existing git-view.js functionality)
 */
async function openGitDiffView(filePath, type) {
    console.log('[GitPanel] 🔥 openGitDiffView called with:', { filePath, type });
    
    // Strategy: Directly trigger the Git view overlay, then call loadDiffView
    const gitToggleBtn = getById('git-view-toggle');
    const gitViewContainer = getById('git-view-container');
    
    console.log('[GitPanel] Git view elements:', {
        toggleBtn: !!gitToggleBtn,
        container: !!gitViewContainer,
        containerActive: gitViewContainer?.classList.contains('active')
    });
    
    // Activate Git view overlay if not active
    if (gitViewContainer && !gitViewContainer.classList.contains('active')) {
        console.log('[GitPanel] Activating Git view overlay...');
        if (gitToggleBtn) {
            gitToggleBtn.click();
        } else {
            console.error('[GitPanel] Git toggle button not found!');
            return;
        }
    }
    
    // Wait for Git view to load, then trigger diff
    // setTimeout(() => {
        console.log('[GitPanel] Attempting to load diff view for:', filePath);
        
        // Check if global loadGitDiffView function exists (from git-view.js)
        if (typeof window.loadGitDiffView === 'function') {
            console.log('[GitPanel] ✅ Calling window.loadGitDiffView');
            window.loadGitDiffView(filePath, type);
        } else {
            console.error('[GitPanel] ❌ window.loadGitDiffView not available');
            console.log('[GitPanel] Available window functions:', Object.keys(window).filter(k => k.includes('git') || k.includes('diff')));
            
            // Fallback: Try to find and click the file in the tree manually
            // But Git view doesn't use data-path, it stores path in closure
            // So we need to trigger via the global function
            showToast('Git diff view not available. Please use the Git button in tabs header.', 'warning');
        }
    // }, 400);
}



