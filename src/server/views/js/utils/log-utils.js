/**
 * Log Utilities for Smart Log Copy Feature
 * Provides ANSI stripping, token estimation, and log classification
 */

/**
 * Strip ANSI escape codes from text
 * Removes color codes, cursor movements, and other terminal control sequences
 * @param {string} text - Text with potential ANSI codes
 * @returns {string} Clean text without ANSI codes
 */
function stripAnsiCodes(text) {
    if (!text) return '';
    
    // Remove ANSI escape sequences
    // Pattern matches: ESC [ ... m (colors, styles)
    //                  ESC [ ... H/J/K (cursor movements, clear)
    //                  ESC ] ... BEL/ST (operating system commands)
    return text.replace(
        // eslint-disable-next-line no-control-regex
        /\x1b\[[0-9;]*[a-zA-Z]|\x1b\][^\x07]*\x07|\x1b\][^\x1b]*\x1b\\/g,
        ''
    );
}

/**
 * Estimate token count from text
 * Uses approximation: 1 token ≈ 4 characters (for English/code)
 * This is a simplified estimation and may vary ±20% from actual tokenization
 * @param {string} text - Text to estimate
 * @returns {number} Estimated token count
 */
function estimateTokens(text) {
    if (!text) return 0;
    
    const chars = text.length;
    const words = text.split(/\s+/).filter(w => w.length > 0).length;
    
    // Use the maximum of two methods for better accuracy:
    // Method 1: 1 token ≈ 0.75 words
    // Method 2: 1 token ≈ 4 characters
    const tokensFromWords = Math.ceil(words / 0.75);
    const tokensFromChars = Math.ceil(chars / 4);
    
    return Math.max(tokensFromWords, tokensFromChars);
}

/**
 * Classify a log line by severity
 * @param {string} line - Single log line
 * @returns {'ERROR'|'WARNING'|'NORMAL'} Classification
 */
function classifyLogLine(line) {
    if (!line) return 'NORMAL';
    
    const lowerLine = line.toLowerCase();
    
    // Error patterns
    const errorPatterns = [
        'error', 'err:', 'exception', 'fatal', 'failed', 'failure',
        'cannot', 'could not', 'unable to', 'not found', '404',
        'stack trace', 'traceback', 'segmentation fault', 'core dumped'
    ];
    
    // Warning patterns
    const warningPatterns = [
        'warn', 'warning', 'deprecated', 'deprecation',
        'caution', 'attention', 'notice'
    ];
    
    // Check for errors first (higher priority)
    if (errorPatterns.some(pattern => lowerLine.includes(pattern))) {
        return 'ERROR';
    }
    
    // Then check for warnings
    if (warningPatterns.some(pattern => lowerLine.includes(pattern))) {
        return 'WARNING';
    }
    
    return 'NORMAL';
}

/**
 * Extract error and warning lines with context
 * @param {string[]} lines - Array of log lines
 * @param {number} contextLines - Number of lines before/after to include (default: 2)
 * @returns {Object[]} Array of {lineIndex, line, type, context}
 */
function extractErrors(lines, contextLines = 2) {
    const errors = [];
    const includedIndices = new Set();
    
    // First pass: identify error/warning lines
    lines.forEach((line, index) => {
        const type = classifyLogLine(line);
        if (type === 'ERROR' || type === 'WARNING') {
            // Include the error line and context
            const startIndex = Math.max(0, index - contextLines);
            const endIndex = Math.min(lines.length - 1, index + contextLines);
            
            for (let i = startIndex; i <= endIndex; i++) {
                includedIndices.add(i);
            }
            
            errors.push({
                lineIndex: index,
                line,
                type,
                contextStart: startIndex,
                contextEnd: endIndex
            });
        }
    });
    
    // Second pass: build result with context
    const result = [];
    const sortedIndices = Array.from(includedIndices).sort((a, b) => a - b);
    
    sortedIndices.forEach(index => {
        result.push({
            lineIndex: index,
            line: lines[index],
            type: classifyLogLine(lines[index])
        });
    });
    
    return result;
}

/**
 * Format file size in human-readable format
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted size
 */
function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        stripAnsiCodes,
        estimateTokens,
        classifyLogLine,
        extractErrors,
        formatBytes
    };
}

// Export for browser
if (typeof window !== 'undefined') {
    window.LogUtils = {
        stripAnsiCodes,
        estimateTokens,
        classifyLogLine,
        extractErrors,
        formatBytes
    };
}
