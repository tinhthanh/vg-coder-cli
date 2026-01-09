/**
 * Mermaid Viewer - Fullscreen modal with zoom, pan, and scale controls
 * Inspired by mermaid.live interface
 */

// State for pan and zoom
let viewerState = {
    scale: 1,
    translateX: 0,
    translateY: 0,
    isDragging: false,
    startX: 0,
    startY: 0
};

// Constants
const MIN_SCALE = 0.1;
const MAX_SCALE = 15;
const SCALE_STEP = 0.25;
const Z_INDEX = '9999999999';

/**
 * Create mermaid toolbar buttons for diagram wrapper
 */
export function createMermaidToolbar(code, svg) {
    const toolbar = document.createElement('div');
    toolbar.className = 'mermaid-toolbar';
    Object.assign(toolbar.style, {
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '4px',
        padding: '8px 12px',
        background: 'rgba(0, 0, 0, 0.3)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
    });
    
    toolbar.innerHTML = `
        <button class="mermaid-toolbar-btn" data-action="copy" title="Copy Mermaid Code" style="${getButtonStyle()}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
        </button>
        <button class="mermaid-toolbar-btn" data-action="fullscreen" title="Open Fullscreen Viewer" style="${getButtonStyle()}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="15 3 21 3 21 9"></polyline>
                <polyline points="9 21 3 21 3 15"></polyline>
                <line x1="21" y1="3" x2="14" y2="10"></line>
                <line x1="3" y1="21" x2="10" y2="14"></line>
            </svg>
        </button>
    `;
    
    // Copy button handler
    toolbar.querySelector('[data-action="copy"]').addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
            await navigator.clipboard.writeText(code);
            showToast(toolbar.parentElement, 'Copied!');
        } catch (err) {
            console.error('[MermaidViewer] Copy failed:', err);
            showToast(toolbar.parentElement, 'Copy failed', true);
        }
    });
    
    // Fullscreen button handler
    toolbar.querySelector('[data-action="fullscreen"]').addEventListener('click', (e) => {
        e.stopPropagation();
        openMermaidViewer(svg, code);
    });
    
    return toolbar;
}

/**
 * Open fullscreen mermaid viewer with zoom/pan controls
 */
