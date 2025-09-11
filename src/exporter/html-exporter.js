const fs = require('fs-extra');
const path = require('path');
const hljs = require('highlight.js');

/**
 * HTML Exporter với syntax highlighting và copy functionality
 */
class HtmlExporter {
  constructor(outputPath, options = {}) {
    this.outputPath = outputPath;
    this.options = {
      theme: options.theme || 'github',
      includeLineNumbers: options.includeLineNumbers !== false,
      includeStats: options.includeStats !== false,
      includeSearch: options.includeSearch !== false,
      title: options.title || 'VG Coder Analysis',
      ...options
    };
  }

  /**
   * Xuất HTML cho chunks
   */
  async exportChunks(chunks, metadata = {}) {
    // Tạo thư mục output
    await fs.ensureDir(this.outputPath);
    await fs.ensureDir(path.join(this.outputPath, 'chunks'));
    
    // Copy static assets
    await this.copyStaticAssets();
    
    // Tạo index.html
    await this.createIndexPage(chunks, metadata);
    
    // Tạo từng chunk file
    for (let i = 0; i < chunks.length; i++) {
      await this.createChunkPage(chunks[i], i, chunks.length, metadata);
    }
    
    // Tạo combined view
    await this.createCombinedPage(chunks, metadata);
    
    return {
      indexPath: path.join(this.outputPath, 'index.html'),
      chunksPath: path.join(this.outputPath, 'chunks'),
      combinedPath: path.join(this.outputPath, 'combined.html'),
      totalFiles: chunks.length
    };
  }

  /**
   * Tạo trang index
   */
  async createIndexPage(chunks, metadata) {
    const totalTokens = chunks.reduce((sum, chunk) => sum + chunk.tokens, 0);
    const avgTokens = Math.round(totalTokens / chunks.length);
    
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${this.options.title}</title>
    <link rel="stylesheet" href="assets/styles.css">
    <link rel="stylesheet" href="assets/highlight.css">
</head>
<body>
    <div class="container">
        <header class="header">
            <h1>${this.options.title}</h1>
            <p class="subtitle">Generated on ${new Date().toLocaleString()}</p>
        </header>

        ${this.options.includeStats ? this.generateStatsSection(chunks, metadata, totalTokens, avgTokens) : ''}

        ${metadata.directoryStructure ? this.generateDirectorySection(metadata.directoryStructure) : '<!-- No directory structure -->'}

        <section class="chunks-section">
            <h2>Content Chunks</h2>
            <div class="chunks-grid">
                ${chunks.map((chunk, index) => this.generateChunkCard(chunk, index)).join('')}
            </div>
        </section>

        <section class="actions-section">
            <div class="action-buttons">
                <a href="combined.html" class="btn btn-primary">View All Combined</a>
                <button onclick="downloadAllChunks()" class="btn btn-secondary">Download All</button>
            </div>
        </section>
    </div>

    <script src="assets/scripts.js"></script>
</body>
</html>`;

    await fs.writeFile(path.join(this.outputPath, 'index.html'), html);
  }

  /**
   * Tạo trang cho từng chunk
   */
  async createChunkPage(chunk, index, total, metadata) {
    const fileName = `chunk-${index + 1}.html`;
    const prevLink = index > 0 ? `chunk-${index}.html` : null;
    const nextLink = index < total - 1 ? `chunk-${index + 2}.html` : null;
    
    const highlightedContent = this.highlightContent(chunk.content);
    
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Chunk ${index + 1} - ${this.options.title}</title>
    <link rel="stylesheet" href="../assets/styles.css">
    <link rel="stylesheet" href="../assets/highlight.css">
</head>
<body>
    <div class="container">
        <header class="header">
            <div class="nav-header">
                <a href="../index.html" class="back-link">← Back to Index</a>
                <h1>Chunk ${index + 1} of ${total}</h1>
                <div class="chunk-nav">
                    ${prevLink ? `<a href="${prevLink}" class="btn btn-sm">← Previous</a>` : ''}
                    ${nextLink ? `<a href="${nextLink}" class="btn btn-sm">Next →</a>` : ''}
                </div>
            </div>
        </header>

        <section class="chunk-info">
            <div class="info-grid">
                <div class="info-item">
                    <span class="label">Tokens:</span>
                    <span class="value">${chunk.tokens.toLocaleString()}</span>
                </div>
                <div class="info-item">
                    <span class="label">Type:</span>
                    <span class="value">${chunk.metadata?.type || 'unknown'}</span>
                </div>
                ${chunk.metadata?.filePath ? `
                <div class="info-item">
                    <span class="label">File:</span>
                    <span class="value">${chunk.metadata.filePath}</span>
                </div>` : ''}
            </div>
            <button onclick="copyToClipboard('chunk-content')" class="btn btn-copy">
                📋 Copy Content
            </button>
        </section>

        <section class="content-section">
            <div class="code-container">
                <pre id="chunk-content"><code>${highlightedContent}</code></pre>
            </div>
        </section>
    </div>

    <script src="../assets/scripts.js"></script>
</body>
</html>`;

    await fs.writeFile(path.join(this.outputPath, 'chunks', fileName), html);
  }

