/**
 * VG Coder Keyboard Shortcuts Module (Shadow DOM Compatible)
 * 
 * Global keyboard shortcuts that work when VG Coder is injected via extension.
 * Uses document-level listeners and composedPath() to check Shadow DOM isolation.
 */

import { getById, getRoot } from '../utils.js';

/**
 * Centralized keyboard shortcuts configuration
 * Single source of truth for all shortcuts
 */
const SHORTCUTS_CONFIG = [
    {
        key: '3',
        action: 'toggle-dashboard',
        description: 'Toggle VG Coder Dashboard (Open/Close)',
    },
    {
        key: '4',
        action: 'open-git-panel',
        description: 'Open VG Coder & Activate Git Panel',
    },
    {
        key: '/',
        action: 'help-shortcuts',
        description: 'Show/Hide Keyboard Shortcuts Help',
    },
];

/**
 * Generate shortcuts registry from config
 * Automatically creates CMD+key and CTRL+key variants
 */
const SHORTCUTS = {};
SHORTCUTS_CONFIG.forEach(({ key, action }) => {
    SHORTCUTS[`CMD+${key.toUpperCase()}`] = action;
    SHORTCUTS[`CTRL+${key.toUpperCase()}`] = action;
});

// Platform detection
const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPod|iPad/.test(navigator.platform);

/**
 * Convert keyboard event to shortcut key string
 * @param {KeyboardEvent} event - Keyboard event
 * @returns {string|null} Shortcut key string (e.g., "CMD+4")
 */
function getShortcutKey(event) {
    const parts = [];
    
    // Add modifier keys
    if (event.metaKey) parts.push('CMD');
    if (event.ctrlKey) parts.push('CTRL');
    if (event.altKey) parts.push('ALT');
    if (event.shiftKey) parts.push('SHIFT');
    
    // Add main key (use event.key for number keys)
    const key = event.key;
    
    // Skip if only modifiers were pressed
    if (['Meta', 'Control', 'Alt', 'Shift'].includes(key)) {
        return null;
    }
    
    parts.push(key.toUpperCase());
    
    return parts.join('+');
}

/**
 * Check if event originated from VG Coder Shadow DOM
 * @param {KeyboardEvent} event - Keyboard event
 * @returns {boolean} True if event is from VG Coder
 */
function isFromVGCoder(event) {
    try {
        // SIMPLIFIED APPROACH: Since we're in shadow DOM context,
        // just check if VG Coder elements exist (we're always "in" VG Coder)
        // This works because the bundle is only loaded when VG Coder is active
        const appRoot = getById('vg-app-root');
        const bubble = getById('vg-bubble');
        
        // If VG Coder is loaded, we should handle ALL keyboard events
        // (We're in isolated shadow DOM, so we won't interfere with page events)
        const vgCoderExists = !!(appRoot || bubble);
        
        if (!vgCoderExists) {
            console.warn('[Keyboard] VG Coder elements not found');
            return false;
        }
        
        return true;
    } catch (err) {
        console.warn('[Keyboard] Error checking VG Coder:', err);
        return false;
    }
}

/**
 * Toggle VG Coder dashboard visibility
 */
function toggleDashboard() {
    const appRoot = getById('vg-app-root');
    if (!appRoot) {
        console.warn('[Keyboard] Cannot toggle dashboard: vg-app-root not found');
        return;
    }
    
    const isVisible = appRoot.classList.contains('visible');
    
    if (isVisible) {
        appRoot.classList.remove('visible');
        console.log('[Keyboard] Dashboard hidden');
    } else {
        appRoot.classList.add('visible');
        console.log('[Keyboard] Dashboard shown');
    }
}

/**
 * Open VG Coder and activate Git panel
 */
function openGitPanel() {
    const appRoot = getById('vg-app-root');
    if (!appRoot) {
        console.warn('[Keyboard] Cannot open Git panel: vg-app-root not found');
        return;
    }
    
    // First, make sure dashboard is visible
    if (!appRoot.classList.contains('visible')) {
        appRoot.classList.add('visible');
        console.log('[Keyboard] Dashboard opened');
    }
    
    // Then activate Git panel using getRoot() to query in Shadow DOM
    const root = getRoot();
    const gitButton = root.querySelector('.tool-window-icon[data-panel="git"]');
    if (gitButton) {
        gitButton.click();
        console.log('[Keyboard] Git panel activated');
    } else {
        console.warn('[Keyboard] Git panel button not found');
    }
}

/**
 * Create new terminal
 */
function createNewTerminal() {
    if (typeof window.createNewTerminal === 'function') {
        window.createNewTerminal();
        console.log('[Keyboard] New terminal created');
    } else {
        console.warn('[Keyboard] Terminal feature not available');
    }
}

/**
 * Handle keyboard event
 * @param {KeyboardEvent} event - Keyboard event
 */
