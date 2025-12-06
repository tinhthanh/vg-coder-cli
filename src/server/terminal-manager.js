const os = require('os');
const pty = require('node-pty');

class TerminalManager {
    constructor() {
        // Map: termId -> { process: pty, socketId: string }
        this.sessions = new Map();
        this.shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';
    }

    createTerminal(socket, termId, cols = 80, rows = 24, cwd) {
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
                socketId: socket.id
            });

            // Gửi dữ liệu kèm theo termId để Frontend biết của cửa sổ nào
            term.onData((data) => {
                socket.emit('terminal:data', { termId, data });
            });

            term.onExit(() => {
                if (this.sessions.has(termId)) {
                    socket.emit('terminal:exit', { termId });
                    this.sessions.delete(termId);
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
            }
        }
    }
}

module.exports = new TerminalManager();
