/**
 * Clipboard Helper
 * Provides clipboard read functionality for injected scripts
 * 
 * Architecture:
 * MAIN World (Page) -> HTTP API -> Node.js Server -> System Clipboard
 * This bypasses all browser security restrictions!
 */

export const CLIPBOARD_HELPER_SCRIPT = `
// VetGo Clipboard Helper (API-based)
// Calls server API to read clipboard, bypassing browser security
(function() {
  // Function to read clipboard via server API
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
        console.error('Clipboard API error:', error);
        throw error;
      });
  };

  // Alias for backward compatibility
  window.readClipboard = window.vetgoReadClipboard;

  console.log('✅ VetGo Clipboard Helper loaded (Server API)');
})();
`;
