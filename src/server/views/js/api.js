// API Layer - All API calls centralized here
import { API_BASE } from './config.js';

/**
 * Analyze project and get source code
 * @param {string} path - Project path to analyze
 * @returns {Promise<string>} - Project content as text
 */
export async function analyzeProject(path) {
    const res = await fetch(`${API_BASE}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path })
    });

    if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Analyze failed');
    }

    return await res.text();
}

/**
 * Execute bash script
 * @param {string} bash - Bash script to execute
 * @returns {Promise<Object>} - Execution result
 */
export async function executeScript(bash) {
    const res = await fetch(`${API_BASE}/api/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bash })
    });

    const data = await res.json();
    
    if (!res.ok) {
        throw new Error(data.error || 'Execute failed');
    }

    return data;
}

/**
 * Check server health status
 * @returns {Promise<boolean>} - True if server is healthy
 */
export async function checkHealth() {
    try {
        const res = await fetch(`${API_BASE}/health`);
        return res.ok;
    } catch {
        return false;
    }
}

/**
 * Get project structure with tokens
 * @param {string} path - Project path
 * @returns {Promise<Object>} - Structure data
 */
export async function getStructure(path) {
    const res = await fetch(`${API_BASE}/api/structure?path=${encodeURIComponent(path)}`);
    
    if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to get structure');
    }

    return await res.json();
}

/**
 * Copy content as file to clipboard
 * @param {string} filename - Filename for the clipboard item
 * @param {string} content - Content to copy
 */
export async function copyAsFile(filename, content) {
    const blob = new Blob([content], {
        type: "application/octet-stream"
    });

    const item = new ClipboardItem(
        { [blob.type]: blob },
        {
            type: "application/octet-stream",
            presentationStyle: "attachment",
            name: filename
        }
    );

    await navigator.clipboard.write([item]);
}

/**
 * Copy text to clipboard with fallback
 * @param {string} text - Text to copy
 */
export async function copyToClipboard(text) {
    try {
        const blob = new Blob([text], { type: 'text/plain' });
        const item = new ClipboardItem({ 'text/plain': blob });
        await navigator.clipboard.write([item]);
    } catch (err) {
        // Fallback to simple writeText
        await navigator.clipboard.writeText(text);
    }
}

/**
 * Read text from clipboard
 * @returns {Promise<string>} - Clipboard text content
 */
export async function readFromClipboard() {
    return await navigator.clipboard.readText();
}
