import { qs, getById } from '../utils.js';

export function initResizeHandler() {
    const leftPanel = qs('.left-panel');
    const handle = getById('resize-handler');

    if (!leftPanel || !handle) {
        return;
    }

    let isResizing = false;
    let startX = 0;
    let startWidth = 0;

    handle.addEventListener('mousedown', (e) => {
        isResizing = true;
        startX = e.clientX;
        startWidth = leftPanel.getBoundingClientRect().width;
        
        document.body.classList.add('resizing');
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;

        requestAnimationFrame(() => {
            const currentX = e.clientX;
            const diffX = currentX - startX;
            const newWidth = Math.max(250, startWidth + diffX);
            const maxWidth = window.innerWidth - 300;

            if (newWidth < maxWidth) {
                leftPanel.style.flex = `0 0 ${newWidth}px`;
                leftPanel.style.width = `${newWidth}px`;
            }
        });
    });

    document.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            document.body.classList.remove('resizing');
        }
    });
}
