import { getById, qsa } from '../utils.js';

let activePanel = null;
let activePanelRight = null;

/**
 * Initialize Tool Window system
 */
export function initToolWindow() {
    // Initialize left tool window bar
    const toolWindowBar = getById('tool-window-bar');
    if (!toolWindowBar) {
        console.warn('[ToolWindow] Tool window bar not found');
        return;
    }

    // Attach event listeners to all tool window icons (left side)
    const icons = qsa('#tool-window-bar .tool-window-icon');
    icons.forEach(icon => {
        icon.addEventListener('click', () => {
            const panelId = icon.dataset.panel;
            if (panelId) {
                togglePanel(panelId);
            }
        });
    });

    // Initialize right tool window bar
    const toolWindowBarRight = getById('tool-window-bar-right');
    if (toolWindowBarRight) {
        const iconsRight = qsa('#tool-window-bar-right .tool-window-icon');
        iconsRight.forEach(icon => {
            icon.addEventListener('click', () => {
                const panelId = icon.dataset.panel;
                if (panelId) {
                    togglePanelRight(panelId);
                }
            });
        });
        console.log('[ToolWindow] Right tool window bar initialized');
    }

    // Open Project panel by default after a short delay
    // This ensures all panel listeners are registered first
    setTimeout(() => {
        togglePanel('project');
    }, 100);

    console.log('[ToolWindow] Initialized with Project panel active');
}

/**
 * Toggle a specific panel (left side)
 * @param {string} panelId - Panel ID to toggle (e.g., 'project', 'git')
 */
export function togglePanel(panelId) {
    const panel = getById(`tool-panel-${panelId}`);
    const container = getById('tool-panel-container');
    const icon = qsa(`#tool-window-bar .tool-window-icon[data-panel="${panelId}"]`)[0];

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
 * Toggle a specific panel (right side)
 * @param {string} panelId - Panel ID to toggle (e.g., 'agent', 'browser')
 */
export function togglePanelRight(panelId) {
    const panel = getById(`tool-panel-${panelId}`);
    const container = getById('tool-panel-container-right');
    const icon = qsa(`#tool-window-bar-right .tool-window-icon[data-panel="${panelId}"]`)[0];

    if (!panel || !container) {
        console.error('[ToolWindow] Right panel or container not found:', panelId);
        return;
    }

    // If clicking the same active panel, close it
    if (activePanelRight === panelId) {
        closeAllPanelsRight();
        return;
    }

    // Close all right panels first
    closeAllPanelsRight();

    // Open the new panel
    container.classList.add('expanded');
    panel.classList.add('active');
    if (icon) icon.classList.add('active');

    activePanelRight = panelId;

    // Trigger panel-specific initialization if needed
    triggerPanelInit(panelId, 'right');

    console.log('[ToolWindow] Opened right panel:', panelId);
}

/**
 * Close all open panels (left side)
 */
export function closeAllPanels() {
    const container = getById('tool-panel-container');
    const panels = qsa('#tool-panel-container .tool-panel');
    const icons = qsa('#tool-window-bar .tool-window-icon');

    if (container) {
        container.classList.remove('expanded');
        // Reset width to allow CSS transition to work properly
        container.style.width = '';
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
 * Close all open panels (right side)
 */
export function closeAllPanelsRight() {
    const container = getById('tool-panel-container-right');
    const panels = qsa('#tool-panel-container-right .tool-panel');
    const icons = qsa('#tool-window-bar-right .tool-window-icon');

    if (container) {
        container.classList.remove('expanded');
        // Reset width to allow CSS transition to work properly
        container.style.width = '';
    }

    panels.forEach(panel => {
        panel.classList.remove('active');
    });

    icons.forEach(icon => {
        icon.classList.remove('active');
    });

    activePanelRight = null;

    console.log('[ToolWindow] Closed all right panels');
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
 * @param {string} side - 'left' or 'right'
 */
function triggerPanelInit(panelId, side = 'left') {
    // Dispatch custom event that panel modules can listen to
    const event = new CustomEvent('tool-panel-opened', {
        detail: { panelId, side }
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
 * Get the currently active right panel ID
 * @returns {string|null} Active right panel ID or null
 */
export function getActivePanelRight() {
    return activePanelRight;
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
window.toggleToolPanelRight = togglePanelRight;
window.closeToolPanelsRight = closeAllPanelsRight;
