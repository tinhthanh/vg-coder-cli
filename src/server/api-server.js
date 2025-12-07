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
        // Nhận event init với termId
        socket.on('terminal:init', (data) => {
            if (!data || !data.termId) {
                return;
            }
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

    this.app.get('/api/git/diff', async (req, res) => {
      try {
        // 1. Lấy diff của các file đã track (modified, deleted, staged)
        const { stdout: diffStdout } = await execAsync('git diff HEAD', { 
            cwd: this.workingDir,
            maxBuffer: 20 * 1024 * 1024 
        });

        // 2. Lấy danh sách untracked files (files mới tạo chưa add)
        const { stdout: untrackedStdout } = await execAsync('git ls-files --others --exclude-standard', {
            cwd: this.workingDir,
            maxBuffer: 20 * 1024 * 1024
        });

        let combinedDiff = diffStdout || '';
        const untrackedFiles = untrackedStdout.split('\n').filter(f => f.trim());

        // 3. Tạo diff giả lập cho untracked files để hiển thị trên UI
        if (untrackedFiles.length > 0) {
            if (combinedDiff && !combinedDiff.endsWith('\n')) combinedDiff += '\n';

            for (const file of untrackedFiles) {
                try {
                    const filePath = path.join(this.workingDir, file);
                    const stat = await fs.stat(filePath);
                    if (stat.isDirectory()) continue;

                    const content = await fs.readFile(filePath, 'utf8');
                    
                    // Tạo header giống git diff
                    combinedDiff += `diff --git a/${file} b/${file}\n`;
                    combinedDiff += `new file mode 100644\n`;
                    combinedDiff += `--- /dev/null\n`;
                    combinedDiff += `+++ b/${file}\n`;
                    
                    if (content.length > 0) {
                        const lines = content.split('\n');
                        combinedDiff += `@@ -0,0 +1,${lines.length} @@\n`;
                        lines.forEach(line => {
                            combinedDiff += `+${line}\n`;
                        });
                    }
                    combinedDiff += `\n`;
                } catch (err) {
                    // Bỏ qua nếu lỗi đọc file (vd: binary)
                }
            }
        }

        res.json({ diff: combinedDiff });
      } catch (error) {
        console.error(chalk.red('❌ [GIT] Error:'), error.message);
        res.json({ diff: '', error: error.message });
      }
    });

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
