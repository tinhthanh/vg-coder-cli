// VG Coder Scripts

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
        const chunkElement = document.querySelector(`[data-chunk-index="${chunkIndex}"]`);
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
                alert(`Chunk ${chunkIndex + 1} content not found`);
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
    var specialChars = ['\\', '.', '*', '+', '?', '^', '$', '{', '}', '(', ')', '|', '[', ']'];
    var result = string;
    for (var i = 0; i < specialChars.length; i++) {
        result = result.split(specialChars[i]).join('\\' + specialChars[i]);
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
        const templateText = `Trả về với định dạng
Quy tắc bắt buộc:
Script phải có cú pháp:
mkdir -p $(dirname "path/to/file.ext")
cat <<'EOF' > path/to/file.ext
... toàn bộ nội dung file sau khi chỉnh sửa ...
EOF
Mỗi file cần thay đổi phải được ghi đè hoàn toàn bằng nội dung mới.
Nếu file chưa tồn tại, script sẽ tự tạo file và thư mục cha.`;

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
}