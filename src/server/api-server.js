const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs-extra');
const chalk = require('chalk');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);
const packageJson = require('../../package.json');

const ProjectDetector = require('../detectors/project-detector');
const FileScanner = require('../scanner/file-scanner');
const TokenManager = require('../tokenizer/token-manager');
const BashExecutor = require('../utils/bash-executor');

class ApiServer {
  constructor(port = 6868) {
    this.port = port;
    this.app = express();
    this.server = null;
    this.workingDir = process.cwd();
    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    this.app.use(cors());
    this.app.use(bodyParser.json({ limit: '50mb' }));
    this.app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));
    this.app.use(express.static(path.join(__dirname, 'views')));
    
    this.app.use((req, res, next) => {
      // Log request ngắn gọn
      if (!req.path.includes('.')) {
          console.log(chalk.blue(`[REQ] ${req.method} ${req.path}`));
      }
      next();
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

    // --- DEBUG GIT DIFF ENDPOINT ---
    this.app.get('/api/git/diff', async (req, res) => {
      console.log(chalk.yellow('⚡ [GIT] Executing: git diff HEAD'));
      try {
        // Tăng maxBuffer lên 20MB đề phòng diff lớn
        const { stdout, stderr } = await execAsync('git diff HEAD', { 
            cwd: this.workingDir,
            maxBuffer: 20 * 1024 * 1024 
        });
        
        console.log(chalk.green(`✅ [GIT] Success. Output length: ${stdout.length} chars`));
        if (stderr) console.log(chalk.red(`⚠️ [GIT] Stderr: ${stderr}`));

        res.json({ diff: stdout });
        
      } catch (error) {
        console.error(chalk.red('❌ [GIT] Error:'), error.message);
        res.json({ diff: '', error: error.message });
      }
    });

    // ... (Các endpoint cũ giữ nguyên: analyze, info, structure, clean, execute) ...
    // Để tiết kiệm không gian, tôi giữ nguyên phần logic cũ của các endpoint khác
    // trong thực tế bạn không nên xoá chúng.
    
    this.app.post('/api/analyze', async (req, res) => { /* Logic cũ... */ 
        const { path: projectPath, options = {}, specificFiles } = req.body;
        if (!projectPath) return res.status(400).json({ error: 'Missing path' });
        const resolvedPath = path.resolve(projectPath);
        if (!await fs.pathExists(resolvedPath)) return res.status(404).json({ error: 'Path not found' });
        const detector = new ProjectDetector(resolvedPath);
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

    this.app.get('/api/info', async (req, res) => { /* Logic cũ... */
        const projectPath = req.query.path;
        if (!projectPath) return res.status(400).json({ error: 'Missing path' });
        const resolvedPath = path.resolve(projectPath);
        const detector = new ProjectDetector(resolvedPath);
        const projectInfo = await detector.detectAll();
        const scanner = new FileScanner(resolvedPath);
        const scanResult = await scanner.scanProject();
        res.json({ path: resolvedPath, primaryType: projectInfo.primary, stats: { totalFiles: scanResult.files.length } });
    });

    this.app.get('/api/structure', async (req, res) => { /* Logic cũ... */
        const projectPath = req.query.path || '.';
        const resolvedPath = path.resolve(projectPath);
        const scanner = new FileScanner(resolvedPath);
        const scanResult = await scanner.scanProject();
        const tokenManager = new TokenManager();
        const enrichedTree = tokenManager.analyzeTree(scanResult.tree, scanResult.files);
        res.json({ path: resolvedPath, structure: enrichedTree });
    });

    this.app.post('/api/execute', async (req, res) => { /* Logic cũ... */
        const { bash } = req.body;
        const executor = new BashExecutor(this.workingDir);
        const result = await executor.execute(bash);
        res.status(result.success ? 200 : 400).json(result);
    });
    
    this.app.delete('/api/clean', async (req, res) => { /* Logic cũ... */
        await fs.remove(path.resolve(req.body.output));
        res.json({ success: true });
    });
  }

  async start() {
    return new Promise((resolve) => {
      this.server = this.app.listen(this.port, () => {
        console.log(chalk.green(`\n🚀 VG Coder API Server started on port ${this.port}`));
        resolve();
      });
    });
  }

  async stop() {
    if (this.server) this.server.close();
  }
}

module.exports = ApiServer;
