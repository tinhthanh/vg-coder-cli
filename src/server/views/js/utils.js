// UI Utility Functions

/**
 * Display a toast notification
 * @param {string} message - Message to display
 * @param {string} type - Type of toast: 'success', 'error', 'info'
 */
export function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    // Reset text content to remove potential icon junk
    toast.textContent = message;
    toast.className = `toast ${type}`;
    toast.classList.add('show');

    // Clear previous timeout if exists
    if (toast.timeoutId) clearTimeout(toast.timeoutId);

    toast.timeoutId = setTimeout(() => toast.classList.remove('show'), 3000);
}

/**
 * Show loading state on button
 * @param {HTMLElement} button - Button element
 * @param {string} originalText - Original button HTML
 */
export function showLoading(button, originalText) {
    button.disabled = true;
    button.innerHTML = '<span class="loading"></span>';
    button.dataset.originalText = originalText;
}

/**
 * Reset button to original state
 * @param {HTMLElement} button - Button element
 */
export function resetButton(button) {
    button.disabled = false;
    const originalText = button.dataset.originalText;
    button.innerHTML = originalText;
}

/**
 * Display API response in response area
 * @param {string} elementId - ID of response element
 * @param {Object} data - Response data
 * @param {boolean} isError - Whether this is an error response
 */
export function showResponse(elementId, data, isError = false) {
    const el = document.getElementById(elementId);
    el.className = 'response show ' + (isError ? 'error' : 'success');
    el.innerHTML = '<pre>' + JSON.stringify(data, null, 2) + '</pre>';
}

/**
 * Update button state to show copied status
 * @param {HTMLElement} button - Button element
 * @param {HTMLElement} icon - Icon element
 * @param {HTMLElement} text - Text element
 * @param {string} originalIcon - Original icon text
 * @param {string} originalText - Original button text
 */
export function showCopiedState(button, icon, text, originalIcon, originalText) {
    button.classList.add('copied');
    icon.textContent = '✓';
    text.textContent = 'Copied';

    setTimeout(() => {
        button.classList.remove('copied');
        icon.textContent = originalIcon;
        text.textContent = originalText;
    }, 2000);
}

/**
 * Format number with commas (handles undefined/null)
 * @param {number} num - Number to format
 * @returns {string} Formatted string
 */
export function formatNumber(num) {
    if (num === undefined || num === null) return '0';
    return num.toLocaleString('en-US');
}
