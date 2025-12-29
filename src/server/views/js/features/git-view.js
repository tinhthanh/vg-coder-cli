import { getGitStatus, getGitDiff, stageFile, unstageFile, commitChanges, discardChange } from '../api.js';
import { showToast, getById, qsa } from '../utils.js';
// FIX: Import Diff2HtmlUI from npm package
import { Diff2HtmlUI } from 'diff2html/lib/ui/js/diff2html-ui';

let isGitMode = false;
let currentStaged = [];
let currentChanges = [];

export function initGitView() {
    const toggleBtn = getById('git-view-toggle');
    const refreshBtn = getById('git-refresh-btn');
    
    if (toggleBtn) toggleBtn.addEventListener('click', toggleGitMode);
    if (refreshBtn) refreshBtn.addEventListener('click', loadGitData);
}

async function toggleGitMode() {
    const gitContainer = getById('git-view-container');
    const toggleBtn = getById('git-view-toggle');
    const refreshBtn = getById('git-refresh-btn');
    const toggleText = getById('git-toggle-text');

    isGitMode = !isGitMode;

    if (isGitMode) {
        gitContainer.classList.add('active');
        toggleBtn.classList.add('active');
        if (toggleText) toggleText.textContent = 'Close Changes';
        if (refreshBtn) refreshBtn.style.display = 'flex';
        await loadGitData();
    } else {
        gitContainer.classList.remove('active');
        toggleBtn.classList.remove('active');
        if (toggleText) toggleText.textContent = 'View Changes';
        if (refreshBtn) refreshBtn.style.display = 'none';
    }
}

async function loadGitData() {
    const container = getById('git-view-container');
    
    if (!container.querySelector('.git-sidebar')) {
        container.innerHTML = `
            <div class="git-sidebar">
                <div class="git-commit-section">
                    <textarea id="git-commit-message" class="git-commit-input" placeholder="Message (⌘Enter to commit)" rows="1"></textarea>
                    <button id="git-commit-btn" class="git-commit-btn">
                        <span>✓</span> Commit
                    </button>
                </div>
                <div class="git-section">
                    <div class="git-section-header" id="header-staged">
                        <div style="display:flex;align-items:center;gap:5px;">
                            <span>STAGED CHANGES</span>
                            <span class="git-badge" id="badge-staged">0</span>
                        </div>
                        <span class="git-btn-action" id="unstage-all" title="Unstage All" style="display:none;">-</span>
                    </div>
                    <ul class="git-tree-root" id="tree-staged"></ul>
                </div>
                <div class="git-section">
                    <div class="git-section-header" id="header-changes">
                        <div style="display:flex;align-items:center;gap:5px;">
                            <span>CHANGES</span>
                            <span class="git-badge" id="badge-changes">0</span>
                        </div>
                        <div style="display:flex;gap:5px;">
                            <span class="git-btn-action destructive" id="discard-all" title="Discard All Changes">↺</span>
                            <span class="git-btn-action" id="stage-all" title="Stage All">+</span>
                        </div>
                    </div>
                    <ul class="git-tree-root" id="tree-changes"></ul>
                </div>
            </div>
            <div class="git-diff-area" id="git-diff-viewer">
                <div class="git-empty-state">Select a file to view changes</div>
            </div>
        `;
        
        setTimeout(() => {
            const stageAll = getById('stage-all');
            const unstageAll = getById('unstage-all');
            const discardAll = getById('discard-all');
            const commitBtn = getById('git-commit-btn');
            const commitInput = getById('git-commit-message');

            if(stageAll) stageAll.addEventListener('click', async (e) => { e.stopPropagation(); await handleStage('*'); });
            if(unstageAll) unstageAll.addEventListener('click', async (e) => { e.stopPropagation(); await handleUnstage('*'); });
            if(discardAll) discardAll.addEventListener('click', async (e) => { e.stopPropagation(); await handleDiscard('*'); });
            
            if(commitBtn) commitBtn.addEventListener('click', handleCommit);
            if(commitInput) commitInput.addEventListener('keydown', (e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                    e.preventDefault();
                    handleCommit();
                }
            });
        }, 0);
    }

    const refreshBtn = getById('git-refresh-btn');
    if(refreshBtn) refreshBtn.disabled = true;

    try {
        const { staged, changes } = await getGitStatus();
        currentStaged = staged;
        currentChanges = changes;
        renderTrees();
    } catch (err) {
        showToast('Error loading git status: ' + err.message, 'error');
    } finally {
        if(refreshBtn) refreshBtn.disabled = false;
    }
}

