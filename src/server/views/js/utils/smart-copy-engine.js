/**
 * Smart Copy Engine
 * Implements 4 copy strategies for terminal logs with token optimization
 */

// Import log utils (will be available globally in browser)
const LogUtils = typeof window !== 'undefined' ? window.LogUtils : require('./log-utils.js');

/**
 * Generate Smart Copy (optimized for 3000 token limit)
 * Strategy:
 * - If < 3000 tokens: copy all
 * - If > 3000 tokens: first 50 + all errors + last 50 + summary
 * 
 * @param {string[]} lines - Array of log lines
 * @param {number} maxTokens - Maximum token limit (default: 3000)
 * @returns {Object} {content, tokens, strategy, stats}
 */
function generateSmartCopy(lines, maxTokens = 3000) {
    if (!lines || lines.length === 0) {
        return { content: '', tokens: 0, strategy: 'smart', stats: { totalLines: 0 } };
    }
    
    // Strip ANSI codes from all lines
    const cleanLines = lines.map(line => LogUtils.stripAnsiCodes(line));
    
    // Check if we can copy everything
    const fullContent = cleanLines.join('\n');
    const fullTokens = LogUtils.estimateTokens(fullContent);
    
    if (fullTokens <= maxTokens) {
        return {
            content: fullContent,
            tokens: fullTokens,
            strategy: 'smart-full',
            stats: {
                totalLines: cleanLines.length,
                message: 'Full log (within token limit)'
            }
        };
    }
    
    // Need to optimize - extract components
    const startLines = cleanLines.slice(0, 50);
    const endLines = cleanLines.slice(-50);
    const errorLines = LogUtils.extractErrors(cleanLines);
    
    // Build optimized content
    const sections = [];
    
    // Header
    sections.push('=== APPLICATION LOG (Smart Copy) ===\n');
    
    // Startup section
    sections.push('[STARTUP - First 50 lines]');
    sections.push(startLines.join('\n'));
    sections.push('');
    
    // Errors section (if any)
    if (errorLines.length > 0) {
        sections.push(`[ERRORS & WARNINGS - ${errorLines.length} lines]`);
        sections.push(errorLines.map(e => e.line).join('\n'));
        sections.push('');
    }
    
    // Recent section
    sections.push('[RECENT - Last 50 lines]');
    sections.push(endLines.join('\n'));
    sections.push('');
    
    // Summary
    const skippedLines = cleanLines.length - 100 - errorLines.length;
    if (skippedLines > 0) {
        sections.push(`[Summary: Skipped ${skippedLines} normal log lines]`);
    }
    
    const content = sections.join('\n');
    const tokens = LogUtils.estimateTokens(content);
    
    return {
        content,
        tokens,
        strategy: 'smart-optimized',
        stats: {
            totalLines: cleanLines.length,
            startupLines: 50,
            errorLines: errorLines.length,
            recentLines: 50,
            skippedLines,
            message: `Optimized from ${cleanLines.length} lines`
        }
    };
}

/**
 * Generate Errors Only Copy
 * Only includes error/warning lines with 2-line context
 * 
 * @param {string[]} lines - Array of log lines
 * @returns {Object} {content, tokens, strategy, stats}
 */
function generateErrorsOnly(lines) {
    if (!lines || lines.length === 0) {
        return { content: '', tokens: 0, strategy: 'errors', stats: { totalLines: 0 } };
    }
    
    const cleanLines = lines.map(line => LogUtils.stripAnsiCodes(line));
    const errorLines = LogUtils.extractErrors(cleanLines, 2);
    
    if (errorLines.length === 0) {
        const content = '=== NO ERRORS OR WARNINGS FOUND ===';
        return {
            content,
            tokens: LogUtils.estimateTokens(content),
            strategy: 'errors',
            stats: {
                totalLines: cleanLines.length,
                errorLines: 0,
                message: 'No errors found'
            }
        };
    }
    
    const sections = [];
    sections.push('=== ERRORS & WARNINGS ONLY ===\n');
    sections.push(errorLines.map(e => e.line).join('\n'));
    
    const content = sections.join('\n');
    const tokens = LogUtils.estimateTokens(content);
    
    return {
        content,
        tokens,
        strategy: 'errors',
        stats: {
            totalLines: cleanLines.length,
            errorLines: errorLines.length,
            message: `Found ${errorLines.length} error/warning lines with context`
        }
    };
}

