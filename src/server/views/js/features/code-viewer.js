import { API_BASE } from '../config.js';
import { showToast, getById } from '../utils.js';
// Import Highlight.js core
import hljs from 'highlight.js/lib/core';

// Import common languages to reduce bundle size
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import json from 'highlight.js/lib/languages/json';
import xml from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';
import bash from 'highlight.js/lib/languages/bash';
import java from 'highlight.js/lib/languages/java';
import python from 'highlight.js/lib/languages/python';
import sql from 'highlight.js/lib/languages/sql';
import markdown from 'highlight.js/lib/languages/markdown';

// Register languages
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('json', json);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('html', xml);
hljs.registerLanguage('css', css);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('java', java);
hljs.registerLanguage('python', python);
hljs.registerLanguage('sql', sql);
hljs.registerLanguage('markdown', markdown);

export async function openFileInViewer(path) {
    const container = getById('code-viewer-container');
    if (!container) return;

    // Show loading state
    container.innerHTML = '<div class="cv-loading">Loading file content...</div>';

    try {
        const res = await fetch(`${API_BASE}/api/read-file?path=${encodeURIComponent(path)}`);
        const data = await res.json();

        if (res.ok) {
            const ext = path.split('.').pop().toLowerCase();
            const language = getLanguageFromExt(ext);
            
            // Escape HTML tags to prevent XSS and ensure correct rendering
            const escapedCode = escapeHtml(data.content);
            
            // Render Code Block
            container.innerHTML = `
                <div class="cv-wrapper">
                    <pre><code class="language-${language}">${escapedCode}</code></pre>
                </div>
            `;

            // Apply Highlight.js
            const codeBlock = container.querySelector('code');
            if(codeBlock) {
                hljs.highlightElement(codeBlock);
            }

        } else {
            container.innerHTML = `<div class="cv-error">Error: ${data.error}</div>`;
            showToast(`Error opening file: ${data.error}`, 'error');
        }
    } catch (err) {
        container.innerHTML = `<div class="cv-error">Failed: ${err.message}</div>`;
        showToast(`Failed to load file: ${err.message}`, 'error');
    }
}

function getLanguageFromExt(ext) {
    const map = {
        js: 'javascript', ts: 'typescript', jsx: 'javascript', tsx: 'typescript',
        html: 'xml', xml: 'xml', css: 'css', scss: 'css',
        json: 'json', java: 'java', py: 'python', sh: 'bash', sql: 'sql',
        md: 'markdown'
    };
    return map[ext] || 'plaintext';
}

function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
