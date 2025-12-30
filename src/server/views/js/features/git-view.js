import { getById, qsa, showToast } from '../utils.js';
import { getGitDiff } from '../api.js';
import { Diff2HtmlUI } from 'diff2html/lib/ui/js/diff2html-ui';

let isGitMode = false;

/**
 * Initialize Git View (Diff Viewer Only)
 * This module only handles displaying git diffs in an overlay
 * Commit/Stage/Unstage features are in git-panel.js
 */
export function initGitView() {
    const toggleBtn = getById('git-view-toggle');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', toggleGitMode);
    }

    // Auto-close diff view when user switches to a tool panel
    document.addEventListener('tool-panel-opened', (event) => {
        console.log('[GitView] Tool panel opened:', event.detail.panelId);
        if (isGitMode) {
            console.log('[GitView] Auto-closing diff view due to panel switch');
            closeGitView();
        }
    });
}

/**
 * Toggle Git view overlay
 */
async function toggleGitMode() {
    const gitContainer = getById('git-view-container');
    const toggleBtn = getById('git-view-toggle');
    const toggleText = getById('git-toggle-text');

    isGitMode = !isGitMode;
    
    if (isGitMode) {
        gitContainer.classList.add('active');
        toggleBtn.classList.add('active');
        if (toggleText) toggleText.textContent = 'Close Diff';
        
        // Render simple diff viewer
        renderDiffViewer();
    } else {
        closeGitView();
    }
}

/**
 * Close Git view overlay
 */
function closeGitView() {
    const gitContainer = getById('git-view-container');
    const toggleBtn = getById('git-view-toggle');
    const toggleText = getById('git-toggle-text');
    
    isGitMode = false;
    gitContainer.classList.remove('active');
    toggleBtn.classList.remove('active');
    if (toggleText) toggleText.textContent = 'View Diff';
}

/**
 * Render diff viewer container
 */
function renderDiffViewer() {
    const container = getById('git-view-container');
    container.innerHTML = `
        <div class="git-diff-area" id="git-diff-viewer">
            <div class="git-empty-state">
                <div style="font-size: 48px; margin-bottom: 16px;">📄</div>
                <div style="font-size: 14px; color: #8b949e;">Select a file from Git panel to view changes</div>
            </div>
        </div>
    `;
}

/**
 * Load and display diff for a specific file
 * Called by git-panel.js when user clicks on a file
 */
async function loadDiffView(filePath, type) {
    const viewer = getById('git-diff-viewer');
    if (!viewer) {
        console.error('[GitView] Diff viewer not found');
        return;
    }
    
    viewer.innerHTML = '<div class="git-empty-state">Loading diff...</div>';
    
    // FIX: Using imported class
    const UIConstructor = Diff2HtmlUI;

    try {
        const diff = await getGitDiff(filePath, type === 'staged' ? 'staged' : 'working');
        
        if (!diff || !diff.trim()) {
            viewer.innerHTML = `
                <div class="git-empty-state">
                    <div style="font-size: 48px; margin-bottom: 16px;">📝</div>
                    <div style="font-size: 14px; color: #8b949e;">No text changes detected</div>
                    <div style="font-size: 12px; color: #6e7681; margin-top: 8px;">This might be a binary file or have no changes</div>
                </div>
            `;
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
        viewer.innerHTML = `
            <div class="git-empty-state" style="color:#f85149">
                <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
                <div style="font-size: 14px;">Error loading diff</div>
                <div style="font-size: 12px; margin-top: 8px;">${err.message}</div>
            </div>
        `;
    }
}

// Export loadDiffView as global function so git-panel can call it
window.loadGitDiffView = loadDiffView;
