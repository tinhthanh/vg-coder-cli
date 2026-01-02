/**
 * Clipboard Helper
 * Provides clipboard READ functionality for injected scripts
 * 
 * Architecture:
 * - Read: MAIN World → HTTP API → Node.js Server → clipboardy.read()
 * - Write: Handled by CDP clicks (see cdp-click-helper.ts)
 */

export const CLIPBOARD_HELPER_SCRIPT = `
// VetGo Clipboard Helper (Read-only via Server API)
(function() {
  // ===== READ CLIPBOARD =====
  window.vetgoReadClipboard = function() {
    return fetch('http://localhost:6868/api/clipboard')
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          return data.text;
        } else {
          throw new Error(data.error || 'Failed to read clipboard');
        }
      })
      .catch(error => {
        console.error('Clipboard read error:', error);
        throw error;
      });
  };

  // Alias for backward compatibility
  window.readClipboard = window.vetgoReadClipboard;

  console.log('✅ VetGo Clipboard Helper loaded (Server API Read)');
})();
`;
