// Terminal Logic: Multi-instance & Floating

let socket;
const activeTerminals = new Map(); // Map<termId, { term, fitAddon, element, prevSize }>

// Z-Index Management
let maxZIndex = 10001;

export function initTerminal() {
    if (typeof io === 'undefined' || typeof Terminal === 'undefined') {
        console.error('Libraries missing for Terminal');
        return;
    }

    // 1. Init Socket
    socket = io();

    // 2. Global Event Listeners
    socket.on('terminal:data', ({ termId, data }) => {
        const session = activeTerminals.get(termId);
        if (session) {
            session.term.write(data);
        }
    });
    
    socket.on('terminal:exit', ({ termId }) => {
       closeTerminalUI(termId); 
    });
}

/**
 * Tạo một cửa sổ terminal mới
 */
export function createNewTerminal() {
    const termId = 'term_' + Date.now();
    const layer = document.getElementById('floating-terminals-layer');
    
    // 1. Create DOM Elements
    const wrapper = document.createElement('div');
    wrapper.className = 'floating-terminal';
    wrapper.id = `wrapper-${termId}`;
    
    // Offset vị trí một chút nếu mở nhiều cái
    const offset = (activeTerminals.size % 10) * 30;
    wrapper.style.top = `${100 + offset}px`;
    wrapper.style.left = `${400 + offset}px`;
    wrapper.style.zIndex = ++maxZIndex;

    // HTML Template - Đã thêm Copy Buttons
    wrapper.innerHTML = `
        <div class="terminal-header" id="header-${termId}" ondblclick="window.toggleMinimize('${termId}')">
            <div class="terminal-title-group">
                <span>>_</span> Terminal (${activeTerminals.size + 1})
            </div>
            
            <!-- Copy Button Group -->
            <div class="terminal-copy-group" id="copy-group-${termId}">
                <button class="copy-btn copy-smart" onclick="window.copyTerminalLog('${termId}', 'smart')" title="Smart Copy (optimized for 3000 tokens)">
                    🧠 <span class="token-badge" id="badge-smart-${termId}">0</span>
                </button>
                <button class="copy-btn copy-errors" onclick="window.copyTerminalLog('${termId}', 'errors')" title="Errors Only (with context)">
                    ⚠️ <span class="token-badge" id="badge-errors-${termId}">0</span>
                </button>
                <button class="copy-btn copy-recent" onclick="window.copyTerminalLog('${termId}', 'recent')" title="Recent 200 lines">
                    📄 <span class="token-badge" id="badge-recent-${termId}">0</span>
                </button>
                <button class="copy-btn copy-all" onclick="window.copyTerminalLog('${termId}', 'all')" title="Copy All">
                    📦 <span class="token-badge" id="badge-all-${termId}">0</span>
                </button>
            </div>
            
            <!-- Clear Button -->
            <button class="term-btn-clear" onclick="window.clearTerminal('${termId}')" title="Clear Terminal">
                🗑️
            </button>
            
            <div class="terminal-controls">
                <button class="term-btn minimize" onclick="window.toggleMinimize('${termId}')" title="Minimize/Restore">-</button>
                <button class="term-btn maximize" onclick="window.toggleMaximize('${termId}')" title="Maximize">+</button>
                <button class="term-btn close" onclick="window.closeTerminal('${termId}')" title="Close">x</button>
            </div>
        </div>
        <div class="terminal-body" id="body-${termId}"></div>
    `;

    layer.appendChild(wrapper);

    // 2. Init xterm.js
    const term = new Terminal({
        cursorBlink: true,
        fontSize: 13,
        fontFamily: 'Menlo, Monaco, "Courier New", monospace',
        theme: {
            background: '#1e1e1e',
            foreground: '#f0f0f0'
        }
    });

    const fitAddon = new FitAddon.FitAddon();
    term.loadAddon(fitAddon);

    term.open(document.getElementById(`body-${termId}`));
    fitAddon.fit();

    // 3. Register Events
    
    // Bring to front on click
    wrapper.addEventListener('mousedown', () => {
        wrapper.style.zIndex = ++maxZIndex;
    });

    // Send input
    term.onData(data => {
        socket.emit('terminal:input', { termId, data });
    });

    // Resize Observer to refit terminal when window is resized
    const resizeObserver = new ResizeObserver(() => {
        // Chỉ fit lại nếu không bị minimized
        if (!wrapper.classList.contains('minimized')) {
            try {
                fitAddon.fit();
                socket.emit('terminal:resize', { 
                    termId, 
                    cols: term.cols, 
                    rows: term.rows 
                });
            } catch (e) {}
        }
    });
    resizeObserver.observe(document.getElementById(`body-${termId}`));

    // 4. Make Draggable
    makeDraggable(wrapper, document.getElementById(`header-${termId}`));

    // 5. Store Session with log buffer
    activeTerminals.set(termId, { 
        term, 
        fitAddon, 
        element: wrapper,
        logBuffer: [], // Local buffer for quick access
        partialLine: '' // Buffer for incomplete lines
    });

    // 6. Setup log buffer capture and token count updates
    // Listen to terminal's onData event (this fires for user input)
    // We need to listen to the actual output from the backend
    socket.on('terminal:data', ({ termId: dataTermId, data }) => {
        if (dataTermId !== termId) return;
        
        const session = activeTerminals.get(termId);
        if (!session) return;

        // Strip ANSI codes
        const cleanData = data.replace(
            // eslint-disable-next-line no-control-regex
            /\x1b\[[0-9;]*[a-zA-Z]|\x1b\][^\x07]*\x07|\x1b\][^\x1b]*\x1b\\/g,
            ''
        );
        
        // Accumulate partial line
        session.partialLine += cleanData;
        
        // Split by newlines and process complete lines
        const lines = session.partialLine.split(/\r?\n/);
        
        // Keep the last incomplete line in partialLine
        session.partialLine = lines.pop() || '';
        
        // Add complete lines to buffer
        lines.forEach(line => {
            if (line.trim().length > 0) {
                session.logBuffer.push(line);
                // Maintain max 10000 lines
                if (session.logBuffer.length > 10000) {
                    session.logBuffer.shift();
                }
            }
        });
        
        // Update token counts (debounced)
        if (lines.length > 0) {
            updateTokenCounts(termId);
        }
    });

    // 7. Get current project ID from API
    let currentProjectId = null;
    fetch('/api/projects')
        .then(res => res.json())
        .then(data => {
            currentProjectId = data.activeProjectId;
            
            // Store in session
            activeTerminals.get(termId).projectId = currentProjectId;
            
            // Init Backend Process with projectId
            socket.emit('terminal:init', { 
                termId, 
                cols: term.cols, 
                rows: term.rows,
                projectId: currentProjectId
            });
        })
        .catch(err => {
            console.error('Failed to get project info:', err);
            // Fallback without projectId
            socket.emit('terminal:init', { 
                termId, 
                cols: term.cols, 
                rows: term.rows
            });
        });
    
    // 8. Initial token count update
    setTimeout(() => updateTokenCounts(termId), 100);
    
    // Return termId so caller can use it
    return termId;
}

