/**
 * CDP Click Helper
 * Provides REAL mouse clicks via Chrome DevTools Protocol
 * 
 * Architecture:
 * MAIN World → postMessage → Content Script → Background → CDP → Real Click!
 */

export const CDP_CLICK_HELPER_SCRIPT = `
// VetGo CDP Click Helper
(function() {
  /**
   * Send CDP click command to background via bridge
   * @param {HTMLElement} element - Element to click
   * @returns {Promise<void>}
   */
  window.vetgoCDPClick = async function(element) {
    if (!element) {
      throw new Error('Element is required');
    }

    // Get element coordinates
    const rect = element.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;

    console.log(\`🔄 Sending CDP click request: (\${x}, \${y})\`);

    // Send to content script via postMessage
    window.postMessage({
      type: 'VETGO_CDP_CLICK',
      x,
      y
    }, '*');

    // Wait for click to complete
    await new Promise(r => setTimeout(r, 300));
  };

  console.log('✅ VetGo CDP Click Helper loaded');
})();
`;
