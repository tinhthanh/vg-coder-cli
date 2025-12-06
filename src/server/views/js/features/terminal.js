// Terminal Logic: Multi-instance & Floating

let socket;
const activeTerminals = new Map(); // Map<termId, { term, fitAddon, element }>

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
    wrapper.style.top = '100px';
    wrapper.style.left = '100px';
    // Offset vị trí một chút nếu mở nhiều cái
    const offset = activeTerminals.size * 30;
    wrapper.style.top = `${100 + offset}px`;
    wrapper.style.left = `${400 + offset}px`;
    wrapper.style.zIndex = ++maxZIndex;

    wrapper.innerHTML = `
        <div class="terminal-header" id="header-${termId}">
            <div class="terminal-title-group">
                <span>>_</span> Terminal (${activeTerminals.size + 1})
            </div>
            <div class="terminal-controls">
                <button class="term-btn close" onclick="window.closeTerminal('${termId}')" title="Close"></button>
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
        try {
            fitAddon.fit();
            socket.emit('terminal:resize', { 
                termId, 
                cols: term.cols, 
                rows: term.rows 
            });
        } catch (e) {}
    });
    resizeObserver.observe(document.getElementById(`body-${termId}`));

    // 4. Make Draggable
    makeDraggable(wrapper, document.getElementById(`header-${termId}`));

    // 5. Store Session
    activeTerminals.set(termId, { term, fitAddon, element: wrapper });

    // 6. Init Backend Process
    socket.emit('terminal:init', { 
        termId, 
        cols: term.cols, 
        rows: term.rows 
    });
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
 * Logic Drag & Drop
 */
function makeDraggable(element, handle) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    
    handle.onmousedown = dragMouseDown;

    function dragMouseDown(e) {
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

// Global Exports for HTML onclick
window.createNewTerminal = createNewTerminal;
window.closeTerminal = closeTerminalUI;
