// Event Handlers & Business Logic
import { SYSTEM_PROMPT } from './config.js';
import { analyzeProject, executeScript, copyToClipboard, readFromClipboard } from './api.js';
import { showToast, showLoading, resetButton, showResponse, showCopiedState } from './utils.js';
// Import dedicated feature handlers
import { handleStructureView, handleToggleFolder, handleCheckboxChange, handleCopySelected } from './features/structure.js';

let lastAnalyzeResult = null;

// ==========================================
// SYSTEM PROMPT HANDLERS
// ==========================================

export function toggleSystemPrompt() {
    const content = document.getElementById('system-prompt-content');
    const icon = document.getElementById('toggle-icon');
    content.classList.toggle('open');
    icon.classList.toggle('open');
}

export function copySystemPromptFromHeader(event) {
    event.stopPropagation();
    const btn = event.currentTarget;
    btn.textContent = '✓';
    navigator.clipboard.writeText(SYSTEM_PROMPT).then(() => {
        showToast('Đã copy System Prompt', 'success');
        setTimeout(() => btn.textContent = '📋', 2000);
    }).catch(err => {
        showToast('Lỗi copy: ' + err.message, 'error');
        btn.textContent = '📋';
    });
}

export function copySystemPrompt(event) {
    const copyBtn = event.target.closest('.btn-copy');
    const copyIcon = document.getElementById('copy-icon');
    const copyText = document.getElementById('copy-text');

    navigator.clipboard.writeText(SYSTEM_PROMPT).then(() => {
        showCopiedState(copyBtn, copyIcon, copyText, '📋', 'Copy System Prompt');
        showToast('Đã copy System Prompt', 'success');
    }).catch(err => showToast('Lỗi copy: ' + err.message, 'error'));
}

// ==========================================
// ANALYZE HANDLERS
// ==========================================

export async function testAnalyze(event) {
    const btn = event.target.closest('.btn') || event.target.closest('.btn-icon-head');
    const path = document.getElementById('analyze-path').value;

    showLoading(btn, btn.innerHTML);
    try {
        const text = await analyzeProject(path);
        lastAnalyzeResult = text;

        const blob = new Blob([text], { type: 'text/plain' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'project.txt';
        a.click();

        showResponse('analyze-response', {
            success: true,
            message: 'File downloaded!',
            files: text.split('\n').filter(l => l.includes('===== FILE:')).length,
            size: (text.length / 1024).toFixed(2) + ' KB'
        });
        showToast('Đã download file', 'success');
    } catch (err) {
        showResponse('analyze-response', { error: err.message }, true);
        showToast('Lỗi: ' + err.message, 'error');
    }
    resetButton(btn);
}

export async function copyAnalyzeResult(event) {
    const copyBtn = event.target.closest('.btn-copy');
    const copyIcon = document.getElementById('analyze-copy-icon');
    const copyText = document.getElementById('analyze-copy-text');

    if (!lastAnalyzeResult) {
        const path = document.getElementById('analyze-path').value;
        showLoading(copyBtn, copyBtn.innerHTML);
        try {
            lastAnalyzeResult = await analyzeProject(path);
        } catch (err) {
            showToast('Lỗi: ' + err.message, 'error');
            resetButton(copyBtn);
            return;
        }
        resetButton(copyBtn);
    }

    try {
        await copyToClipboard(lastAnalyzeResult);
        showCopiedState(copyBtn, copyIcon, copyText, '📋', 'Copy Text');
        showToast('Đã copy project.txt', 'success');
    } catch (err) {
        showToast('Lỗi copy: ' + err.message, 'error');
    }
}

// ==========================================
// EXECUTE HANDLERS
// ==========================================

export async function testExecute(event) {
    const btn = event.target.closest('.btn');
    const bashInput = document.getElementById('execute-bash');
    const bash = bashInput.value;

    if (!bash.trim()) {
        showToast('Vui lòng nhập bash script', 'error');
        return;
    }

    showLoading(btn, btn.innerHTML);
    try {
        const data = await executeScript(bash);
        showResponse('execute-response', data, !data.success);
        data.success ? showToast('Thực thi thành công', 'success') : showToast('Thực thi thất bại', 'error');
        if (data.success) bashInput.value = '';
    } catch (err) {
        showResponse('execute-response', { error: err.message }, true);
        showToast('Lỗi: ' + err.message, 'error');
    }
    resetButton(btn);
}

export async function executeFromClipboard(event) {
    const btn = event.target.closest('.btn');
    const bashInput = document.getElementById('execute-bash');

    showLoading(btn, btn.innerHTML);
    try {
        const clipboardText = await readFromClipboard();
        if (!clipboardText || !clipboardText.trim()) {
            showToast('Clipboard trống!', 'error');
            resetButton(btn);
            return;
        }
        bashInput.value = clipboardText;
        const data = await executeScript(clipboardText);
        showResponse('execute-response', data, !data.success);
        
        if (data.success) {
            showToast('Thực thi OK', 'success');
            bashInput.value = '';
        } else {
            data.syntaxError ? showToast('Lỗi syntax script', 'error') : showToast('Thực thi thất bại', 'error');
        }
    } catch (err) {
        if (err.name === 'NotAllowedError') {
            showToast('Không có quyền clipboard', 'error');
        } else {
            showResponse('execute-response', { error: err.message }, true);
            showToast('Lỗi: ' + err.message, 'error');
        }
    }
    resetButton(btn);
}

// ==========================================
// EXPORT TO WINDOW (GLOBAL)
// ==========================================

window.toggleSystemPrompt = toggleSystemPrompt;
window.copySystemPrompt = copySystemPrompt;
window.copySystemPromptFromHeader = copySystemPromptFromHeader;
window.testAnalyze = testAnalyze;
window.copyAnalyzeResult = copyAnalyzeResult;
window.testExecute = testExecute;
window.executeFromClipboard = executeFromClipboard;

// Map Structure handlers from feature module to window
window.testStructure = handleStructureView;
window.toggleFolder = handleToggleFolder;
window.handleCheckboxChange = handleCheckboxChange;
window.copySelectedStructure = handleCopySelected;
