const os = require('os');
const pty = require('node-pty');
const path = require('path');
const { stripAnsiCodes, classifyLogLine, extractErrors } = require(path.join(__dirname, 'views/js/utils/log-utils'));

class TerminalManager {
    constructor() {
        // Map: termId -> { process: pty, socketId: string, projectId: string }
        this.sessions = new Map();
        // Map: termId -> Array of log lines (circular buffer, max 10000)
        this.logBuffers = new Map();
        this.MAX_LOG_LINES = 10000;
        // Use full path to shell to avoid posix_spawnp errors
        if (os.platform() === 'win32') {
            this.shell = 'powershell.exe';
        } else if (os.platform() === 'darwin') {
            // macOS - use zsh (default shell since Catalina)
            this.shell = process.env.SHELL || '/bin/zsh';
        } else {
            // Linux and others
            this.shell = process.env.SHELL || '/bin/bash';
        }
    }

    createTerminal(socket, termId, cols = 80, rows = 24, cwd, projectId = null) {
        try {
            const term = pty.spawn(this.shell, [], {
                name: 'xterm-256color',
                cols: cols,
                rows: rows,
                cwd: cwd || process.cwd(),
                env: process.env
            });

            this.sessions.set(termId, {
                process: term,
                socketId: socket.id,
                projectId: projectId  // Store project association
            });

            // Initialize log buffer for this terminal
            this.logBuffers.set(termId, []);

            // Gửi dữ liệu kèm theo termId để Frontend biết của cửa sổ nào
            term.onData((data) => {
                // Store in log buffer (strip ANSI for storage)
                this.addToLogBuffer(termId, data);
                
                // Send raw data to frontend (keep ANSI for display)
                socket.emit('terminal:data', { termId, data });
            });

            term.onExit(() => {
                if (this.sessions.has(termId)) {
                    socket.emit('terminal:exit', { termId });
                    this.sessions.delete(termId);
                    // Clean up log buffer
                    this.logBuffers.delete(termId);
                }
            });

            return term;
        } catch (error) {
            console.error('Failed to create terminal:', error);
            socket.emit('terminal:error', { termId, error: 'Failed to create process' });
        }
    }

    write(termId, data) {
        const session = this.sessions.get(termId);
        if (session) {
            session.process.write(data);
        }
    }

    resize(termId, cols, rows) {
        const session = this.sessions.get(termId);
        if (session) {
            try {
                session.process.resize(cols, rows);
            } catch (err) {
                // Ignore resize errors
            }
        }
    }

    kill(termId) {
        const session = this.sessions.get(termId);
        if (session) {
            session.process.kill();
            this.sessions.delete(termId);
        }
    }

    // Dọn dẹp tất cả terminal của một socket khi client disconnect
    cleanupSocket(socketId) {
        for (const [termId, session] of this.sessions.entries()) {
            if (session.socketId === socketId) {
                session.process.kill();
                this.sessions.delete(termId);
                this.logBuffers.delete(termId);
            }
        }
    }

    /**
     * Add data to log buffer (circular buffer with max 10000 lines)
     * @param {string} termId - Terminal ID
     * @param {string} data - Raw terminal data (may contain ANSI codes)
     */
    addToLogBuffer(termId, data) {
        if (!this.logBuffers.has(termId)) {
            this.logBuffers.set(termId, []);
        }

        const buffer = this.logBuffers.get(termId);
        
        // Strip ANSI codes before storing
        const cleanData = stripAnsiCodes(data);
        
        // Split by newlines and add to buffer
        const lines = cleanData.split(/\r?\n/);
        
        lines.forEach(line => {
            // Only add non-empty lines
            if (line.trim().length > 0) {
                buffer.push(line);
                
                // Maintain circular buffer - remove oldest if exceeds limit
                if (buffer.length > this.MAX_LOG_LINES) {
                    buffer.shift();
                }
            }
        });
    }

    /**
     * Get log buffer for a terminal
     * @param {string} termId - Terminal ID
     * @returns {string[]} Array of log lines
     */
    getLogBuffer(termId) {
        return this.logBuffers.get(termId) || [];
    }

    /**
     * Analyze log buffer and return statistics
     * @param {string} termId - Terminal ID
     * @returns {Object} Analysis with error counts, line counts, etc.
     */
    analyzeLogBuffer(termId) {
        const lines = this.getLogBuffer(termId);
        
        if (lines.length === 0) {
            return {
                totalLines: 0,
                errorLines: 0,
                warningLines: 0,
                normalLines: 0,
                errors: []
            };
        }

        let errorCount = 0;
        let warningCount = 0;
        let normalCount = 0;

        lines.forEach(line => {
            const type = classifyLogLine(line);
            if (type === 'ERROR') errorCount++;
            else if (type === 'WARNING') warningCount++;
            else normalCount++;
        });

        const errors = extractErrors(lines, 2);

        return {
            totalLines: lines.length,
            errorLines: errorCount,
            warningLines: warningCount,
            normalLines: normalCount,
            errors: errors.map(e => ({
                line: e.line,
                type: e.type,
                lineIndex: e.lineIndex
            }))
        };
    }

    /**
     * Get all terminal IDs for a specific project
     * @param {string} projectId - Project ID
     * @returns {string[]} Array of terminal IDs
     */
    getProjectTerminals(projectId) {
        const terminals = [];
        for (const [termId, session] of this.sessions.entries()) {
            if (session.projectId === projectId) {
                terminals.push(termId);
            }
        }
        return terminals;
    }

    /**
     * Clean up all terminals for a project
     * @param {string} projectId - Project ID
     */
    cleanupProject(projectId) {
        const terminalsToRemove = this.getProjectTerminals(projectId);
        terminalsToRemove.forEach(termId => {
            this.kill(termId);
        });
        console.log(`Cleaned up ${terminalsToRemove.length} terminal(s) for project ${projectId}`);
    }
}

module.exports = new TerminalManager();
