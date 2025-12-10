const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs-extra');
const chalk = require('chalk');
const http = require('http');
const { Server } = require('socket.io');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);
const packageJson = require('../../package.json');

const ProjectDetector = require('../detectors/project-detector');
const FileScanner = require('../scanner/file-scanner');
const TokenManager = require('../tokenizer/token-manager');
const BashExecutor = require('../utils/bash-executor');
const terminalManager = require('./terminal-manager');

class ApiServer {
  constructor(port = 6868) {
    this.port = port;
    this.app = express();
    
    // Create HTTP server for Socket.IO
    this.httpServer = http.createServer(this.app);
    this.io = new Server(this.httpServer, {
        cors: { origin: "*" }
    });
    
    this.server = null;
    this.workingDir = process.cwd();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupSocketIO();
  }

  setupMiddleware() {
    this.app.use(cors());
    this.app.use(bodyParser.json({ limit: '50mb' }));
    this.app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));
    this.app.use(express.static(path.join(__dirname, 'views')));
    
    this.app.use((req, res, next) => {
      if (!req.path.includes('.')) {
          console.log(chalk.blue(`[REQ] ${req.method} ${req.path}`));
      }
      next();
    });
  }

  setupSocketIO() {
    this.io.on('connection', (socket) => {
        socket.on('terminal:init', (data) => {
            if (!data || !data.termId) return;
            const { termId, cols, rows } = data;
            terminalManager.createTerminal(socket, termId, cols, rows, this.workingDir);
        });

        socket.on('terminal:input', (data) => {
             if (data && data.termId) {
                terminalManager.write(data.termId, data.data);
             }
        });

        socket.on('terminal:resize', (data) => {
            if (data && data.termId) {
                terminalManager.resize(data.termId, data.cols, data.rows);
            }
        });
        
        socket.on('terminal:kill', (data) => {
            if (data && data.termId) {
                terminalManager.kill(data.termId);
            }
        });

        socket.on('disconnect', () => {
            terminalManager.cleanupSocket(socket.id);
        });
    });
  }

  setupRoutes() {
    this.app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'views', 'dashboard.html')));
    this.app.get('/health', (req, res) => res.json({ status: 'ok', version: packageJson.version }));

    this.app.get('/api/extension-path', (req, res) => {
      try {
        const extensionPath = path.join(__dirname, 'views', 'vg-coder');
        res.json({ path: extensionPath, exists: fs.existsSync(extensionPath) });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // --- FILE OPERATIONS (NEW) ---
    
    // Read raw file content
    this.app.get('/api/read-file', async (req, res) => {
        try {
            const filePath = req.query.path;
            if (!filePath) return res.status(400).json({ error: 'Missing path' });
            
            // Prevent directory traversal (basic check)
            const resolvedPath = path.resolve(this.workingDir, filePath);
            if (!resolvedPath.startsWith(this.workingDir)) {
                // Allow reading but log warning - in dev tool we might want flexibility
                // For strict mode: return res.status(403).json({ error: 'Access denied' });
            }

            if (!await fs.pathExists(resolvedPath)) {
                return res.status(404).json({ error: 'File not found' });
            }

            const content = await fs.readFile(resolvedPath, 'utf8');
            res.json({ content, path: filePath });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // Save file content
    this.app.post('/api/save-file', async (req, res) => {
        try {
            const { path: filePath, content } = req.body;
            if (!filePath || content === undefined) return res.status(400).json({ error: 'Missing data' });
            
            const resolvedPath = path.resolve(this.workingDir, filePath);
            
            // Security check
            if (!resolvedPath.startsWith(this.workingDir)) {
                 // For strict mode: return res.status(403).json({ error: 'Access denied' });
            }

            await fs.writeFile(resolvedPath, content, 'utf8');
            res.json({ success: true });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // --- GIT API START ---

    // Get Git Status
    this.app.get('/api/git/status', async (req, res) => {
        try {
            const { stdout } = await execAsync('git status --porcelain -u', { cwd: this.workingDir });
            
            const staged = [];
            const unstaged = [];
            const untracked = [];

            const lines = stdout.split('\n').filter(l => l.trim());
            
            lines.forEach(line => {
                const x = line[0];
                const y = line[1];
                const path = line.substring(3);

                if (x !== ' ' && x !== '?') {
                    staged.push({ path, status: x });
                }

                if (y !== ' ') {
                    if (x === '?' && y === '?') {
                        untracked.push({ path, status: 'U' });
                    } else {
                        unstaged.push({ path, status: y });
                    }
                }
            });

            const changes = [...unstaged, ...untracked];
            res.json({ staged, changes });
        } catch (error) {
            console.error(chalk.red('❌ [GIT STATUS] Error:'), error.message);
            res.status(500).json({ error: error.message });
        }
    });

    // Git Stage
    this.app.post('/api/git/stage', async (req, res) => {
        try {
            const { files } = req.body;
            const target = files.includes('*') ? '.' : files.map(f => `"${f}"`).join(' ');
            await execAsync(`git add ${target}`, { cwd: this.workingDir });
            res.json({ success: true });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // Git Unstage
    this.app.post('/api/git/unstage', async (req, res) => {
        try {
            const { files } = req.body;
            const target = files.includes('*') ? '' : files.map(f => `"${f}"`).join(' ');
            await execAsync(`git reset HEAD ${target}`, { cwd: this.workingDir });
            res.json({ success: true });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // Git Discard
    this.app.post('/api/git/discard', async (req, res) => {
        try {
            const { files } = req.body;
            if (files.includes('*')) {
                try { await execAsync('git restore .', { cwd: this.workingDir }); } catch (e) {}
                try { await execAsync('git clean -fd', { cwd: this.workingDir }); } catch (e) {}
            } else {
                for (const file of files) {
                    try { await execAsync(`git restore "${file}"`, { cwd: this.workingDir }); } catch (e) {}
                    try { await execAsync(`git clean -f "${file}"`, { cwd: this.workingDir }); } catch (e) {}
                }
            }
            res.json({ success: true });
        } catch (error) {
            console.error('Discard error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // Git Commit
    this.app.post('/api/git/commit', async (req, res) => {
        try {
            const { message } = req.body;
            if (!message) throw new Error('Commit message is required');
            const safeMessage = message.replace(/"/g, '\\"');
            await execAsync(`git commit -m "${safeMessage}"`, { cwd: this.workingDir });
            res.json({ success: true });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // Get Diff
    this.app.get('/api/git/diff', async (req, res) => {
      try {
        const file = req.query.file;
        const type = req.query.type || 'working';

        let cmd = '';
        if (type === 'staged') {
            cmd = file ? `git diff --cached -- "${file}"` : `git diff --cached`;
        } else {
            if (file) {
                 try {
                     const filePath = path.join(this.workingDir, file);
                     if (await fs.pathExists(filePath)) {
                         const stat = await fs.stat(filePath);
                         if (stat.isDirectory()) return res.json({ diff: '' });
                     }
                 } catch (e) {}
                 const { stdout: isUntracked } = await execAsync(`git ls-files --others --exclude-standard "${file}"`, { cwd: this.workingDir });
                 if (isUntracked.trim()) {
                     const content = await fs.readFile(path.join(this.workingDir, file), 'utf8');
                     let fakeDiff = `diff --git a/${file} b/${file}\nnew file mode 100644\n--- /dev/null\n+++ b/${file}\n@@ -0,0 +1,${content.split('\n').length} @@\n`;
                     content.split('\n').forEach(l => fakeDiff += `+${l}\n`);
                     return res.json({ diff: fakeDiff });
                 }
                 cmd = `git diff -- "${file}"`;
            } else {
                 cmd = `git diff`;
            }
        }
        const { stdout } = await execAsync(cmd, { cwd: this.workingDir, maxBuffer: 20 * 1024 * 1024 });
        res.json({ diff: stdout });
      } catch (error) {
        console.error(chalk.red('❌ [GIT DIFF] Error:'), error.message);
        res.json({ diff: '', error: error.message });
      }
    });

    // --- GENERAL API ---

    this.app.post('/api/analyze', async (req, res) => {
        const { path: projectPath, options = {}, specificFiles } = req.body;
        if (!projectPath) return res.status(400).json({ error: 'Missing path' });
        const resolvedPath = path.resolve(projectPath);
        if (!await fs.pathExists(resolvedPath)) return res.status(404).json({ error: 'Path not found' });
        const scanner = new FileScanner(resolvedPath, {
          extensions: options.extensions ? options.extensions.split(',') : undefined,
          includeHidden: options.includeHidden
        });
        let scanResult = await scanner.scanProject();
        let filesToProcess = scanResult.files;
        if (specificFiles?.length) filesToProcess = filesToProcess.filter(f => specificFiles.includes(f.relativePath));
        const content = await scanner.createCombinedContentForAI(filesToProcess, { includeStats: true, preserveLineNumbers: true });
        res.send(content);
    });

    this.app.get('/api/info', async (req, res) => {
        const projectPath = req.query.path;
        if (!projectPath) return res.status(400).json({ error: 'Missing path' });
        const resolvedPath = path.resolve(projectPath);
        const detector = new ProjectDetector(resolvedPath);
        const projectInfo = await detector.detectAll();
        const scanner = new FileScanner(resolvedPath);
        const scanResult = await scanner.scanProject();
        res.json({ path: resolvedPath, primaryType: projectInfo.primary, stats: { totalFiles: scanResult.files.length } });
    });

    this.app.get('/api/structure', async (req, res) => {
        const projectPath = req.query.path || '.';
        const resolvedPath = path.resolve(projectPath);
        const scanner = new FileScanner(resolvedPath);
        const scanResult = await scanner.scanProject();
        const tokenManager = new TokenManager();
        const enrichedTree = tokenManager.analyzeTree(scanResult.tree, scanResult.files);
        res.json({ path: resolvedPath, structure: enrichedTree });
    });

    this.app.post('/api/execute', async (req, res) => {
        const { bash } = req.body;
        const executor = new BashExecutor(this.workingDir);
        const result = await executor.execute(bash);
        res.status(result.success ? 200 : 400).json(result);
    });
    
    this.app.delete('/api/clean', async (req, res) => {
        await fs.remove(path.resolve(req.body.output));
        res.json({ success: true });
    });
  }

  async start() {
    return new Promise((resolve) => {
      this.server = this.httpServer.listen(this.port, () => {
        console.log(chalk.green(`\n🚀 VG Coder API Server & Socket.IO started on port ${this.port}`));
        resolve();
      });
    });
  }

  async stop() {
    if (this.server) this.server.close();
  }
}

module.exports = ApiServer;