export function openMermaidViewer(svg, code) {
    // Remove any existing modal
    const existingModal = document.querySelector('.mermaid-viewer-modal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Reset state
    viewerState = {
        scale: 1,
        translateX: 0,
        translateY: 0,
        isDragging: false,
        startX: 0,
        startY: 0
    };
    
    // Create modal
    const modal = document.createElement('div');
    modal.className = 'mermaid-viewer-modal';
    Object.assign(modal.style, {
        position: 'fixed',
        top: '0',
        left: '0',
        right: '0',
        bottom: '0',
        width: '100vw',
        height: '100vh',
        background: 'rgba(10, 10, 15, 0.95)',
        zIndex: Z_INDEX,
        display: 'flex',
        flexDirection: 'column',
        opacity: '0',
        transition: 'opacity 0.2s ease'
    });
    
    modal.innerHTML = `
        <div class="mermaid-viewer-header" style="${getHeaderStyle()}">
            <div class="mermaid-viewer-title" style="display: flex; align-items: center; gap: 12px;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#a855f7" stroke-width="2">
                    <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
                    <polyline points="2 17 12 22 22 17"></polyline>
                    <polyline points="2 12 12 17 22 12"></polyline>
                </svg>
                <span style="font-size: 14px; font-weight: 600; color: #ededed;">Mermaid Diagram Viewer</span>
            </div>
            <div class="mermaid-viewer-controls" style="display: flex; align-items: center; gap: 8px;">
                <div class="mermaid-viewer-zoom-controls" style="display: flex; align-items: center; gap: 4px; background: rgba(255,255,255,0.05); border-radius: 6px; padding: 4px;">
                    <button data-action="zoom-out" title="Zoom Out" style="${getControlButtonStyle()}">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="11" cy="11" r="8"></circle>
                            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                            <line x1="8" y1="11" x2="14" y2="11"></line>
                        </svg>
                    </button>
                    <span class="zoom-level" style="min-width: 50px; text-align: center; font-size: 12px; color: #a1a1aa;">100%</span>
                    <button data-action="zoom-in" title="Zoom In" style="${getControlButtonStyle()}">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="11" cy="11" r="8"></circle>
                            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                            <line x1="11" y1="8" x2="11" y2="14"></line>
                            <line x1="8" y1="11" x2="14" y2="11"></line>
                        </svg>
                    </button>
                </div>
                <button data-action="fit" title="Fit to Screen" style="${getControlButtonStyle()}">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
                    </svg>
                </button>
                <button data-action="reset" title="Reset View" style="${getControlButtonStyle()}">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="1 4 1 10 7 10"></polyline>
                        <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
                    </svg>
                </button>
                <div style="width: 1px; height: 24px; background: rgba(255,255,255,0.1); margin: 0 8px;"></div>
                <button data-action="copy" title="Copy Code" style="${getControlButtonStyle()}">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                </button>
                <button data-action="close" title="Close (Esc)" style="${getCloseButtonStyle()}">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>
        </div>
        <div class="mermaid-viewer-canvas" style="${getCanvasStyle()}">
            <div class="mermaid-viewer-content" style="${getContentStyle()}">
                ${svg}
            </div>
        </div>
        <div class="mermaid-viewer-footer" style="${getFooterStyle()}">
            <span style="color: #71717a; font-size: 11px;">
                🖱️ Scroll to zoom • Drag to pan • Double-click to reset
            </span>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Get elements
    const canvas = modal.querySelector('.mermaid-viewer-canvas');
    const content = modal.querySelector('.mermaid-viewer-content');
    const zoomLevel = modal.querySelector('.zoom-level');
    
    // Update transform
    const updateTransform = () => {
        content.style.transform = `translate(${viewerState.translateX}px, ${viewerState.translateY}px) scale(${viewerState.scale})`;
        zoomLevel.textContent = `${Math.round(viewerState.scale * 100)}%`;
    };
    
    // Zoom function
    const zoom = (delta, centerX = null, centerY = null) => {
        const oldScale = viewerState.scale;
        const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, viewerState.scale + delta));
        
        if (centerX !== null && centerY !== null) {
            // Zoom towards cursor position
            const rect = canvas.getBoundingClientRect();
            const x = centerX - rect.left - rect.width / 2;
            const y = centerY - rect.top - rect.height / 2;
            
            const scaleRatio = newScale / oldScale;
            viewerState.translateX = x - (x - viewerState.translateX) * scaleRatio;
            viewerState.translateY = y - (y - viewerState.translateY) * scaleRatio;
        }
        
        viewerState.scale = newScale;
        updateTransform();
    };
    
    // Fit to screen
    const fitToScreen = () => {
        const svgEl = content.querySelector('svg');
        if (!svgEl) return;
        
        const canvasRect = canvas.getBoundingClientRect();
        const svgRect = svgEl.getBoundingClientRect();
        
        // Calculate scale to fit with padding
        const padding = 80;
        const scaleX = (canvasRect.width - padding) / (svgRect.width / viewerState.scale);
        const scaleY = (canvasRect.height - padding) / (svgRect.height / viewerState.scale);
        
        viewerState.scale = Math.min(scaleX, scaleY, 2); // Max 200% on fit
        viewerState.translateX = 0;
        viewerState.translateY = 0;
        updateTransform();
    };
    
    // Reset view
    const resetView = () => {
        viewerState.scale = 1;
        viewerState.translateX = 0;
        viewerState.translateY = 0;
        updateTransform();
    };
    
    // Close modal
    const closeModal = () => {
        modal.style.opacity = '0';
        setTimeout(() => modal.remove(), 200);
        document.removeEventListener('keydown', keyHandler);
    };
    
    // Key handler
    const keyHandler = (e) => {
        if (e.key === 'Escape') closeModal();
        if (e.key === '+' || e.key === '=') zoom(SCALE_STEP);
        if (e.key === '-') zoom(-SCALE_STEP);
        if (e.key === '0') resetView();
        if (e.key === 'f') fitToScreen();
    };
    document.addEventListener('keydown', keyHandler);
    
    // Wheel zoom
    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -SCALE_STEP : SCALE_STEP;
        zoom(delta, e.clientX, e.clientY);
    }, { passive: false });
    
    // Pan with mouse drag
    canvas.addEventListener('mousedown', (e) => {
        if (e.target.closest('button')) return;
        viewerState.isDragging = true;
        viewerState.startX = e.clientX - viewerState.translateX;
        viewerState.startY = e.clientY - viewerState.translateY;
        canvas.style.cursor = 'grabbing';
    });
    
    canvas.addEventListener('mousemove', (e) => {
        if (!viewerState.isDragging) return;
        viewerState.translateX = e.clientX - viewerState.startX;
        viewerState.translateY = e.clientY - viewerState.startY;
        updateTransform();
    });
    
    canvas.addEventListener('mouseup', () => {
        viewerState.isDragging = false;
        canvas.style.cursor = 'grab';
    });
    
    canvas.addEventListener('mouseleave', () => {
        viewerState.isDragging = false;
        canvas.style.cursor = 'grab';
    });
    
    // Double click to reset
    canvas.addEventListener('dblclick', resetView);
    
    // Touch support for mobile
    let lastTouchDistance = 0;
    canvas.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2) {
            lastTouchDistance = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
        } else if (e.touches.length === 1) {
            viewerState.isDragging = true;
            viewerState.startX = e.touches[0].clientX - viewerState.translateX;
            viewerState.startY = e.touches[0].clientY - viewerState.translateY;
        }
    }, { passive: true });
    
    canvas.addEventListener('touchmove', (e) => {
        if (e.touches.length === 2) {
            e.preventDefault();
            const distance = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            const delta = (distance - lastTouchDistance) * 0.01;
            zoom(delta);
            lastTouchDistance = distance;
        } else if (e.touches.length === 1 && viewerState.isDragging) {
            viewerState.translateX = e.touches[0].clientX - viewerState.startX;
            viewerState.translateY = e.touches[0].clientY - viewerState.startY;
            updateTransform();
        }
    }, { passive: false });
    
    canvas.addEventListener('touchend', () => {
        viewerState.isDragging = false;
    });
    
    // Button handlers
    modal.querySelector('[data-action="zoom-in"]').addEventListener('click', () => zoom(SCALE_STEP));
    modal.querySelector('[data-action="zoom-out"]').addEventListener('click', () => zoom(-SCALE_STEP));
    modal.querySelector('[data-action="fit"]').addEventListener('click', fitToScreen);
    modal.querySelector('[data-action="reset"]').addEventListener('click', resetView);
    modal.querySelector('[data-action="close"]').addEventListener('click', closeModal);
    
    // Copy button
    modal.querySelector('[data-action="copy"]').addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(code);
            const btn = modal.querySelector('[data-action="copy"]');
            btn.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="2">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
            `;
            setTimeout(() => {
                btn.innerHTML = `
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                `;
            }, 1500);
        } catch (err) {
            console.error('[MermaidViewer] Copy failed:', err);
        }
    });
    
    // Click outside to close
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
    
    // Animate in
    requestAnimationFrame(() => {
        modal.style.opacity = '1';
        // Auto fit after render
        setTimeout(fitToScreen, 100);
    });
}

