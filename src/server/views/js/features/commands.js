import { API_BASE } from '../config.js';
import { getById, showToast } from '../utils.js';

let savedCommands = [];
let editingCommandId = null;

export async function initSavedCommands() {
    await loadSavedCommands();
    renderCommands();
}

async function loadSavedCommands() {
    try {
        const response = await fetch(`${API_BASE}/api/commands/load`);
        const data = await response.json();
        savedCommands = data.commands || [];
        renderCommands();
    } catch (error) {
        console.error('Failed to load commands:', error);
        savedCommands = [];
    }
}

let saveTimeout = null;
async function saveCommands() {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async () => {
        try {
            const response = await fetch(`${API_BASE}/api/commands/save`, {
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

function renderCommands() {
    const container = getById('commands-list');
    const emptyState = getById('commands-empty-state');
    
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

function openAddCommandModal() {
    editingCommandId = null;
    getById('modal-title').textContent = 'Add Command';
    getById('command-icon').value = '🚀';
    getById('command-name').value = '';
    getById('command-text').value = '';
    getById('command-modal').style.display = 'flex';
    getById('command-name').focus();
}

function editCommand(id) {
    const command = savedCommands.find(c => c.id === id);
    if (!command) return;

    editingCommandId = id;
    getById('modal-title').textContent = 'Edit Command';
    getById('command-icon').value = command.icon;
    getById('command-name').value = command.name;
    getById('command-text').value = command.command;
    getById('command-modal').style.display = 'flex';
    getById('command-name').focus();
}

function closeCommandModal() {
    const modal = getById('command-modal');
    if (modal) modal.style.display = 'none';
    editingCommandId = null;
}

function handleCommandFormSubmit(event) {
    event.preventDefault();

    const icon = getById('command-icon').value.trim();
    const name = getById('command-name').value.trim();
    const command = getById('command-text').value.trim();

    if (!icon || !name || !command) return;

    if (editingCommandId) {
        const index = savedCommands.findIndex(c => c.id === editingCommandId);
        if (index !== -1) {
            savedCommands[index] = { ...savedCommands[index], icon, name, command };
        }
    } else {
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

function deleteCommand(id) {
    const command = savedCommands.find(c => c.id === id);
    if (!command) return;

    if (confirm(`Delete command "${command.name}"?`)) {
        savedCommands = savedCommands.filter(c => c.id !== id);
        saveCommands();
        renderCommands();
    }
}

function runSavedCommand(id) {
    const command = savedCommands.find(c => c.id === id);
    if (!command) return;

    if (typeof window.createNewTerminal === 'function') {
        window.createNewTerminal();
    }
    
    navigator.clipboard.writeText(command.command).then(() => {
        showToast(`📋 Copied: ${command.command}`, 'success');
    }).catch(err => {
        console.error('Failed to copy command:', err);
        showToast('Failed to copy command', 'error');
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

window.openAddCommandModal = openAddCommandModal;
window.editCommand = editCommand;
window.closeCommandModal = closeCommandModal;
window.deleteCommand = deleteCommand;
window.runSavedCommand = runSavedCommand;
window.loadSavedCommands = loadSavedCommands;

setTimeout(() => {
    const form = getById('command-form');
    if (form) {
        form.addEventListener('submit', handleCommandFormSubmit);
    }
}, 500);

export { openAddCommandModal, editCommand, deleteCommand, runSavedCommand, loadSavedCommands };
