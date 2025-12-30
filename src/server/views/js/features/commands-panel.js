import { getById } from '../utils.js';

let isInitialized = false;

/**
 * Initialize Commands Panel
 */
export function initCommandsPanel() {
    if (isInitialized) return;
    
    console.log('[CommandsPanel] Initializing...');
    
    // Render panel content
    renderCommandsPanel();
    
    isInitialized = true;
    console.log('[CommandsPanel] Initialized successfully');
}

/**
 * Render Commands Panel structure
 */
function renderCommandsPanel() {
    const container = getById('commands-panel-content');
    if (!container) {
        console.error('[CommandsPanel] Container not found');
        return;
    }

    // Render the same structure as old saved-commands
    container.innerHTML = `
        <div class="commands-panel-header">
            <button class="commands-panel-btn" onclick="createNewTerminal()" title="New Terminal">
                🖥️ New Terminal
            </button>
            <button class="commands-panel-btn" onclick="openAddCommandModal()" title="Add Command">
                ➕ Add Command
            </button>
        </div>
        <div class="saved-commands-content">
            <div id="commands-list" class="commands-list"></div>
            <div class="commands-empty-state" id="commands-empty-state" style="display: none;">
                <p style="color: #888; text-align: center; padding: 15px 10px; font-size: 12px; margin: 0;">Click ➕ to add a command</p>
            </div>
        </div>
    `;
    
    // Load saved commands after rendering
    setTimeout(() => {
        if (window.loadSavedCommands) {
            window.loadSavedCommands();
        }
    }, 100);
}

/**
 * Refresh commands list
 */
export function refreshCommandsList() {
    if (window.loadSavedCommands) {
        window.loadSavedCommands();
    }
}
