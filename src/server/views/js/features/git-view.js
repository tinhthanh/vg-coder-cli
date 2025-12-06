import { getGitDiff } from '../api.js';
import { showToast, showLoading } from '../utils.js';

export function initGitView() {
    console.log('[GitView] Initializing...');
    const toggleBtn = document.getElementById('git-view-toggle');
    const refreshBtn = document.getElementById('git-refresh-btn');
    
    if (toggleBtn) toggleBtn.addEventListener('click', toggleGitMode);
    if (refreshBtn) refreshBtn.addEventListener('click', loadGitChanges);
}

let isGitMode = false;

async function toggleGitMode() {
    const gitContainer = document.getElementById('git-view-container');
    const toggleBtn = document.getElementById('git-view-toggle');
    const refreshBtn = document.getElementById('git-refresh-btn');
    const toggleText = document.getElementById('git-toggle-text');

    isGitMode = !isGitMode;
    console.log('[GitView] Toggle Mode:', isGitMode);

    if (isGitMode) {
        gitContainer.classList.add('active');
        toggleBtn.classList.add('active');
        if (toggleText) toggleText.textContent = 'Close Changes';
        if (refreshBtn) refreshBtn.style.display = 'flex';
        
        // Debug kích thước container
        const rect = gitContainer.getBoundingClientRect();
        console.log('[GitView] Container Size:', rect.width, 'x', rect.height);

        if (!gitContainer.innerHTML.trim()) {
            await loadGitChanges();
        }
    } else {
        gitContainer.classList.remove('active');
        toggleBtn.classList.remove('active');
        if (toggleText) toggleText.textContent = 'View Changes';
        if (refreshBtn) refreshBtn.style.display = 'none';
    }
}

async function loadGitChanges() {
    const gitContainer = document.getElementById('git-view-container');
    const refreshBtn = document.getElementById('git-refresh-btn');
    
    console.log('[GitView] Loading changes...');
    
    if (refreshBtn) {
        refreshBtn.style.opacity = '0.5';
        refreshBtn.disabled = true;
    }
    
    gitContainer.innerHTML = '<div class="git-loading-msg">Loading git changes... (Check Console if stuck)</div>';

    try {
        // Kiểm tra thư viện
        if (typeof Diff2HtmlUI === 'undefined') {
            throw new Error('Thư viện Diff2HtmlUI chưa được load!');
        }
        if (typeof hljs === 'undefined') {
            console.warn('⚠️ Highlight.js chưa được load!');
        }

        const diffString = await getGitDiff();
        console.log('[GitView] Diff received, length:', diffString?.length);

        if (!diffString || !diffString.trim()) {
            gitContainer.innerHTML = `
                <div class="git-loading-msg">
                    <div style="font-size:30px;">✨</div>
                    <p>No changes detected</p>
                </div>`;
        } else {
            console.log('[GitView] Rendering diff...');
            
            // Cấu hình Diff2Html
            const configuration = {
                drawFileList: true,
                fileListToggle: false,
                fileListStartVisible: true,
                fileContentToggle: false,
                matching: 'lines',
                outputFormat: 'side-by-side',
                synchronisedScroll: true,
                highlight: true,
                renderNothingWhenEmpty: true,
                colorScheme: 'dark' // Ép buộc Dark Mode từ thư viện
            };
            
            gitContainer.innerHTML = ''; // Clear loading
            
            const diff2htmlUi = new Diff2HtmlUI(gitContainer, diffString, configuration);
            diff2htmlUi.draw();
            diff2htmlUi.highlightCode();
            
            console.log('[GitView] Render complete.');
        }
        showToast('Git changes loaded', 'success');

    } catch (err) {
        console.error('[GitView] Error:', err);
        gitContainer.innerHTML = `
            <div class="git-loading-msg" style="color:var(--ios-red);">
                <div>⚠️ Error</div>
                <div style="font-size:12px;">${err.message}</div>
                <div style="font-size:10px; margin-top:5px;">Check F12 Console for details</div>
            </div>`;
    }
    
    if (refreshBtn) {
        refreshBtn.style.opacity = '1';
        refreshBtn.disabled = false;
    }
}