/**
 * Show toast notification
 */
export function showToast(container, message, isError = false) {
    const existingToast = container.querySelector('.mermaid-toast');
    if (existingToast) existingToast.remove();
    
    const toast = document.createElement('div');
    toast.className = 'mermaid-toast';
    Object.assign(toast.style, {
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        padding: '8px 16px',
        borderRadius: '6px',
        fontSize: '12px',
        fontWeight: '500',
        zIndex: '100',
        background: isError ? 'rgba(239, 68, 68, 0.9)' : 'rgba(74, 222, 128, 0.9)',
        color: isError ? '#fff' : '#000',
        animation: 'mermaid-toast-fade 2s ease-out forwards'
    });
    toast.textContent = message;
    container.appendChild(toast);
    
    setTimeout(() => toast.remove(), 2000);
}

// Style helper functions
function getButtonStyle() {
    return `
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 4px 8px;
        background: rgba(255, 255, 255, 0.1);
        border: none;
        border-radius: 4px;
        color: #a1a1aa;
        cursor: pointer;
        font-size: 11px;
        transition: all 0.2s ease;
    `.replace(/\s+/g, ' ').trim();
}

function getHeaderStyle() {
    return `
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 20px;
        background: rgba(20, 20, 25, 0.95);
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        flex-shrink: 0;
    `.replace(/\s+/g, ' ').trim();
}

function getControlButtonStyle() {
    return `
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        background: transparent;
        border: none;
        border-radius: 6px;
        color: #a1a1aa;
        cursor: pointer;
        transition: all 0.15s ease;
    `.replace(/\s+/g, ' ').trim();
}

function getCloseButtonStyle() {
    return `
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        background: rgba(239, 68, 68, 0.15);
        border: none;
        border-radius: 6px;
        color: #ef4444;
        cursor: pointer;
        transition: all 0.15s ease;
    `.replace(/\s+/g, ' ').trim();
}

function getCanvasStyle() {
    return `
        flex: 1;
        overflow: hidden;
        background: linear-gradient(135deg, #0f0f14 0%, #1a1a24 100%);
        position: relative;
        cursor: grab;
    `.replace(/\s+/g, ' ').trim();
}

function getContentStyle() {
    return `
        position: absolute;
        top: 50%;
        left: 50%;
        transform-origin: center center;
        transform: translate(-50%, -50%);
        transition: transform 0.1s ease-out;
    `.replace(/\s+/g, ' ').trim();
}

function getFooterStyle() {
    return `
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 8px 20px;
        background: rgba(20, 20, 25, 0.95);
        border-top: 1px solid rgba(255, 255, 255, 0.08);
        flex-shrink: 0;
    `.replace(/\s+/g, ' ').trim();
}