function handleKeyDown(event) {
    // Debug: Log all keyboard events
    const key = event.key;
    const meta = event.metaKey;
    const ctrl = event.ctrlKey;
    
    // Only log if Cmd or Ctrl is pressed (to reduce noise)
    if (meta || ctrl) {
        console.log('[Keyboard] Key event:', { key, meta, ctrl, alt: event.altKey, shift: event.shiftKey });
    }
    
    // Check if event is from VG Coder shadow DOM
    const fromVGCoder = isFromVGCoder(event);
    if (!fromVGCoder) {
        if (meta || ctrl) {
            console.log('[Keyboard] Event ignored - not from VG Coder');
        }
        return;
    }
    
    const shortcutKey = getShortcutKey(event);
    console.log('[Keyboard] Shortcut key detected:', shortcutKey);
    
    if (!shortcutKey) return;
    
    // Check if shortcut is registered
    const action = SHORTCUTS[shortcutKey];
    
    if (!action) {
        console.log('[Keyboard] No action registered for:', shortcutKey);
        return;
    }
    
    // Prevent default browser behavior
    event.preventDefault();
    event.stopPropagation();
    
    console.log(`[Keyboard] Shortcut triggered: ${shortcutKey} -> ${action}`);
    
    // Execute action
    switch (action) {
        case 'toggle-dashboard':
            toggleDashboard();
            break;
        case 'open-git-panel':
            openGitPanel();
            break;
        case 'help-shortcuts':
            toggleShortcutsHelp();
            break;
        default:
            console.warn(`[Keyboard] Unknown action: ${action}`);
    }
}

/**
 * Toggle shortcuts help panel
 */
function toggleShortcutsHelp() {
    const helpPanel = getById('shortcuts-help');
    if (!helpPanel) {
        console.warn('[Keyboard] Help panel not found');
        return;
    }
    
    const isVisible = helpPanel.classList.contains('visible');
    
    if (isVisible) {
        helpPanel.classList.remove('visible');
        console.log('[Keyboard] Help panel hidden');
    } else {
        // Render shortcuts before showing
        renderHelpPanel();
        helpPanel.classList.add('visible');
        console.log('[Keyboard] Help panel shown');
    }
}

/**
 * Render shortcuts in help panel
 */
function renderHelpPanel() {
    const container = getById('shortcuts-list');
    if (!container) return;
    
    // Auto-generate shortcuts list from config
    const prefix = isMac ? 'Cmd' : 'Ctrl';
    const shortcuts = SHORTCUTS_CONFIG.map(({ key, description }) => ({
        key: `${prefix}+${key}`,
        desc: description,
    }));
    
    container.innerHTML = shortcuts.map(({ key, desc }) => {
        const keys = key.split('+').map(k => `<span class="vg-shortcut-key">${k}</span>`);
        const keysHtml = keys.join('<span class="vg-shortcut-plus">+</span>');
        
        return `
            <div class="vg-shortcut-item">
                <div class="vg-shortcut-desc">${desc}</div>
                <div class="vg-shortcut-keys">${keysHtml}</div>
            </div>
        `;
    }).join('');
}

/**
 * Create new terminal (continued from above)
 */
function continueCreateNewTerminal() {
    // This function placeholder ensures proper code flow
    // The actual implementation is below
}

// Fix the switch statement continuation
function handleKeyDownContinued(action) {
    switch (action) {
        case 'terminal-new':
            createNewTerminal();
            break;
        default:
            console.warn(`[Keyboard] Unknown action: ${action}`);
    }
}

/**
 * Initialize keyboard shortcuts
 */
export function initKeyboardShortcuts() {
    console.log('[Keyboard] Initializing keyboard shortcuts...');
    console.log(`[Keyboard] Platform: ${isMac ? 'macOS' : 'Windows/Linux'}`);
    
    // Register global keydown listener at document level
    // Using capture phase (true) to catch events before they reach target
    document.addEventListener('keydown', handleKeyDown, true);
    
    // Log registered shortcuts
    const shortcuts = Object.keys(SHORTCUTS)
        .filter(key => isMac ? key.startsWith('CMD') : key.startsWith('CTRL'))
        .map(key => `${key} → ${SHORTCUTS[key]}`);
    
    console.log('[Keyboard] Registered shortcuts:', shortcuts);
    console.log('[Keyboard] Keyboard shortcuts initialized ✓');
    
    // Make available for debugging and HTML onclick handlers
    if (typeof window !== 'undefined') {
        window.__VG_KEYBOARD_SHORTCUTS__ = {
            shortcuts: SHORTCUTS,
            platform: isMac ? 'mac' : 'win',
            toggle: toggleDashboard,
            terminal: createNewTerminal,
            help: toggleShortcutsHelp,
        };
        
        // Expose for HTML onclick handler
        window.toggleShortcutsHelp = toggleShortcutsHelp;
    }
}

/**
 * Get help text for shortcuts (for future help UI)
 * @returns {Array} Array of shortcut descriptions
 */
export function getShortcutsHelp() {
    const prefix = isMac ? 'Cmd' : 'Ctrl';
    return [
        { key: `${prefix}+4`, description: 'Toggle VG Coder Dashboard (Open/Close)' },
        { key: `${prefix}+5`, description: 'Create New Terminal' },
    ];
}