/**
 * Đóng terminal UI & Process
 */
export function closeTerminalUI(termId) {
    const session = activeTerminals.get(termId);
    if (session) {
        // Remove from DOM
        session.element.remove();
        // Clean map
        activeTerminals.delete(termId);
        // Tell server to kill
        socket.emit('terminal:kill', { termId });
    }
}

/**
 * Toggle Minimize/Restore
 */
export function toggleMinimize(termId) {
    const session = activeTerminals.get(termId);
    if (!session) return;
    
    const el = session.element;
    const isMinimized = el.classList.contains('minimized');

    if (isMinimized) {
        // Restore
        el.classList.remove('minimized');
        
        // Restore size logic if needed, but CSS transition handles visualization
        // Need to refit xterm after transition
        setTimeout(() => {
            try { session.fitAddon.fit(); } catch(e){}
        }, 250);
    } else {
        // Minimize
        // Store current width/height if we want to restore exact pixel values later
        // (CSS handles the visual hiding)
        el.classList.add('minimized');
    }
}

/**
 * Toggle Maximize (Simple Fullscreen simulation)
 */
export function toggleMaximize(termId) {
    const session = activeTerminals.get(termId);
    if (!session) return;
    
    const el = session.element;
    const isMaximized = el.classList.contains('maximized');

    if (isMaximized) {
        // Restore normal size
        el.classList.remove('maximized');
        el.style.width = session.prevSize?.width || '600px';
        el.style.height = session.prevSize?.height || '400px';
        el.style.top = session.prevSize?.top || '100px';
        el.style.left = session.prevSize?.left || '400px';
    } else {
        // Save current state
        session.prevSize = {
            width: el.style.width,
            height: el.style.height,
            top: el.style.top,
            left: el.style.left
        };
        
        // Go full "floating" screen
        el.classList.add('maximized');
        el.style.width = '90vw';
        el.style.height = '80vh';
        el.style.top = '10vh';
        el.style.left = '5vw';
        el.classList.remove('minimized'); // Ensure not minimized
    }
    
    setTimeout(() => {
        try { session.fitAddon.fit(); } catch(e){}
    }, 250);
}


/**
 * Logic Drag & Drop
 */
function makeDraggable(element, handle) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    
    handle.onmousedown = dragMouseDown;

    function dragMouseDown(e) {
        // Don't drag if clicking buttons
        if(e.target.tagName === 'BUTTON') return;

        e.preventDefault();
        // Get mouse cursor position at startup
        pos3 = e.clientX;
        pos4 = e.clientY;
        document.onmouseup = closeDragElement;
        // Call function whenever cursor moves
        document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
        e.preventDefault();
        // Calculate new cursor position
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;
        // Set element's new position
        element.style.top = (element.offsetTop - pos2) + "px";
        element.style.left = (element.offsetLeft - pos1) + "px";
    }

    function closeDragElement() {
        // Stop moving when mouse button is released
        document.onmouseup = null;
        document.onmousemove = null;
    }
}

/**
 * Copy terminal log with specified strategy
 * @param {string} termId - Terminal ID
 * @param {string} strategy - 'smart' | 'errors' | 'recent' | 'all'
 */
