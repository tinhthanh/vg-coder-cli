import { io } from 'socket.io-client';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { getById, showToast } from '../utils.js';

let socket;
const activeTerminals = new Map();
let maxZIndex = 10001;

export function initTerminal() {
    socket = io('http://localhost:6868'); // Force connect to localhost

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
    const layer = getById('floating-terminals-layer'); // Use getById
    
    if (!layer) {
        console.error('Terminal layer not found');
        return;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'floating-terminal';
    wrapper.id = `wrapper-${termId}`;
    
    const offset = (activeTerminals.size % 10) * 30;
    wrapper.style.top = `${100 + offset}px`;
    wrapper.style.left = `${400 + offset}px`;
    wrapper.style.zIndex = ++maxZIndex;

    wrapper.innerHTML = `
        <div class="terminal-header" id="header-${termId}" ondblclick="window.toggleMinimize('${termId}')">
            <div class="terminal-title-group"><span>>_</span> Terminal (${activeTerminals.size + 1})</div>
            <div class="terminal-controls">
                <button class="term-btn minimize" onclick="window.toggleMinimize('${termId}')">-</button>
                <button class="term-btn maximize" onclick="window.toggleMaximize('${termId}')">+</button>
                <button class="term-btn close" onclick="window.closeTerminal('${termId}')">x</button>
            </div>
        </div>
        <div class="terminal-body" id="body-${termId}"></div>
    `;

    layer.appendChild(wrapper);

    // Initialize Xterm
    const term = new Terminal({
        cursorBlink: true,
        fontSize: 13,
        fontFamily: 'Menlo, Monaco, "Courier New", monospace',
        theme: { background: '#1e1e1e', foreground: '#f0f0f0' }
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    // Find body element within wrapper (since it's already attached to Shadow DOM via layer)
    const bodyEl = wrapper.querySelector(`#body-${termId}`);
    term.open(bodyEl);
    fitAddon.fit();

    wrapper.addEventListener('mousedown', () => { wrapper.style.zIndex = ++maxZIndex; });

    term.onData(data => { socket.emit('terminal:input', { termId, data }); });

    const resizeObserver = new ResizeObserver(() => {
        if (!wrapper.classList.contains('minimized')) {
            try {
                fitAddon.fit();
                socket.emit('terminal:resize', { termId, cols: term.cols, rows: term.rows });
            } catch (e) {}
        }
    });
    resizeObserver.observe(bodyEl);

    // Drag Logic specific for Shadow DOM (needs root context)
    makeDraggable(wrapper, wrapper.querySelector(`#header-${termId}`));

    activeTerminals.set(termId, { term, fitAddon, element: wrapper, logBuffer: [] });

    // Initial socket init
    fetch('http://localhost:6868/api/projects')
        .then(res => res.json())
        .then(data => {
            socket.emit('terminal:init', { termId, cols: term.cols, rows: term.rows, projectId: data.activeProjectId });
        })
        .catch(() => {
            socket.emit('terminal:init', { termId, cols: term.cols, rows: term.rows });
        });
    
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
        setTimeout(() => { try { session.fitAddon.fit(); } catch(e){} }, 250);
    }
}

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