  /**
   * Tạo trang combined
   */
  async createCombinedPage(chunks, metadata) {
    const combinedContent = chunks.map(chunk => chunk.content).join('\n\n');
    const highlightedContent = this.highlightContent(combinedContent);
    const totalTokens = chunks.reduce((sum, chunk) => sum + chunk.tokens, 0);
    
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Combined View - ${this.options.title}</title>
    <link rel="stylesheet" href="assets/styles.css">
    <link rel="stylesheet" href="assets/highlight.css">
</head>
<body>
    <div class="container">
        <header class="header">
            <div class="nav-header">
                <a href="index.html" class="back-link">← Back to Index</a>
                <h1>Combined View</h1>
                <button onclick="copyToClipboard('combined-content')" class="btn btn-copy">
                    📋 Copy All Content
                </button>
            </div>
        </header>

        <section class="combined-info">
            <div class="info-grid">
                <div class="info-item">
                    <span class="label">Total Chunks:</span>
                    <span class="value">${chunks.length}</span>
                </div>
                <div class="info-item">
                    <span class="label">Total Tokens:</span>
                    <span class="value">${totalTokens.toLocaleString()}</span>
                </div>
                <div class="info-item">
                    <span class="label">Size:</span>
                    <span class="value">${this.formatBytes(combinedContent.length)}</span>
                </div>
            </div>
        </section>

        ${this.options.includeSearch ? this.generateSearchSection() : ''}

        <section class="template-section">
            <h2>📝 Script Template Hướng Dẫn</h2>
            <div class="template-container">
                <div class="template-header">
                    <span class="template-title">Quy tắc tạo script chỉnh sửa file:</span>
                    <button onclick="copyTemplateGuide()" class="btn btn-copy">📋 Copy Template</button>
                </div>
                <div class="template-content">
                    <pre id="template-guide"><code>Trả về với định dạng
Quy tắc bắt buộc:
Script phải có cú pháp:
mkdir -p $(dirname "path/to/file.ext")
cat <<'EOF' > path/to/file.ext
... toàn bộ nội dung file sau khi chỉnh sửa ...
EOF
Mỗi file cần thay đổi phải được ghi đè hoàn toàn bằng nội dung mới.
Nếu file chưa tồn tại, script sẽ tự tạo file và thư mục cha.</code></pre>
                </div>
            </div>
        </section>

        <section class="content-section">
            <div class="code-container">
                <pre id="combined-content"><code>${highlightedContent}</code></pre>
            </div>
        </section>
    </div>

    <script src="assets/scripts.js"></script>
</body>
</html>`;

    await fs.writeFile(path.join(this.outputPath, 'combined.html'), html);
  }

  /**
   * Copy static assets
   */
  async copyStaticAssets() {
    const assetsPath = path.join(this.outputPath, 'assets');
    await fs.ensureDir(assetsPath);
    
    // CSS
    await this.createStylesCSS(assetsPath);
    await this.createHighlightCSS(assetsPath);
    
    // JavaScript
    await this.createScriptsJS(assetsPath);
  }

  /**
   * Tạo styles.css
   */
  async createStylesCSS(assetsPath) {
    const css = `
/* VG Coder Styles */
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    line-height: 1.6;
    color: #333;
    background-color: #f8f9fa;
}

.container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px;
}