async function copyTerminalLog(termId, strategy) {
    const session = activeTerminals.get(termId);
    if (!session || !session.logBuffer || session.logBuffer.length === 0) {
        showToast('⚠️ No logs to copy', 'warning');
        return;
    }

    try {
        // Use SmartCopyEngine to generate content
        let result;
        const lines = session.logBuffer;

        switch (strategy) {
            case 'smart':
                result = window.SmartCopyEngine.generateSmartCopy(lines, 3000);
                break;
            case 'errors':
                result = window.SmartCopyEngine.generateErrorsOnly(lines);
                break;
            case 'recent':
                result = window.SmartCopyEngine.generateRecent(lines, 200);
                break;
            case 'all':
                result = window.SmartCopyEngine.generateCopyAll(lines);
                break;
            default:
                result = window.SmartCopyEngine.generateSmartCopy(lines, 3000);
        }

        // Copy to clipboard
        await navigator.clipboard.writeText(result.content);

        // Show success toast with details
        const strategyNames = {
            smart: '🧠 Smart',
            errors: '⚠️ Errors',
            recent: '📄 Recent',
            all: '📦 All'
        };

        let message = `✅ Copied ${result.tokens} tokens (${strategyNames[strategy]})`;
        
        if (result.stats && result.stats.message) {
            message += `\n${result.stats.message}`;
        }

        if (result.warning) {
            message += `\n${result.warning}`;
        }

        showToast(message, 'success');

    } catch (error) {
        console.error('Copy failed:', error);
        showToast('❌ Failed to copy logs', 'error');
    }
}

/**
 * Update token count badges for a terminal
 * Debounced to avoid excessive updates
 */
let updateTokenCountsTimeout = null;
function updateTokenCounts(termId) {
    // Debounce updates
    clearTimeout(updateTokenCountsTimeout);
    updateTokenCountsTimeout = setTimeout(() => {
        const session = activeTerminals.get(termId);
        if (!session || !session.logBuffer) return;

        const analysis = window.SmartCopyEngine.analyzeLogBuffer(session.logBuffer);

        // Update badges
        updateBadge(`badge-smart-${termId}`, analysis.smart.tokens);
        updateBadge(`badge-errors-${termId}`, analysis.errors.tokens);
        updateBadge(`badge-recent-${termId}`, analysis.recent.tokens);
        updateBadge(`badge-all-${termId}`, analysis.all.tokens);
    }, 500); // 500ms debounce
}

/**
 * Update a single badge element
 */
function updateBadge(badgeId, tokens) {
    const badge = document.getElementById(badgeId);
    if (badge) {
        badge.textContent = formatTokenCount(tokens);
    }
}

/**
 * Format token count for display
 */
function formatTokenCount(tokens) {
    if (tokens === 0) return '0';
    if (tokens < 1000) return tokens.toString();
    if (tokens < 10000) return (tokens / 1000).toFixed(1) + 'k';
    return Math.floor(tokens / 1000) + 'k';
}

/**
 * Show toast notification
 */
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    if (!toast) return;

    toast.textContent = message;
    toast.className = 'toast show';
    
    if (type === 'success') {
        toast.style.background = '#28a745';
    } else if (type === 'error') {
        toast.style.background = '#dc3545';
    } else if (type === 'warning') {
        toast.style.background = '#ffc107';
        toast.style.color = '#000';
    } else {
        toast.style.background = '#007bff';
    }

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

/**
 * Clear terminal display and log buffer
 * @param {string} termId - Terminal ID
 */
function clearTerminal(termId) {
    const session = activeTerminals.get(termId);
    if (!session) return;

    // Clear the xterm display
    session.term.clear();
    
    // Clear the log buffer
    session.logBuffer = [];
    session.partialLine = '';
    
    // Reset token counts to 0
    updateBadge(`badge-smart-${termId}`, 0);
    updateBadge(`badge-errors-${termId}`, 0);
    updateBadge(`badge-recent-${termId}`, 0);
    updateBadge(`badge-all-${termId}`, 0);
    
    // Show toast notification
    showToast('🗑️ Terminal cleared', 'info');
}

/**
 * Update terminal visibility based on active project
 * @param {string} activeProjectId - Active project ID
 */
function updateTerminalVisibility(activeProjectId) {
    activeTerminals.forEach((session, termId) => {
        const shouldShow = !session.projectId || session.projectId === activeProjectId;
        session.element.style.display = shouldShow ? 'block' : 'none';
    });
    
    const visibleCount = Array.from(activeTerminals.values())
        .filter(s => s.element.style.display !== 'none').length;
    
    console.log(`Updated terminal visibility: ${visibleCount} visible for project ${activeProjectId}`);
}

// Global Exports for HTML onclick
window.createNewTerminal = createNewTerminal;
window.closeTerminal = closeTerminalUI;
window.toggleMinimize = toggleMinimize;
window.toggleMaximize = toggleMaximize;
window.copyTerminalLog = copyTerminalLog;
window.clearTerminal = clearTerminal;
window.updateTerminalVisibility = updateTerminalVisibility;
