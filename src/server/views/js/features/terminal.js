import { io } from 'socket.io-client';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { getById, showToast } from '../utils.js';
import { countTokens as countTokensAPI } from '../api.js';

let socket;
const activeTerminals = new Map();
let maxZIndex = 10001;

export function initTerminal() {
    // Force connect to localhost
    socket = io('http://localhost:6868');

    socket.on('terminal:data', ({ termId, data }) => {
        const session = activeTerminals.get(termId);
        if (session) session.term.write(data);
    });
    
    socket.on('terminal:exit', ({ termId }) => {
       closeTerminalUI(termId); 
    });
}

export function createNewTerminal() {
    const termId = 'term_' + Date.now();
    const layer = getById('floating-terminals-layer');
    
    if (!layer) {
        console.error('Terminal layer not found');
        return;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'floating-terminal';
    wrapper.id = `wrapper-${termId}`;
    
    // Position offset
    const offset = (activeTerminals.size % 10) * 30;
    wrapper.style.top = `${100 + offset}px`;
    wrapper.style.left = `${400 + offset}px`;
    wrapper.style.zIndex = ++maxZIndex;

    // --- HTML STRUCTURE: Header + Body + Separate Input ---
    wrapper.innerHTML = `
        <div class="terminal-header" id="header-${termId}">
            <div class="terminal-title-group">
                <span>>_</span> Terminal (${activeTerminals.size + 1})
                <span class="terminal-token-count" id="token-count-${termId}">0 tokens</span>
            </div>
            <div class="terminal-controls">
                <button class="term-btn copy-logs" onclick="window.copyTerminalLogs('${termId}')" title="Copy Logs">📋</button>
                <button class="term-btn minimize" onclick="window.toggleMinimize('${termId}')">-</button>
                <button class="term-btn maximize" onclick="window.toggleMaximize('${termId}')">+</button>
                <button class="term-btn close" onclick="window.closeTerminal('${termId}')">x</button>
            </div>
        </div>
        <div class="terminal-body" id="body-${termId}"></div>
        <div class="terminal-input-row">
            <span class="terminal-prompt">➜</span>
            <input type="text" class="terminal-input" id="input-${termId}" placeholder="Type command here..." autocomplete="off" spellcheck="false" />
        </div>
    `;

    layer.appendChild(wrapper);

    // --- XTERM CONFIG: Disable Direct Input ---
    const term = new Terminal({
        cursorBlink: true,
        fontSize: 13,
        fontFamily: 'Menlo, Monaco, "Courier New", monospace',
        theme: { background: '#1e1e1e', foreground: '#f0f0f0' },
        disableStdin: true, // CRITICAL: Stop typing directly into xterm
        rows: 18 // Slightly less to make room for input row
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    const bodyEl = wrapper.querySelector(`#body-${termId}`);
    term.open(bodyEl);
    
    // Fit Logic
    setTimeout(() => {
        try {
            fitAddon.fit();
            const cols = term.cols || 80;
            const rows = term.rows || 18;

            fetch('http://localhost:6868/api/projects')
            .then(res => res.json())
            .then(data => {
                socket.emit('terminal:init', { termId, cols, rows, projectId: data.activeProjectId });
            })
            .catch(() => {
                socket.emit('terminal:init', { termId, cols, rows });
            });
        } catch(e) {}
    }, 100);

    // --- INPUT HANDLING ---
    const inputEl = wrapper.querySelector(`#input-${termId}`);
    
    inputEl.addEventListener('keydown', (e) => {
        // Handle ENTER: Send command
        if (e.key === 'Enter') {
            const command = inputEl.value;
            // Send to server with carriage return
            socket.emit('terminal:input', { termId, data: command + '\r' });
            
            // Clear input
            inputEl.value = '';
            
            // Scroll xterm to bottom to see result
            term.scrollToBottom();
        }
        
        // Handle CTRL+C: Send interrupt signal
        if (e.ctrlKey && e.key === 'c') {
            socket.emit('terminal:input', { termId, data: '\x03' }); // ASCII ETX
            e.preventDefault();
        }
        
        // Handle Arrow Up/Down for history could be implemented here locally if needed,
        // but typically shells handle history. Since we send raw chars, remote shell history works 
        // IF we were typing in xterm. With separate input, we lose shell history navigation 
        // unless we implement a local history buffer here.
        // For now, let's keep it simple.
    });

    // Auto-focus input when clicking anywhere on the wrapper
    wrapper.addEventListener('mousedown', (e) => { 
        wrapper.style.zIndex = ++maxZIndex;
        // Don't focus if clicking buttons
        if (e.target.tagName !== 'BUTTON') {
             // Delay focus slightly to ensure drag didn't start
             setTimeout(() => inputEl.focus(), 10);
        }
    });

    // Window Controls
    const header = wrapper.querySelector(`#header-${termId}`);
    header.addEventListener('dblclick', () => window.toggleMinimize(termId));
    makeDraggable(wrapper, header);

    activeTerminals.set(termId, { term, fitAddon, element: wrapper });
    
    // Focus input immediately
    inputEl.focus();

    return termId;
}

export function closeTerminalUI(termId) {
    const session = activeTerminals.get(termId);
    if (session) {
        session.element.remove();
        activeTerminals.delete(termId);
        socket.emit('terminal:kill', { termId });
    }
}

export function toggleMinimize(termId) {
    const session = activeTerminals.get(termId);
    if (session) session.element.classList.toggle('minimized');
}

export function toggleMaximize(termId) {
    const session = activeTerminals.get(termId);
    if (session) {
        session.element.classList.toggle('maximized');
        setTimeout(() => { 
            try { 
                session.fitAddon.fit(); 
                socket.emit('terminal:resize', { termId, cols: session.term.cols, rows: session.term.rows });
            } catch(e){} 
        }, 250);
    }
}

/**
 * Copy terminal logs to clipboard with token count
 */
export async function copyTerminalLogs(termId) {
    const session = activeTerminals.get(termId);
    if (!session) {
        showToast('Terminal not found', 'error');
        return;
    }
    
    try {
        // Get terminal buffer content
        const term = session.term;
        const buffer = term.buffer.active;
        const lines = [];
        
        // Extract all lines from buffer
        for (let i = 0; i < buffer.length; i++) {
            const line = buffer.getLine(i);
            if (line) {
                lines.push(line.translateToString(true));
            }
        }
        
        const logsText = lines.join('\n').trim();
        
        if (!logsText) {
            showToast('No logs to copy', 'info');
            return;
        }
        
        // Copy to clipboard first (fast)
        await navigator.clipboard.writeText(logsText);
        
        // Then count tokens via API (accurate)
        try {
            const tokens = await countTokensAPI(logsText);
            
            // Update token count display
            updateTokenCount(termId, tokens);
            
            // Show toast
            showToast(`📋 Copied ${tokens.toLocaleString()} tokens`, 'success');
        } catch (err) {
            console.error('[Terminal] Token counting error:', err);
            // Still copied to clipboard, just show basic message
            showToast('📋 Copied to clipboard', 'success');
        }
        
    } catch (err) {
        console.error('[Terminal] Copy logs error:', err);
        showToast('Error copying logs', 'error');
    }
}

/**
 * Update token count display in terminal header
 */
function updateTokenCount(termId, tokens) {
    const tokenEl = getById(`token-count-${termId}`);
    if (tokenEl) {
        tokenEl.textContent = `${tokens.toLocaleString()} tokens`;
    }
}

// Remove old simple countTokens function - no longer needed

function makeDraggable(element, handle) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    handle.onmousedown = dragMouseDown;

    function dragMouseDown(e) {
        if(e.target.tagName === 'BUTTON') return;
        e.preventDefault();
        pos3 = e.clientX;
        pos4 = e.clientY;
        document.onmouseup = closeDragElement;
        document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
        e.preventDefault();
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;
        element.style.top = (element.offsetTop - pos2) + "px";
        element.style.left = (element.offsetLeft - pos1) + "px";
    }

    function closeDragElement() {
        document.onmouseup = null;
        document.onmousemove = null;
    }
}

window.createNewTerminal = createNewTerminal;
window.closeTerminal = closeTerminalUI;
window.toggleMinimize = toggleMinimize;
window.toggleMaximize = toggleMaximize;
window.copyTerminalLogs = copyTerminalLogs;