.header {
    background: white;
    padding: 30px;
    border-radius: 10px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    margin-bottom: 30px;
}

.header h1 {
    color: #2c3e50;
    margin-bottom: 10px;
}

.subtitle {
    color: #7f8c8d;
    font-size: 14px;
}

.nav-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 15px;
}

.back-link {
    color: #3498db;
    text-decoration: none;
    font-weight: 500;
}

.back-link:hover {
    text-decoration: underline;
}

.chunk-nav {
    display: flex;
    gap: 10px;
}

.stats-section {
    background: white;
    padding: 25px;
    border-radius: 10px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    margin-bottom: 30px;
}

.stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 20px;
    margin-top: 20px;
}

.stat-item {
    text-align: center;
    padding: 15px;
    background: #f8f9fa;
    border-radius: 8px;
}

.stat-value {
    font-size: 24px;
    font-weight: bold;
    color: #2c3e50;
    display: block;
}

.stat-label {
    font-size: 14px;
    color: #7f8c8d;
    margin-top: 5px;
}

.chunks-section {
    background: white;
    padding: 25px;
    border-radius: 10px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    margin-bottom: 30px;
}

.chunks-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 20px;
    margin-top: 20px;
}

.chunk-card {
    border: 1px solid #e1e8ed;
    border-radius: 8px;
    padding: 20px;
    background: #f8f9fa;
    transition: transform 0.2s, box-shadow 0.2s;
}

.chunk-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 15px rgba(0,0,0,0.1);
}

.chunk-title {
    font-weight: bold;
    margin-bottom: 10px;
    color: #2c3e50;
}

.chunk-meta {
    font-size: 14px;
    color: #7f8c8d;
    margin-bottom: 15px;
}

.chunk-actions {
    display: flex;
    gap: 10px;
}

.btn {
    padding: 8px 16px;
    border: none;
    border-radius: 5px;
    text-decoration: none;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.2s;
    display: inline-block;
    text-align: center;
}

.btn-primary {
    background: #3498db;
    color: white;
}

.btn-primary:hover {
    background: #2980b9;
}

.btn-secondary {
    background: #95a5a6;
    color: white;
}

.btn-secondary:hover {
    background: #7f8c8d;
}

.btn-sm {
    padding: 6px 12px;
    font-size: 12px;
}

.btn-copy {
    background: #27ae60;
    color: white;
}

.btn-copy:hover {
    background: #229954;
}

.info-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 15px;
    margin-bottom: 20px;
}

.info-item {
    display: flex;
    justify-content: space-between;
    padding: 10px;
    background: #f8f9fa;
    border-radius: 5px;
}

.label {
    font-weight: 500;
    color: #7f8c8d;
}

.value {
    font-weight: bold;
    color: #2c3e50;
}

/* Template Section */
.template-section {
    margin: 30px 0;
    padding: 20px;
    background: #f8f9fa;
    border-radius: 8px;
    border-left: 4px solid #3498db;
}

.template-section h2 {
    margin: 0 0 20px 0;
    color: #2c3e50;
    font-size: 1.4em;
}

.template-container {
    background: white;
    border-radius: 6px;
    overflow: hidden;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.template-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 15px 20px;
    background: #ecf0f1;
    border-bottom: 1px solid #bdc3c7;
}

.template-title {
    font-weight: 600;
    color: #2c3e50;
}

.template-content {
    padding: 0;
}

.template-content pre {
    margin: 0;
    padding: 20px;
    background: #2c3e50;
    color: #ecf0f1;
    font-family: 'Courier New', monospace;
    font-size: 14px;
    line-height: 1.6;
    overflow-x: auto;
}

.template-content code {
    background: none;
    color: inherit;
    padding: 0;
}

.content-section {
    background: white;
    border-radius: 10px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    overflow: hidden;
}

