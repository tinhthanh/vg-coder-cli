import { getById, showToast } from '../utils.js';
import { globalDispatcher } from '../event-protocol.js';
import { featureRegistry } from './bubble-features/index.js';

export function initBubble() {
    const bubble = getById('vg-bubble');
    const appRoot = getById('vg-app-root');
    const bubbleMenu = bubble?.querySelector('.vg-bubble-menu');

    if (!bubble || !appRoot) return;

    // --- RENDER FEATURES DYNAMICALLY ---
    if (bubbleMenu) {
        renderFeatures(bubbleMenu);
    }

    // --- DRAG LOGIC ---
    let isDragging = false;
    let startX, startY, initialLeft, initialTop;
    let hasMoved = false; // To distinguish click vs drag
    let mouseDownTarget = null; // Track where mousedown started

    bubble.addEventListener('mousedown', (e) => {
        isDragging = true;
        hasMoved = false;
        mouseDownTarget = e.target; // Remember click target
        startX = e.clientX;
        startY = e.clientY;
        
        // Get computed style for accurate position
        const rect = bubble.getBoundingClientRect();
        initialLeft = rect.left;
        initialTop = rect.top;

        // Prevent text selection
        e.preventDefault();
        
        // Set cursor
        bubble.style.cursor = 'grabbing';
    });

    // Use window events to handle drag outside shadow root if needed, 
    // but here we are inside Shadow DOM, so document/root events work
    // We attach to root to capture movement
    const root = window.__VG_CODER_ROOT__ || document;

    root.addEventListener('mousemove', (e) => {
        if (!isDragging) return;

        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        // Threshold to consider it a move
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) hasMoved = true;

        bubble.style.left = `${initialLeft + dx}px`;
        bubble.style.top = `${initialTop + dy}px`;
        bubble.style.bottom = 'auto'; // Clear bottom/right if set by CSS
        bubble.style.right = 'auto';
    });

    root.addEventListener('mouseup', (e) => {
        if (!isDragging) return;
        isDragging = false;
        bubble.style.cursor = 'grab';

        if (hasMoved) {
            snapToEdge(bubble);
        } else {
            // Click logic - only toggle if clicked on bubble icon, NOT on menu buttons
            const clickedOnMenu = mouseDownTarget?.closest('.vg-bubble-menu');
            const clickedOnIcon = mouseDownTarget?.closest('.vg-bubble-icon');
            
            // Only toggle dashboard if clicked on icon or bubble itself, but NOT on menu
            if (!clickedOnMenu && (clickedOnIcon || mouseDownTarget === bubble)) {
                toggleDashboard(appRoot);
            }
        }
        
        // Reset
        mouseDownTarget = null;
    });
}

/**
 * Render features dynamically from feature registry
 */
function renderFeatures(container) {
    // Clear existing content
    container.innerHTML = '';

    // Get enabled features
    const features = featureRegistry.getEnabledFeatures();

    if (features.length === 0) {
        console.warn('[Bubble] No enabled features found');
        return;
    }

    // Render each feature
    features.forEach(feature => {
        const btn = document.createElement('button');
        btn.id = `bubble-feature-${feature.id}`;
        btn.className = 'bubble-action-btn';
        btn.title = feature.tooltip;
        btn.textContent = feature.label;

        // Add click handler to dispatch event
        btn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent toggling dashboard

            // Dispatch event via event protocol
            globalDispatcher.dispatch({
                type: feature.eventType,
                source: 'bubble-menu',
                target: 'handlers',
                payload: { 
                    featureId: feature.id,
                    label: feature.label,
                },
                context: 'shadow-root',
            });
        });

        container.appendChild(btn);
    });

    console.log(`[Bubble] Rendered ${features.length} features`);
}

function snapToEdge(bubble) {
    const rect = bubble.getBoundingClientRect();
    const winWidth = window.innerWidth;
    const winHeight = window.innerHeight;

    // Determine nearest horizontal edge
    const distLeft = rect.left;
    const distRight = winWidth - rect.right;

    let targetLeft;
    if (distLeft < distRight) {
        targetLeft = 20; // 20px padding
    } else {
        targetLeft = winWidth - rect.width - 20;
    }

    // Keep vertical within bounds
    let targetTop = rect.top;
    if (targetTop < 20) targetTop = 20;
    if (targetTop > winHeight - rect.height - 20) targetTop = winHeight - rect.height - 20;

    // Animate snap
    bubble.style.transition = 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)';
    bubble.style.left = `${targetLeft}px`;
    bubble.style.top = `${targetTop}px`;

    // Remove transition after snap to allow immediate drag next time
    setTimeout(() => {
        bubble.style.transition = '';
    }, 300);
}

function toggleDashboard(appRoot) {
    const isVisible = appRoot.classList.contains('visible');
    
    if (isVisible) {
        // Hide
        appRoot.classList.remove('visible');
        // Pointer events auto is handled by CSS (when hidden opacity=0, pointer-events usually stay but size is 0x0)
        // Our gulpfile sets width:0, height:0 for base state, so clicks pass through
    } else {
        // Show
        appRoot.classList.add('visible');
    }
}
