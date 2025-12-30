import { getById, qsa } from '../utils.js';

let activePanel = null;

/**
 * Initialize Tool Window system
 */
export function initToolWindow() {
    const toolWindowBar = getById('tool-window-bar');
    if (!toolWindowBar) {
        console.warn('[ToolWindow] Tool window bar not found');
        return;
    }

    // Attach event listeners to all tool window icons
    const icons = qsa('.tool-window-icon');
    icons.forEach(icon => {
        icon.addEventListener('click', () => {
            const panelId = icon.dataset.panel;
            if (panelId) {
                togglePanel(panelId);
            }
        });
    });

    console.log('[ToolWindow] Initialized');
}

/**
 * Toggle a specific panel
 * @param {string} panelId - Panel ID to toggle (e.g., 'project', 'git')
 */
export function togglePanel(panelId) {
    const panel = getById(`tool-panel-${panelId}`);
    const container = getById('tool-panel-container');
    const icon = qsa(`.tool-window-icon[data-panel="${panelId}"]`)[0];

    if (!panel || !container) {
        console.error('[ToolWindow] Panel or container not found:', panelId);
        return;
    }

    // If clicking the same active panel, close it
    if (activePanel === panelId) {
        closeAllPanels();
        return;
    }

    // Close all panels first
    closeAllPanels();

    // Open the new panel
    setActivePanel(panelId);
    container.classList.add('expanded');
    panel.classList.add('active');
    if (icon) icon.classList.add('active');

    activePanel = panelId;

    // Trigger panel-specific initialization if needed
    triggerPanelInit(panelId);

    console.log('[ToolWindow] Opened panel:', panelId);
}

/**
 * Close all open panels
 */
export function closeAllPanels() {
    const container = getById('tool-panel-container');
    const panels = qsa('.tool-panel');
    const icons = qsa('.tool-window-icon');

    if (container) {
        container.classList.remove('expanded');
    }

    panels.forEach(panel => {
        panel.classList.remove('active');
    });

    icons.forEach(icon => {
        icon.classList.remove('active');
    });

    activePanel = null;

    console.log('[ToolWindow] Closed all panels');
}

/**
 * Set a panel as active (internal use)
 * @param {string} panelId - Panel ID
 */
function setActivePanel(panelId) {
    const panels = qsa('.tool-panel');
    panels.forEach(panel => {
        if (panel.id === `tool-panel-${panelId}`) {
            panel.classList.add('active');
        } else {
            panel.classList.remove('active');
        }
    });
}

/**
 * Trigger initialization for panel-specific features
 * @param {string} panelId - Panel ID
 */
function triggerPanelInit(panelId) {
    // Dispatch custom event that panel modules can listen to
    const event = new CustomEvent('tool-panel-opened', {
        detail: { panelId }
    });
    document.dispatchEvent(event);
}

/**
 * Get the currently active panel ID
 * @returns {string|null} Active panel ID or null
 */
export function getActivePanel() {
    return activePanel;
}

/**
 * Register a callback for when a panel is closed
 * @param {Function} callback - Callback function
 */
export function onPanelClose(callback) {
    const container = getById('tool-panel-container');
    if (container) {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.attributeName === 'class') {
                    if (!container.classList.contains('expanded')) {
                        callback();
                    }
                }
            });
        });
        observer.observe(container, { attributes: true });
    }
}

// Expose to window for HTML onclick if needed
window.toggleToolPanel = togglePanel;
window.closeToolPanels = closeAllPanels;