.directory-section {
    background: white;
    border-radius: 10px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    padding: 20px;
    margin-bottom: 30px;
}

.directory-section h2 {
    margin-bottom: 15px;
    color: #2c3e50;
    border-bottom: 2px solid #3498db;
    padding-bottom: 10px;
}

.directory-tree {
    position: relative;
    background: #f8f9fa;
    border-radius: 8px;
    border: 1px solid #e9ecef;
    max-height: 500px;
    overflow-y: auto;
}

.tree-content {
    margin: 0;
    padding: 20px;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    font-size: 13px;
    line-height: 1.4;
    color: #2c3e50;
    background: transparent;
    white-space: pre;
    overflow-x: auto;
}

.directory-tree .btn-copy {
    position: absolute;
    top: 10px;
    right: 10px;
    z-index: 10;
}

.code-container {
    position: relative;
}

.code-container pre {
    margin: 0;
    padding: 20px;
    overflow-x: auto;
    background: #f8f9fa;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    font-size: 14px;
    line-height: 1.5;
}

.search-section {
    background: white;
    padding: 20px;
    border-radius: 10px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    margin-bottom: 20px;
}

.search-input {
    width: 100%;
    padding: 10px;
    border: 1px solid #ddd;
    border-radius: 5px;
    font-size: 16px;
}

.actions-section {
    text-align: center;
    margin-top: 30px;
}

.action-buttons {
    display: flex;
    justify-content: center;
    gap: 15px;
    flex-wrap: wrap;
}

.copy-success {
    position: fixed;
    top: 20px;
    right: 20px;
    background: #27ae60;
    color: white;
    padding: 10px 20px;
    border-radius: 5px;
    z-index: 1000;
    animation: slideIn 0.3s ease;
}

@keyframes slideIn {
    from { transform: translateX(100%); }
    to { transform: translateX(0); }
}

@media (max-width: 768px) {
    .container {
        padding: 10px;
    }
    
    .nav-header {
        flex-direction: column;
        align-items: flex-start;
    }
    
    .chunks-grid {
        grid-template-columns: 1fr;
    }
    
    .stats-grid {
        grid-template-columns: repeat(2, 1fr);
    }
    
    .action-buttons {
        flex-direction: column;
        align-items: center;
    }

    .directory-tree {
        max-height: 400px;
        overflow-y: auto;
    }
}`;

    await fs.writeFile(path.join(assetsPath, 'styles.css'), css);
  }

  /**
   * Tạo highlight.css
   */
  async createHighlightCSS(assetsPath) {
    // Sử dụng GitHub theme
    const css = `
/* GitHub Theme for highlight.js */
.hljs {
    color: #333;
    background: #f8f8f8;
}

.hljs-comment,
.hljs-quote {
    color: #998;
    font-style: italic;
}

.hljs-keyword,
.hljs-selector-tag,
.hljs-subst {
    color: #333;
    font-weight: bold;
}

.hljs-number,
.hljs-literal,
.hljs-variable,
.hljs-template-variable,
.hljs-tag .hljs-attr {
    color: #008080;
}

.hljs-string,
.hljs-doctag {
    color: #d14;
}

.hljs-title,
.hljs-section,
.hljs-selector-id {
    color: #900;
    font-weight: bold;
}

.hljs-subst {
    font-weight: normal;
}

.hljs-type,
.hljs-class .hljs-title {
    color: #458;
    font-weight: bold;
}

.hljs-tag,
.hljs-name,
.hljs-attribute {
    color: #000080;
    font-weight: normal;
}

.hljs-regexp,
.hljs-link {
    color: #009926;
}

.hljs-symbol,
.hljs-bullet {
    color: #990073;
}

.hljs-built_in,
.hljs-builtin-name {
    color: #0086b3;
}

.hljs-meta {
    color: #999;
    font-weight: bold;
}

.hljs-deletion {
    background: #fdd;
}

.hljs-addition {
    background: #dfd;
}

.hljs-emphasis {
    font-style: italic;
}

