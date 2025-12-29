// UI Utility Functions & DOM Helpers

// --- Context Management ---
let _root = document;

export function setRoot(rootElement) {
    _root = rootElement;
    // Update global reference if in Shadow DOM
    if (rootElement.host) {
        window.__VG_CODER_ROOT__ = rootElement;
    }
}

export function getRoot() {
    return _root;
}

// DOM Helpers to replace document.*
export function qs(selector) {
    return _root.querySelector(selector);
}

export function qsa(selector) {
    return _root.querySelectorAll(selector);
}

export function getById(id) {
    // ShadowRoot doesn't always support getElementById in standard way, querySelector is safer
    return _root.querySelector('#' + id);
}

// --- UI Utils ---

/**
 * Display a toast notification
 */
export function showToast(message, type = 'success') {
    const toast = getById('toast');
    if (!toast) return;

    // Reset text content
    toast.textContent = message;
    toast.className = `toast ${type}`;
    toast.classList.add('show');

    if (toast.timeoutId) clearTimeout(toast.timeoutId);
    toast.timeoutId = setTimeout(() => toast.classList.remove('show'), 3000);
}

/**
 * Show loading state on button
 */
export function showLoading(button, originalText) {
    if (!button) return;
    button.disabled = true;
    button.innerHTML = '<span class="loading"></span>';
    button.dataset.originalText = originalText;
}

/**
 * Reset button to original state
 */
export function resetButton(button) {
    if (!button) return;
    button.disabled = false;
    const originalText = button.dataset.originalText;
    if (originalText) button.innerHTML = originalText;
}

/**
 * Display API response
 */
export function showResponse(elementId, data, isError = false) {
    const el = getById(elementId);
    if (!el) return;
    el.className = 'response show ' + (isError ? 'error' : 'success');
    el.innerHTML = '<pre>' + JSON.stringify(data, null, 2) + '</pre>';
}

/**
 * Update button state to show copied status
 */
export function showCopiedState(button, icon, text, originalIcon, originalText) {
    if (!button) return;
    button.classList.add('copied');
    if (icon) icon.textContent = '✓';
    if (text) text.textContent = 'Copied';

    setTimeout(() => {
        button.classList.remove('copied');
        if (icon) icon.textContent = originalIcon;
        if (text) text.textContent = originalText;
    }, 2000);
}

/**
 * Format number with commas
 */
export function formatNumber(num) {
    if (num === undefined || num === null) return '0';
    return num.toLocaleString('en-US');
}
