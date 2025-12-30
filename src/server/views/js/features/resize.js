import { qs, getById } from '../utils.js';

export function initResizeHandler() {
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
        }
    });
}
