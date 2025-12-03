// Event Handlers & Business Logic
import { SYSTEM_PROMPT } from './config.js';
import { analyzeProject, executeScript, copyAsFile, copyToClipboard, readFromClipboard } from './api.js';
import { showToast, showLoading, resetButton, showResponse, showCopiedState } from './utils.js';

// State management
let lastAnalyzeResult = null;

/**
 * Toggle system prompt section
 */
export function toggleSystemPrompt() {
    const content = document.getElementById('system-prompt-content');
    const icon = document.getElementById('toggle-icon');
    content.classList.toggle('open');
    icon.classList.toggle('open');
}

/**
 * Copy system prompt from the Header Button
 * Stops propagation so the accordion doesn't toggle
 */
export function copySystemPromptFromHeader(event) {
    event.stopPropagation(); // Stop accordion from toggling
    
    // Animate button
    const btn = event.currentTarget;
    btn.textContent = '✓';
    
    navigator.clipboard.writeText(SYSTEM_PROMPT).then(() => {
        showToast('Đã copy System Prompt', 'success');
        setTimeout(() => {
            btn.textContent = '📋';
        }, 2000);
    }).catch(err => {
        showToast('Lỗi copy: ' + err.message, 'error');
        btn.textContent = '📋';
    });
}

/**
 * Copy system prompt to clipboard (Main content button)
 */
export function copySystemPrompt() {
    const copyBtn = event.target.closest('.btn-copy');
    const copyIcon = document.getElementById('copy-icon');
    const copyText = document.getElementById('copy-text');

    navigator.clipboard.writeText(SYSTEM_PROMPT).then(() => {
        showCopiedState(copyBtn, copyIcon, copyText, '📋', 'Copy System Prompt');
        showToast('Đã copy System Prompt', 'success');
    }).catch(err => {
        showToast('Lỗi copy: ' + err.message, 'error');
    });
}

/**
 * Handle analyze button click
 */
export async function testAnalyze() {
    // Support both the big button .btn and the header icon .btn-icon-head
    const btn = event.target.closest('.btn') || event.target.closest('.btn-icon-head');
    const path = document.getElementById('analyze-path').value;

    showLoading(btn, btn.innerHTML);
    try {
        const text = await analyzeProject(path);
        lastAnalyzeResult = text;

        // Download file
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

/**
 * Copy analyze result as text
 */
export async function copyAnalyzeResult() {
    const copyBtn = event.target.closest('.btn-copy');
    const copyIcon = document.getElementById('analyze-copy-icon');
    const copyText = document.getElementById('analyze-copy-text');

    if (!lastAnalyzeResult) {
        // Fetch if not already analyzed
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

    // Copy to clipboard
    try {
        await copyToClipboard(lastAnalyzeResult);
        showCopiedState(copyBtn, copyIcon, copyText, '📋', 'Copy Text');
        showToast('Đã copy project.txt', 'success');
    } catch (err) {
        showToast('Lỗi copy: ' + err.message, 'error');
    }
}

/**
 * Handle execute button click
 */
export async function testExecute() {
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

        if (data.success) {
            showToast('Thực thi thành công', 'success');
            // Clear input on success
            bashInput.value = '';
        } else {
            showToast('Thực thi thất bại', 'error');
        }
    } catch (err) {
        showResponse('execute-response', { error: err.message }, true);
        showToast('Lỗi: ' + err.message, 'error');
    }
    resetButton(btn);
}

/**
 * Execute script from clipboard
 */
export async function executeFromClipboard() {
    const btn = event.target.closest('.btn');
    const bashInput = document.getElementById('execute-bash');

    showLoading(btn, btn.innerHTML);

    try {
        const clipboardText = await readFromClipboard();

        if (!clipboardText || !clipboardText.trim()) {
            showToast('Clipboard trống!', 'error');
            showResponse('execute-response', {
                error: 'Clipboard is empty',
                message: 'Please copy a bash script to clipboard first'
            }, true);
            resetButton(btn);
            return;
        }

        // Show what we are running
        bashInput.value = clipboardText;

        const data = await executeScript(clipboardText);
        showResponse('execute-response', data, !data.success);

        if (data.success) {
            showToast('Thực thi từ clipboard OK', 'success');
            // Clear input on success
            bashInput.value = '';
        } else {
            if (data.syntaxError) {
                showToast('Lỗi syntax script', 'error');
            } else {
                showToast('Thực thi thất bại', 'error');
            }
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

// Make functions globally available for onclick handlers
window.toggleSystemPrompt = toggleSystemPrompt;
window.copySystemPrompt = copySystemPrompt;
window.copySystemPromptFromHeader = copySystemPromptFromHeader;
window.testAnalyze = testAnalyze;
window.copyAnalyzeResult = copyAnalyzeResult;
window.testExecute = testExecute;
window.executeFromClipboard = executeFromClipboard;