async function handleCommit() {
    const input = getById('git-commit-message');
    const message = input.value.trim();
    const btn = getById('git-commit-btn');

    if (!message) {
        showToast('Please enter a commit message', 'error');
        input.focus();
        return;
    }

    if (currentStaged.length === 0) {
        showToast('Nothing to commit. Stage changes first.', 'error');
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<span>...</span> Committing...';

    try {
        await commitChanges(message);
        showToast('Commit successful', 'success');
        input.value = '';
        await loadGitData();
    } catch (err) {
        showToast('Commit failed: ' + err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<span>✓</span> Commit';
    }
}

function renderTrees() {
    const treeStaged = getById('tree-staged');
    const badgeStaged = getById('badge-staged');
    const unstageAll = getById('unstage-all');
    
    if (badgeStaged) badgeStaged.textContent = currentStaged.length;
    if (unstageAll) unstageAll.style.display = currentStaged.length > 0 ? 'block' : 'none';
    if (treeStaged) {
        treeStaged.innerHTML = '';
        if (currentStaged.length > 0) {
            const rootStaged = buildFileTree(currentStaged);
            renderTreeNodes(rootStaged, treeStaged, 'staged', 0);
        }
    }

    const treeChanges = getById('tree-changes');
    const badgeChanges = getById('badge-changes');
    const discardAll = getById('discard-all');

    if (badgeChanges) badgeChanges.textContent = currentChanges.length;
    if (discardAll) discardAll.style.display = currentChanges.length > 0 ? 'block' : 'none';
    if (treeChanges) {
        treeChanges.innerHTML = '';
        if (currentChanges.length > 0) {
            const rootChanges = buildFileTree(currentChanges);
            renderTreeNodes(rootChanges, treeChanges, 'changes', 0);
        }
    }
}

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
        li.className = 'git-tree-node';

        const content = document.createElement('div');
        content.className = 'git-tree-content';
        content.style.paddingLeft = (depth * 16 + 8) + 'px';

        const arrow = document.createElement('span');
        arrow.className = 'git-arrow';
        arrow.textContent = isFolder ? '▼' : '';
        content.appendChild(arrow);

        const iconSpan = document.createElement('span');
        iconSpan.className = 'git-icon';
        if (isFolder) {
            iconSpan.textContent = '📂';
        } else {
            const status = node.fileData.status;
            iconSpan.textContent = getStatusIcon(status);
            iconSpan.className += ' git-status-' + status;
        }
        content.appendChild(iconSpan);

        const label = document.createElement('span');
        label.className = isFolder ? 'git-label git-dir-label' : 'git-label git-file-label';
        label.textContent = node.name;
        content.appendChild(label);

        if (!isFolder && node.fileData) {
            const actions = document.createElement('div');
            actions.className = 'git-actions';
            
            if (type === 'changes') {
                const discardBtn = document.createElement('button');
                discardBtn.className = 'git-btn-action destructive';
                discardBtn.textContent = '↺';
                discardBtn.title = 'Discard Changes';
                discardBtn.onclick = (e) => { e.stopPropagation(); handleDiscard(node.fileData.path); };
                actions.appendChild(discardBtn);
            }

            const btn = document.createElement('button');
            btn.className = 'git-btn-action';
            if (type === 'staged') {
                btn.textContent = '-';
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
                li.classList.toggle('collapsed');
            } else {
                qsa('.git-tree-content').forEach(el => el.classList.remove('selected'));
                content.classList.add('selected');
                loadDiffView(node.fileData.path, type);
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

function getStatusIcon(status) {
    if(status === 'M') return 'M';
    if(status === 'A' || status === 'U') return 'U';
    if(status === 'D') return 'D';
    if(status === 'R') return 'R';
    return '?';
}

async function handleStage(path) {
    try {
        await stageFile(path);
        await loadGitData();
    } catch (err) {
        showToast('Stage failed: ' + err.message, 'error');
    }
}

async function handleUnstage(path) {
    try {
        await unstageFile(path);
        await loadGitData();
    } catch (err) {
        showToast('Unstage failed: ' + err.message, 'error');
    }
}

async function handleDiscard(path) {
    const isAll = path === '*';
    const msg = isAll 
        ? 'Are you sure you want to discard ALL changes? This is irreversible!' 
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

async function loadDiffView(filePath, type) {
    const viewer = getById('git-diff-viewer');
    viewer.innerHTML = '<div class="git-empty-state">Loading diff...</div>';
    
    // FIX: Using imported class
    const UIConstructor = Diff2HtmlUI;

    try {
        const diff = await getGitDiff(filePath, type === 'staged' ? 'staged' : 'working');
        
        if (!diff || !diff.trim()) {
             viewer.innerHTML = '<div class="git-empty-state">No text changes detected (binary file?)</div>';
             return;
        }

        viewer.innerHTML = '';
        const ui = new UIConstructor(viewer, diff, {
            drawFileList: false,
            matching: 'lines',
            outputFormat: 'side-by-side',
            synchronisedScroll: true,
            highlight: true,
            renderNothingWhenEmpty: false,
            colorScheme: 'dark'
        });
        ui.draw();
        ui.highlightCode();

    } catch (err) {
        viewer.innerHTML = `<div class="git-empty-state" style="color:#f85149">Error loading diff: ${err.message}</div>`;
    }
}
