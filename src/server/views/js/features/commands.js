/**
 * Saved Commands Feature
 * Manages saved terminal commands that can be quickly executed
 */

let savedCommands = [];
let editingCommandId = null;

/**
 * Initialize saved commands on page load
 */
export async function initSavedCommands() {
    await loadSavedCommands();
    renderCommands();
}

/**
 * Load saved commands from backend
 */
async function loadSavedCommands() {
    try {
        const response = await fetch('/api/commands/load');
        const data = await response.json();
        savedCommands = data.commands || [];
    } catch (error) {
        console.error('Failed to load commands:', error);
        savedCommands = [];
    }
}

/**
 * Save commands to backend (debounced)
 */
let saveTimeout = null;
async function saveCommands() {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async () => {
        try {
            const response = await fetch('/api/commands/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ commands: savedCommands })
            });
            const data = await response.json();
            if (data.success) {
                console.log(`✓ Saved ${data.count} commands`);
            }
        } catch (error) {
            console.error('Failed to save commands:', error);
        }
    }, 500);
}

/**
 * Render commands in UI
 */
function renderCommands() {
    const container = document.getElementById('commands-list');
    const emptyState = document.getElementById('commands-empty-state');
    
    if (!container) return;

    if (savedCommands.length === 0) {
        container.innerHTML = '';
        if (emptyState) emptyState.style.display = 'block';
        return;
    }

    if (emptyState) emptyState.style.display = 'none';

    container.innerHTML = savedCommands.map(cmd => `
        <div class="command-card" onclick="window.runSavedCommand('${cmd.id}')">
            <div class="command-card-main">
                <span class="command-icon">${cmd.icon}</span>
                <div class="command-info">
                    <div class="command-name">${escapeHtml(cmd.name)}</div>
                    <div class="command-text">${escapeHtml(cmd.command)}</div>
                </div>
            </div>
            <div class="command-card-actions">
                <button class="command-action-btn" onclick="window.editCommand('${cmd.id}'); event.stopPropagation();" title="Edit">
                    ✏️
                </button>
                <button class="command-action-btn" onclick="window.deleteCommand('${cmd.id}'); event.stopPropagation();" title="Delete">
                    🗑️
                </button>
            </div>
        </div>
    `).join('');
}

/**
 * Open add command modal
 */
function openAddCommandModal() {
    editingCommandId = null;
    document.getElementById('modal-title').textContent = 'Add Command';
    document.getElementById('command-icon').value = '🚀';
    document.getElementById('command-name').value = '';
    document.getElementById('command-text').value = '';
    document.getElementById('command-modal').style.display = 'flex';
    document.getElementById('command-name').focus();
}

/**
 * Open edit command modal
 */
function editCommand(id) {
    const command = savedCommands.find(c => c.id === id);
    if (!command) return;

    editingCommandId = id;
    document.getElementById('modal-title').textContent = 'Edit Command';
    document.getElementById('command-icon').value = command.icon;
    document.getElementById('command-name').value = command.name;
    document.getElementById('command-text').value = command.command;
    document.getElementById('command-modal').style.display = 'flex';
    document.getElementById('command-name').focus();
}

/**
 * Close command modal
 */
function closeCommandModal() {
    document.getElementById('command-modal').style.display = 'none';
    editingCommandId = null;
}

/**
 * Handle command form submit
 */
function handleCommandFormSubmit(event) {
    event.preventDefault();

    const icon = document.getElementById('command-icon').value.trim();
    const name = document.getElementById('command-name').value.trim();
    const command = document.getElementById('command-text').value.trim();

    if (!icon || !name || !command) return;

    if (editingCommandId) {
        // Edit existing
        const index = savedCommands.findIndex(c => c.id === editingCommandId);
        if (index !== -1) {
            savedCommands[index] = { ...savedCommands[index], icon, name, command };
        }
    } else {
        // Add new
        savedCommands.push({
            id: 'cmd_' + Date.now(),
            icon,
            name,
            command
        });
    }

    saveCommands();
    renderCommands();
    closeCommandModal();
}

/**
 * Delete command with confirmation
 */
function deleteCommand(id) {
    const command = savedCommands.find(c => c.id === id);
    if (!command) return;

    if (confirm(`Delete command "${command.name}"?`)) {
        savedCommands = savedCommands.filter(c => c.id !== id);
        saveCommands();
        renderCommands();
    }
}

/**
 * Run saved command - open terminal and copy command to clipboard
 */
function runSavedCommand(id) {
    const command = savedCommands.find(c => c.id === id);
    if (!command) return;

    // Create new terminal
    if (typeof window.createNewTerminal === 'function') {
        window.createNewTerminal();
    }
    
    // Copy command to clipboard
    navigator.clipboard.writeText(command.command).then(() => {
        // Show toast notification
        if (typeof window.showToast === 'function') {
            window.showToast(`📋 Copied: ${command.command}`, 'success');
        }
    }).catch(err => {
        console.error('Failed to copy command:', err);
        if (typeof window.showToast === 'function') {
            window.showToast('Failed to copy command', 'error');
        }
    });
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Global exports for HTML onclick
window.openAddCommandModal = openAddCommandModal;
window.editCommand = editCommand;
window.closeCommandModal = closeCommandModal;
window.deleteCommand = deleteCommand;
window.runSavedCommand = runSavedCommand;

// Setup form submit handler
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        const form = document.getElementById('command-form');
        if (form) {
            form.addEventListener('submit', handleCommandFormSubmit);
        }
    });
}

export { openAddCommandModal, editCommand, deleteCommand, runSavedCommand };
