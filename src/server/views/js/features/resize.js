/**
 * Feature: Left Panel Resize
 * Allows the user to drag the right edge of the left panel to resize it.
 */

export function initResizeHandler() {
    const leftPanel = document.querySelector('.left-panel');
    const handle = document.getElementById('resize-handler'); // Match the ID we will add in HTML
    const splitLayout = document.querySelector('.split-layout');

    if (!leftPanel || !handle) {
        console.warn('Resize elements not found');
        return;
    }

    let isResizing = false;
    let startX = 0;
    let startWidth = 0;

    // Mouse Down
    handle.addEventListener('mousedown', (e) => {
        isResizing = true;
        startX = e.clientX;
        startWidth = leftPanel.getBoundingClientRect().width;
        
        // Add resizing class for styling/cursor
        document.body.classList.add('resizing');
        
        // Disable text selection during drag
        e.preventDefault();
    });

    // Mouse Move
    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;

        requestAnimationFrame(() => {
            const currentX = e.clientX;
            const diffX = currentX - startX;
            const newWidth = Math.max(250, startWidth + diffX); // Min width 250px
            const maxWidth = window.innerWidth - 300; // Leave space for right panel

            if (newWidth < maxWidth) {
                leftPanel.style.flex = `0 0 ${newWidth}px`;
                leftPanel.style.width = `${newWidth}px`;
            }
        });
    });

    // Mouse Up
    document.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            document.body.classList.remove('resizing');
        }
    });
}
