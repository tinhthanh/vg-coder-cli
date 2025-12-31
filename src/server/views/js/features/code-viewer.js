import { API_BASE } from '../config.js';
import { showToast, getById } from '../utils.js';
// Import Highlight.js core
import hljs from 'highlight.js/lib/core';
// Import markdown-it for rendering .md files
import markdownit from 'markdown-it';
// Import mermaid for rendering diagrams
import mermaid from 'mermaid';

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

// Initialize markdown-it with safe settings
const md = markdownit({
    html: false,        // Disable HTML tags in source for security (prevents XSS)
    breaks: true,       // Convert line breaks to <br>
    linkify: true,      // Auto-convert URLs to links
    typographer: true,  // Enable smart quotes and other typographic replacements
    highlight: function (str, lang) {
        // Use highlight.js for code blocks within markdown
        if (lang && hljs.getLanguage(lang)) {
            try {
                return hljs.highlight(str, { language: lang }).value;
            } catch (__) {}
        }
        return ''; // Use default escaping
    }
});

// Initialize mermaid with dark theme
mermaid.initialize({
    startOnLoad: false,      // We'll manually trigger rendering
    theme: 'dark',           // Match VG Coder's dark theme
    securityLevel: 'loose',  // Allow interaction in shadow DOM
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif'
});

/**
 * Render mermaid diagrams in the container
 * Finds all code.language-mermaid blocks and replaces them with rendered SVG
 */
async function renderMermaidDiagrams(container) {
    const mermaidBlocks = container.querySelectorAll('code.language-mermaid');
    
    if (mermaidBlocks.length === 0) {
        return; // No mermaid diagrams to render
    }
    
    console.log(`[Mermaid] Found ${mermaidBlocks.length} diagram(s) to render`);
    
    for (let i = 0; i < mermaidBlocks.length; i++) {
        const block = mermaidBlocks[i];
        const code = block.textContent;
        const pre = block.parentElement;
        
        try {
            // Use mermaid.render() which is more compatible with shadow DOM
            const id = `mermaid-diagram-${Date.now()}-${i}`;
            const { svg, bindFunctions } = await mermaid.render(id, code);
            
            // Create wrapper div for mermaid
            const wrapper = document.createElement('div');
            wrapper.className = 'mermaid-diagram';
            wrapper.innerHTML = svg;
            
            // Replace pre/code with wrapper
            pre.replaceWith(wrapper);
            
            // Bind any interactive functions if present
            if (bindFunctions) {
                bindFunctions(wrapper);
            }
            
            console.log(`[Mermaid] Successfully rendered diagram ${i + 1}`);
        } catch (err) {
            console.error(`[Mermaid] Failed to render diagram ${i + 1}:`, err);
            // On error, show error message instead of broken diagram
            const errorDiv = document.createElement('div');
            errorDiv.className = 'mermaid-error';
            errorDiv.textContent = `Mermaid rendering error: ${err.message}`;
            pre.replaceWith(errorDiv);
        }
    }
}

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
            
            // Check if file is markdown
            if (ext === 'md') {
                // Render as markdown
                const htmlContent = md.render(data.content);
                
                container.innerHTML = `
                    <div class="cv-wrapper cv-markdown">
                        <div class="markdown-body">
                            ${htmlContent}
                        </div>
                    </div>
                `;
                
                // Render mermaid diagrams (if any)
                await renderMermaidDiagrams(container);
            } else {
                // Render as code with syntax highlighting
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
