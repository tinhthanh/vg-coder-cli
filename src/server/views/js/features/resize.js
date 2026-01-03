import { qs, getById } from '../utils.js';

const STORAGE_KEY_LEFT_WIDTH = 'vg-coder-left-panel-width';
const STORAGE_KEY_RIGHT_WIDTH = 'vg-coder-right-panel-width';

export function initResizeHandler() {
    initLeftResizeHandler();
    initRightResizeHandler();
    loadSavedWidths();
}

/**
 * Load saved panel widths from localStorage
 */
function loadSavedWidths() {
    const leftWidth = localStorage.getItem(STORAGE_KEY_LEFT_WIDTH);
    const rightWidth = localStorage.getItem(STORAGE_KEY_RIGHT_WIDTH);

    const leftContainer = getById('tool-panel-container');
    const rightContainer = getById('tool-panel-container-right');

    if (leftWidth && leftContainer) {
        leftContainer.style.width = leftWidth;
        console.log('[Resize] Loaded left panel width:', leftWidth);
    }

    if (rightWidth && rightContainer) {
        rightContainer.style.width = rightWidth;
        console.log('[Resize] Loaded right panel width:', rightWidth);
    }
}

/**
 * Save panel width to localStorage
 */
function saveWidth(key, width) {
    try {
        localStorage.setItem(key, `${width}px`);
    } catch (e) {
        console.warn('[Resize] Failed to save width:', e);
    }
}

/**
 * Initialize resize handler for left tool panel
 */
function initLeftResizeHandler() {
    const toolPanelContainer = getById('tool-panel-container');
    const handle = getById('resize-handler');

    if (!toolPanelContainer || !handle) {
        return;
    }

    let isResizing = false;
    let startX = 0;
    let startWidth = 0;

    handle.addEventListener('mousedown', (e) => {
        isResizing = true;
        startX = e.clientX;
        startWidth = toolPanelContainer.getBoundingClientRect().width;
        
        document.body.classList.add('resizing');
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;

        requestAnimationFrame(() => {
            const currentX = e.clientX;
            const diffX = currentX - startX;
            const newWidth = Math.max(250, Math.min(600, startWidth + diffX)); // Min 250px, Max 600px
            
            // Update width of tool-panel-container
            toolPanelContainer.style.width = `${newWidth}px`;
        });
    });

    document.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            document.body.classList.remove('resizing');
            
            // Save width to localStorage
            const finalWidth = toolPanelContainer.getBoundingClientRect().width;
            saveWidth(STORAGE_KEY_LEFT_WIDTH, finalWidth);
        }
    });

    console.log('[Resize] Left resize handler initialized');
}

/**
 * Initialize resize handler for right tool panel
 */
function initRightResizeHandler() {
    const toolPanelContainerRight = getById('tool-panel-container-right');
    const handleRight = getById('resize-handler-right');

    if (!toolPanelContainerRight || !handleRight) {
        return;
    }

    let isResizing = false;
    let startX = 0;
    let startWidth = 0;

    handleRight.addEventListener('mousedown', (e) => {
        isResizing = true;
        startX = e.clientX;
        startWidth = toolPanelContainerRight.getBoundingClientRect().width;
        
        document.body.classList.add('resizing');
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;

        requestAnimationFrame(() => {
            const currentX = e.clientX;
            // For right panel, dragging left (negative diff) should increase width
            const diffX = startX - currentX; // Inverted direction
            const newWidth = Math.max(250, Math.min(600, startWidth + diffX)); // Min 250px, Max 600px
            
            // Update width of tool-panel-container-right
            toolPanelContainerRight.style.width = `${newWidth}px`;
        });
    });

    document.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            document.body.classList.remove('resizing');
            
            // Save width to localStorage
            const finalWidth = toolPanelContainerRight.getBoundingClientRect().width;
            saveWidth(STORAGE_KEY_RIGHT_WIDTH, finalWidth);
        }
    });

    console.log('[Resize] Right resize handler initialized');
}
