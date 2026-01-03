import { getById } from '../utils.js';

const STORAGE_KEY_BROWSER_URL = 'vg-coder-browser-url';
const DEFAULT_URL = 'https://www.google.com';

/**
 * Initialize Browser Panel
 */
export function initBrowserPanel() {
    // Listen for panel open event
    document.addEventListener('tool-panel-opened', (e) => {
        if (e.detail.panelId === 'browser' && e.detail.side === 'right') {
            renderBrowserPanel();
        }
    });

    console.log('[BrowserPanel] Initialized');
}

/**
 * Render browser panel content
 */
function renderBrowserPanel() {
    const container = getById('browser-panel-content');
    if (!container) {
        console.error('[BrowserPanel] Container not found');
        return;
    }

    // Check if already rendered
    if (container.querySelector('.browser-panel-wrapper')) {
        return;
    }

    // Get saved URL or use default
    const savedUrl = localStorage.getItem(STORAGE_KEY_BROWSER_URL) || DEFAULT_URL;

    // Create browser panel UI
    container.innerHTML = `
        <div class="browser-panel-wrapper">
            <div class="browser-toolbar">
                <input 
                    type="text" 
                    id="browser-url-input" 
                    class="browser-url-input" 
                    placeholder="Enter URL..." 
                    value="${savedUrl}"
                />
                <button id="browser-go-btn" class="browser-go-btn" title="Go">→</button>
                <button id="browser-refresh-btn" class="browser-refresh-btn" title="Refresh">🔄</button>
            </div>
            <iframe 
                id="browser-iframe" 
                class="browser-iframe" 
                src="${savedUrl}"
                sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
            ></iframe>
        </div>
    `;

    // Attach event listeners
    attachBrowserListeners();

    console.log('[BrowserPanel] Rendered with URL:', savedUrl);
}

/**
 * Attach event listeners for browser controls
 */
function attachBrowserListeners() {
    const urlInput = getById('browser-url-input');
    const goBtn = getById('browser-go-btn');
    const refreshBtn = getById('browser-refresh-btn');
    const iframe = getById('browser-iframe');

    if (!urlInput || !goBtn || !iframe) {
        console.error('[BrowserPanel] UI elements not found');
        return;
    }

    // Navigate on button click
    goBtn.addEventListener('click', () => {
        navigateToUrl(urlInput.value, iframe);
    });

    // Navigate on Enter key
    urlInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            navigateToUrl(urlInput.value, iframe);
        }
    });

    // Refresh iframe
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            iframe.src = iframe.src; // Reload current URL
        });
    }

    console.log('[BrowserPanel] Event listeners attached');
}

/**
 * Navigate to URL
 */
function navigateToUrl(url, iframe) {
    if (!url) return;

    // Add protocol if missing
    let finalUrl = url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        finalUrl = 'https://' + url;
    }

    try {
        iframe.src = finalUrl;
        // Save URL to localStorage
        localStorage.setItem(STORAGE_KEY_BROWSER_URL, finalUrl);
        
        // Update input with final URL
        const urlInput = getById('browser-url-input');
        if (urlInput) {
            urlInput.value = finalUrl;
        }

        console.log('[BrowserPanel] Navigated to:', finalUrl);
    } catch (e) {
        console.error('[BrowserPanel] Navigation failed:', e);
    }
}