/**
 * Generate Recent Copy
 * Copy last N lines (default: 200)
 * 
 * @param {string[]} lines - Array of log lines
 * @param {number} count - Number of recent lines to copy (default: 200)
 * @returns {Object} {content, tokens, strategy, stats}
 */
function generateRecent(lines, count = 200) {
    if (!lines || lines.length === 0) {
        return { content: '', tokens: 0, strategy: 'recent', stats: { totalLines: 0 } };
    }
    
    const cleanLines = lines.map(line => LogUtils.stripAnsiCodes(line));
    const recentLines = cleanLines.slice(-count);
    
    const sections = [];
    sections.push(`=== RECENT ${count} LINES ===\n`);
    sections.push(recentLines.join('\n'));
    
    if (cleanLines.length > count) {
        sections.push('');
        sections.push(`[Note: Showing last ${count} of ${cleanLines.length} total lines]`);
    }
    
    const content = sections.join('\n');
    const tokens = LogUtils.estimateTokens(content);
    
    return {
        content,
        tokens,
        strategy: 'recent',
        stats: {
            totalLines: cleanLines.length,
            recentLines: recentLines.length,
            message: `Last ${recentLines.length} lines`
        }
    };
}

/**
 * Generate Copy All
 * Copy entire log with warning if > 5000 tokens
 * 
 * @param {string[]} lines - Array of log lines
 * @returns {Object} {content, tokens, strategy, stats, warning}
 */
function generateCopyAll(lines) {
    if (!lines || lines.length === 0) {
        return { content: '', tokens: 0, strategy: 'all', stats: { totalLines: 0 } };
    }
    
    const cleanLines = lines.map(line => LogUtils.stripAnsiCodes(line));
    const content = cleanLines.join('\n');
    const tokens = LogUtils.estimateTokens(content);
    
    const result = {
        content,
        tokens,
        strategy: 'all',
        stats: {
            totalLines: cleanLines.length,
            message: `Full log (${cleanLines.length} lines)`
        }
    };
    
    // Add warning if too large
    if (tokens > 5000) {
        result.warning = `⚠️ Large log: ${tokens} tokens may exceed AI context limits`;
    }
    
    return result;
}

/**
 * Analyze log buffer and return stats for all strategies
 * Used to update button badges in real-time
 * 
 * @param {string[]} lines - Array of log lines
 * @returns {Object} Stats for all 4 strategies
 */
function analyzeLogBuffer(lines) {
    if (!lines || lines.length === 0) {
        return {
            smart: { tokens: 0, lines: 0 },
            errors: { tokens: 0, lines: 0 },
            recent: { tokens: 0, lines: 0 },
            all: { tokens: 0, lines: 0 }
        };
    }
    
    const cleanLines = lines.map(line => LogUtils.stripAnsiCodes(line));
    const errorLines = LogUtils.extractErrors(cleanLines);
    
    // Estimate for each strategy
    const smartResult = generateSmartCopy(lines, 3000);
    const recentLines = cleanLines.slice(-200);
    const allContent = cleanLines.join('\n');
    
    return {
        smart: {
            tokens: smartResult.tokens,
            lines: cleanLines.length,
            optimized: smartResult.strategy === 'smart-optimized'
        },
        errors: {
            tokens: LogUtils.estimateTokens(errorLines.map(e => e.line).join('\n')),
            lines: errorLines.length
        },
        recent: {
            tokens: LogUtils.estimateTokens(recentLines.join('\n')),
            lines: Math.min(200, cleanLines.length)
        },
        all: {
            tokens: LogUtils.estimateTokens(allContent),
            lines: cleanLines.length
        }
    };
}

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        generateSmartCopy,
        generateErrorsOnly,
        generateRecent,
        generateCopyAll,
        analyzeLogBuffer
    };
}

// Export for browser
if (typeof window !== 'undefined') {
    window.SmartCopyEngine = {
        generateSmartCopy,
        generateErrorsOnly,
        generateRecent,
        generateCopyAll,
        analyzeLogBuffer
    };
}