.hljs-strong {
    font-weight: bold;
}`;

    await fs.writeFile(path.join(assetsPath, 'highlight.css'), css);
  }

  /**
   * Tạo scripts.js
   */
  async createScriptsJS(assetsPath) {
    const js = `// VG Coder Scripts

// Copy to clipboard functionality
async function copyToClipboard(elementId) {
    try {
        const element = document.getElementById(elementId);
        const text = element.textContent || element.innerText;

        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
        } else {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            textArea.style.top = '-999999px';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            document.execCommand('copy');
            textArea.remove();
        }

        showCopySuccess();
    } catch (err) {
        console.error('Failed to copy: ', err);
        alert('Failed to copy content to clipboard');
    }
}

// Show copy success message
function showCopySuccess() {
    const message = document.createElement('div');
    message.className = 'copy-success';
    message.textContent = 'Content copied to clipboard!';
    document.body.appendChild(message);

    setTimeout(function() {
        message.remove();
    }, 3000);
}

// Copy chunk content by index
async function copyChunkContent(chunkIndex) {
    try {
        // Find the chunk content in the current page
        const chunkElement = document.querySelector(\`[data-chunk-index="\${chunkIndex}"]\`);
        let content = '';

        if (chunkElement) {
            // Get content from the current page
            const codeElement = chunkElement.querySelector('pre code, pre');
            content = codeElement ? (codeElement.textContent || codeElement.innerText) : '';
        } else {
            // Fallback: try to get content from chunk data if available
            if (window.chunkData && window.chunkData[chunkIndex]) {
                content = window.chunkData[chunkIndex].content;
            } else {
                // Last fallback: show error
                alert(\`Chunk \${chunkIndex + 1} content not found\`);
                return;
            }
        }

        if (content.trim()) {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(content);
            } else {
                // Fallback for older browsers
                const textArea = document.createElement('textarea');
                textArea.value = content;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
            }
            showCopySuccess();
        } else {
            alert('No content found to copy');
        }
    } catch (error) {
        console.error('Copy failed:', error);
        alert('Failed to copy chunk content');
    }
}

// Download all chunks
function downloadAllChunks() {
    // This would need to be implemented based on specific requirements
    alert('Download functionality would be implemented here');
}

// Copy directory structure
async function copyDirectoryStructure() {
    try {
        const treeElement = document.querySelector('.tree-content');
        if (!treeElement) {
            alert('Directory structure not found');
            return;
        }

        const content = treeElement.textContent || treeElement.innerText;

        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(content);
        } else {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = content;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            textArea.style.top = '-999999px';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
        }

        // Show success feedback
        const button = event.target;
        const originalText = button.textContent;
        button.textContent = '✅ Copied!';
        button.style.background = '#27ae60';

        setTimeout(() => {
            button.textContent = originalText;
            button.style.background = '';
        }, 2000);

    } catch (err) {
        console.error('Failed to copy directory structure:', err);
        alert('Failed to copy directory structure');
    }
}

// Search functionality
function initializeSearch() {
    const searchInput = document.getElementById('search-input');
    const content = document.getElementById('combined-content') || document.getElementById('chunk-content');

    if (!searchInput || !content) return;

    let originalContent = content.innerHTML;

    searchInput.addEventListener('input', function() {
        const query = this.value.trim();

        if (!query) {
            content.innerHTML = originalContent;
            return;
        }

        const regex = new RegExp('(' + escapeRegex(query) + ')', 'gi');
        const highlighted = originalContent.replace(regex, '<mark>$1</mark>');
        content.innerHTML = highlighted;
    });
}

// Escape regex special characters
function escapeRegex(string) {
    var specialChars = ['\\\\', '.', '*', '+', '?', '^', '$', '{', '}', '(', ')', '|', '[', ']'];
    var result = string;
    for (var i = 0; i < specialChars.length; i++) {
        result = result.split(specialChars[i]).join('\\\\' + specialChars[i]);
    }
    return result;
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeSearch();

    // Add keyboard shortcuts
    document.addEventListener('keydown', function(e) {
        // Ctrl+C or Cmd+C to copy current content
        if ((e.ctrlKey || e.metaKey) && e.key === 'c' && e.target.tagName !== 'INPUT') {
            const content = document.getElementById('combined-content') || document.getElementById('chunk-content');
            if (content) {
                copyToClipboard(content.id);
                e.preventDefault();
            }
        }
    });
});

// Copy template guide
async function copyTemplateGuide() {
    try {
        const templateText = \`Trả về với định dạng
Quy tắc bắt buộc:
Script phải có cú pháp:
mkdir -p $(dirname "path/to/file.ext")
cat <<'EOF' > path/to/file.ext
... toàn bộ nội dung file sau khi chỉnh sửa ...
EOF
Mỗi file cần thay đổi phải được ghi đè hoàn toàn bằng nội dung mới.
Nếu file chưa tồn tại, script sẽ tự tạo file và thư mục cha.\`;

        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(templateText);
        } else {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = templateText;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            textArea.style.top = '-999999px';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
        }

        showCopySuccess();
    } catch (err) {
        console.error('Failed to copy template: ', err);
        alert('Failed to copy template to clipboard');
    }
}`;

    await fs.writeFile(path.join(assetsPath, 'scripts.js'), js);
  }

  /**
   * Highlight content
   */
  highlightContent(content) {
    try {
      // Auto-detect language or use plain text
      const result = hljs.highlightAuto(content);
      return result.value;
    } catch (error) {
      // Fallback to plain text with HTML escaping
      return this.escapeHtml(content);
    }
  }

  /**
   * Escape HTML
   */
  escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }

  /**
   * Generate directory structure section
   */
  generateDirectorySection(directoryStructure) {
    return `
        <section class="directory-section">
            <h2>📁 Project Structure</h2>
            <div class="directory-tree">
                <pre class="tree-content">${this.escapeHtml(directoryStructure)}</pre>
                <button onclick="copyDirectoryStructure()" class="btn btn-copy">📋 Copy Structure</button>
            </div>
        </section>`;
  }

  /**
   * Generate stats section
   */
  generateStatsSection(chunks, metadata, totalTokens, avgTokens) {
    return `
        <section class="stats-section">
            <h2>Statistics</h2>
            <div class="stats-grid">
                <div class="stat-item">
                    <span class="stat-value">${chunks.length}</span>
                    <span class="stat-label">Total Chunks</span>
                </div>
                <div class="stat-item">
                    <span class="stat-value">${totalTokens.toLocaleString()}</span>
                    <span class="stat-label">Total Tokens</span>
                </div>
                <div class="stat-item">
                    <span class="stat-value">${avgTokens.toLocaleString()}</span>
                    <span class="stat-label">Avg Tokens/Chunk</span>
                </div>
                <div class="stat-item">
                    <span class="stat-value">${metadata.projectType || 'Unknown'}</span>
                    <span class="stat-label">Project Type</span>
                </div>
            </div>
        </section>`;
  }

  /**
   * Generate search section
   */
  generateSearchSection() {
    return `
        <section class="search-section">
            <input type="text" id="search-input" class="search-input" placeholder="Search in content...">
        </section>`;
  }

  /**
   * Generate chunk card
   */
  generateChunkCard(chunk, index) {
    return `
        <div class="chunk-card" data-chunk-index="${index}">
            <div class="chunk-title">Chunk ${index + 1}</div>
            <div class="chunk-meta">
                ${chunk.tokens.toLocaleString()} tokens • ${chunk.metadata?.type || 'unknown'}
                ${chunk.metadata?.filePath ? `<br>File: ${chunk.metadata.filePath}` : ''}
            </div>
            <div class="chunk-actions">
                <a href="chunks/chunk-${index + 1}.html" class="btn btn-primary">View</a>
                <button onclick="copyChunkContent(${index})" class="btn btn-copy">Copy</button>
            </div>
            <div class="chunk-content" style="display: none;">
                <pre><code>${this.escapeHtml(chunk.content)}</code></pre>
            </div>
        </div>`;
  }

  /**
   * Format bytes
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Escape HTML characters
   */
  escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, function(m) { return map[m]; });
  }
}

module.exports = HtmlExporter;
