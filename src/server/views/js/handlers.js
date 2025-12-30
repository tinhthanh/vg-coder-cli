import { SYSTEM_PROMPT, API_BASE } from './config.js';
import { analyzeProject, executeScript, copyToClipboard, readFromClipboard } from './api.js';
import { showToast, showLoading, resetButton, showResponse, showCopiedState, getById } from './utils.js';
import { globalDispatcher, EVENT_TYPES } from './event-protocol.js';

let lastAnalyzeResult = null;

/**
 * Initialize event handlers for bubble menu features
 * This creates the bridge between UI events and handler functions
 */
export function initEventHandlers() {
    // Paste & Run from Clipboard
    globalDispatcher.on(EVENT_TYPES.PASTE_RUN, async (event) => {
        console.log('[Handlers] Paste & Run event received:', event);
        await executeFromClipboard();
    });

    // New Terminal
    globalDispatcher.on(EVENT_TYPES.TERMINAL_NEW, (event) => {
        console.log('[Handlers] New Terminal event received:', event);
        if (typeof window.createNewTerminal === 'function') {
            window.createNewTerminal();
        } else {
            showToast('Terminal feature not available', 'error');
        }
    });

    // Terminal Execute (for future use)
    globalDispatcher.on(EVENT_TYPES.TERMINAL_EXECUTE, (event) => {
        console.log('[Handlers] Terminal Execute event received:', event);
        const { command, terminalId } = event.payload || {};
        if (command) {
            // TODO: Implement terminal execute logic
            console.log(`Execute in terminal ${terminalId}: ${command}`);
        }
    });

    // Copy System Prompt
    globalDispatcher.on(EVENT_TYPES.COPY_PROMPT, async (event) => {
        console.log('[Handlers] Copy Prompt event received:', event);
        try {
            await navigator.clipboard.writeText(SYSTEM_PROMPT);
            showToast('📋 Copied System Prompt', 'success');
        } catch (err) {
            showToast('Failed to copy: ' + err.message, 'error');
        }
    });

    console.log('[Handlers] Event handlers initialized');
}

export function toggleSystemPrompt() {
    const content = getById('system-prompt-content');
    const icon = getById('toggle-icon');
    if(content) content.classList.toggle('open');
    if(icon) icon.classList.toggle('open');
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
    const copyIcon = getById('copy-icon');
    const copyText = getById('copy-text');

    navigator.clipboard.writeText(SYSTEM_PROMPT).then(() => {
        showCopiedState(copyBtn, copyIcon, copyText, '📋', 'Copy System Prompt');
        showToast('Đã copy System Prompt', 'success');
    }).catch(err => showToast('Lỗi copy: ' + err.message, 'error'));
}

export async function testAnalyze(event) {
    const btn = event.target.closest('.btn') || event.target.closest('.btn-icon-head');
    const pathInput = getById('analyze-path');
    if (!pathInput) return;
    
    const path = pathInput.value;

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
    const copyIcon = getById('analyze-copy-icon');
    const copyText = getById('analyze-copy-text');
    const pathInput = getById('analyze-path');

    if (!lastAnalyzeResult && pathInput) {
        const path = pathInput.value;
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

export async function testExecute(event) {
    const btn = event.target.closest('.btn');
    const bashInput = getById('execute-bash');
    if (!bashInput) return;
    
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
    const btn = event?.target?.closest('.btn');
    const bashInput = getById('execute-bash');
    
    // Don't return early if bashInput is missing - it's optional when called from bubble menu

    if (btn) showLoading(btn, btn.innerHTML);
    try {
        const clipboardText = await readFromClipboard();
        if (!clipboardText || !clipboardText.trim()) {
            showToast('Clipboard trống!', 'error');
            if (btn) resetButton(btn);
            return;
        }
        
        // Only populate bashInput if it exists (when called from dashboard)
        if (bashInput) {
            bashInput.value = clipboardText;
        }
        
        const data = await executeScript(clipboardText);
        
        // Only show response in execute-response container if it exists
        const responseContainer = getById('execute-response');
        if (responseContainer) {
            showResponse('execute-response', data, !data.success);
        }
        
        if (data.success) {
            showToast('Thực thi OK', 'success');
            if (bashInput) {
                bashInput.value = '';
            }
        } else {
            data.syntaxError ? showToast('Lỗi syntax script', 'error') : showToast('Thực thi thất bại', 'error');
        }
    } catch (err) {
        if (err.name === 'NotAllowedError') {
            showToast('Không có quyền clipboard', 'error');
        } else {
            const responseContainer = getById('execute-response');
            if (responseContainer) {
                showResponse('execute-response', { error: err.message }, true);
            }
            showToast('Lỗi: ' + err.message, 'error');
        }
    }
    if (btn) resetButton(btn);
}

window.toggleSystemPrompt = toggleSystemPrompt;
window.copySystemPrompt = copySystemPrompt;
window.copySystemPromptFromHeader = copySystemPromptFromHeader;
window.testAnalyze = testAnalyze;
window.copyAnalyzeResult = copyAnalyzeResult;
window.testExecute = testExecute;
window.executeFromClipboard = executeFromClipboard;
