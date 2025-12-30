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
const projectManager = require('./project-manager');

class ApiServer {
  constructor(port = 6868) {
    this.port = port;
    this.app = express();
    this.httpServer = http.createServer(this.app);
    this.io = new Server(this.httpServer, { cors: { origin: "*" } });
    this.workingDir = process.cwd();
    this.projectManager = projectManager;
    this.setupMiddleware();
    this.setupRoutes();
    this.setupSocketIO();
  }

  setupMiddleware() {
    this.app.use(cors());
    this.app.use(bodyParser.json({ limit: '50mb' }));
    this.app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));
    this.app.use(express.static(path.join(__dirname, 'views')));
    this.app.use('/dist', express.static(path.join(__dirname, '../../dist')));
    
    this.app.use((req, res, next) => {
      const activeProject = this.projectManager.getActiveProject();
      req.projectContext = activeProject;
      req.workingDir = activeProject ? activeProject.workingDir : this.workingDir;
      next();
    });
  }

  setupSocketIO() {
    this.io.on('connection', (socket) => {
        socket.on('terminal:init', (data) => {
            if (!data || !data.termId) return;
            const { termId, cols, rows, projectId } = data;
            let cwd;
            if (projectId) {
              const projects = this.projectManager.getAllProjects();
              const project = projects.find(p => p.id === projectId);
              cwd = project ? project.workingDir : this.workingDir;
            } else {
              const activeProject = this.projectManager.getActiveProject();
              cwd = activeProject ? activeProject.workingDir : this.workingDir;
            }
            terminalManager.createTerminal(socket, termId, cols, rows, cwd, projectId);
        });
        socket.on('terminal:input', (data) => { if (data && data.termId) terminalManager.write(data.termId, data.data); });
        socket.on('terminal:resize', (data) => { if (data && data.termId) terminalManager.resize(data.termId, data.cols, data.rows); });
        socket.on('terminal:kill', (data) => { if (data && data.termId) terminalManager.kill(data.termId); });
        socket.on('disconnect', () => { terminalManager.cleanupSocket(socket.id); });
    });
  }

  setupRoutes() {
    this.app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'views', 'dashboard.html')));
    this.app.get('/health', (req, res) => res.json({ status: 'ok', version: packageJson.version }));

    // File Ops
    this.app.get('/api/read-file', async (req, res) => {
        try {
            const filePath = req.query.path;
            const resolvedPath = path.resolve(req.workingDir, filePath);
            if (!await fs.pathExists(resolvedPath)) return res.status(404).json({ error: 'File not found' });
            const content = await fs.readFile(resolvedPath, 'utf8');
            res.json({ content, path: filePath });
        } catch (error) { res.status(500).json({ error: error.message }); }
    });

    this.app.post('/api/save-file', async (req, res) => {
        try {
            const { path: filePath, content } = req.body;
            const resolvedPath = path.resolve(req.workingDir, filePath);
            await fs.writeFile(resolvedPath, content, 'utf8');
            res.json({ success: true });
        } catch (error) { res.status(500).json({ error: error.message }); }
    });

    // Bash Execute
    this.app.post('/api/execute', async (req, res) => {
        const { bash } = req.body;
        const executor = new BashExecutor(req.workingDir);
        const result = await executor.execute(bash);
        res.status(result.success ? 200 : 400).json(result);
    });

    // Structure API
    this.app.get('/api/structure', async (req, res) => {
        const projectPath = req.query.path || '.';
        const resolvedPath = path.resolve(req.workingDir, projectPath);
        const scanner = new FileScanner(resolvedPath);
        const scanResult = await scanner.scanProject();
        const tokenManager = new TokenManager();
        const enrichedTree = tokenManager.analyzeTree(scanResult.tree, scanResult.files);
        res.json({ path: resolvedPath, structure: enrichedTree });
    });

    // Info API
    this.app.get('/api/info', async (req, res) => {
        const projectPath = req.query.path || '.';
        const resolvedPath = path.resolve(req.workingDir, projectPath);
        const detector = new ProjectDetector(resolvedPath);
        const projectInfo = await detector.detectAll();
        res.json({ path: resolvedPath, primaryType: projectInfo.primary });
    });

    // Analyze API
    this.app.post('/api/analyze', async (req, res) => {
        const { path: projectPath, options = {}, specificFiles } = req.body;
        const resolvedPath = path.resolve(req.workingDir, projectPath);
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

    // --- PROJECT MANAGEMENT APIS (FIXED) ---
    
    // List all projects
    this.app.get('/api/projects', (req, res) => {
      try {
        const projects = this.projectManager.getAllProjects();
        const activeProject = this.projectManager.getActiveProject();
        res.json({ projects, activeProjectId: activeProject ? activeProject.id : null, totalProjects: projects.length });
      } catch (error) { res.status(500).json({ error: error.message }); }
    });

    // Register new project (Required for join)
    this.app.post('/api/projects/register', (req, res) => {
      try {
        const { workingDir, name } = req.body;
        if (!workingDir) return res.status(400).json({ error: 'Missing workingDir' });

        const projectId = this.projectManager.registerProject(workingDir);
        const projects = this.projectManager.getAllProjects();

        this.io.emit('project:registered', { projectId, name: name || path.basename(workingDir) });

        res.json({ success: true, projectId, totalProjects: projects.length });
      } catch (error) { res.status(500).json({ error: error.message }); }
    });

    // Switch active project
    this.app.post('/api/projects/switch', (req, res) => {
      try {
        const { projectId } = req.body;
        const success = this.projectManager.switchProject(projectId);
        if (success) {
          const activeProject = this.projectManager.getActiveProject();
          this.io.emit('project:switched', { projectId, projectName: activeProject.name });
          res.json({ success: true, project: activeProject });
        } else res.status(404).json({ error: 'Project not found' });
      } catch (error) { res.status(500).json({ error: error.message }); }
    });

    // Remove project
    this.app.delete('/api/projects/:id', (req, res) => {
      try {
        const projectId = req.params.id;
        this.projectManager.removeProject(projectId);
        this.io.emit('project:removed', { projectId });
        res.json({ success: true });
      } catch (error) { res.status(500).json({ error: error.message }); }
    });

    // Git
    this.app.get('/api/git/status', async (req, res) => {
        try {
            const { stdout } = await execAsync('git status --porcelain -u', { cwd: req.workingDir });
            const staged = [], unstaged = [], untracked = [];
            stdout.split('\n').filter(l=>l).forEach(line => {
                const x = line[0], y = line[1], path = line.substring(3);
                if (x !== ' ' && x !== '?') staged.push({ path, status: x });
                if (y !== ' ') (x === '?' && y === '?') ? untracked.push({ path, status: 'U' }) : unstaged.push({ path, status: y });
            });
            res.json({ staged, changes: [...unstaged, ...untracked] });
        } catch (error) { res.status(500).json({ error: error.message }); }
    });

    // Git Diff
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
                     const filePath = path.join(req.workingDir, file);
                     if (await fs.pathExists(filePath)) {
                         const stat = await fs.stat(filePath);
                         if (stat.isDirectory()) return res.json({ diff: '' });
                     }
                 } catch (e) {}
                 
                 const { stdout: isUntracked } = await execAsync(`git ls-files --others --exclude-standard "${file}"`, { cwd: req.workingDir });
                 if (isUntracked.trim()) {
                     const content = await fs.readFile(path.join(req.workingDir, file), 'utf8');
                     let fakeDiff = `diff --git a/${file} b/${file}\nnew file mode 100644\n--- /dev/null\n+++ b/${file}\n@@ -0,0 +1,${content.split('\n').length} @@\n`;
                     content.split('\n').forEach(l => fakeDiff += `+${l}\n`);
                     return res.json({ diff: fakeDiff });
                 }
                 cmd = `git diff -- "${file}"`;
            } else {
                 cmd = `git diff`;
            }
        }
        const { stdout } = await execAsync(cmd, { cwd: req.workingDir, maxBuffer: 20 * 1024 * 1024 });
        res.json({ diff: stdout });
      } catch (error) {
        console.error(chalk.red('❌ [GIT DIFF] Error:'), error.message);
        res.json({ diff: '', error: error.message });
      }
    });

    // Git Stage
    this.app.post('/api/git/stage', async (req, res) => {
      try {
        const { files } = req.body;
        const fileList = Array.isArray(files) ? files : [files];
        
        if (fileList.includes('*')) {
          await execAsync('git add -A', { cwd: req.workingDir });
        } else {
          for (const file of fileList) {
            await execAsync(`git add "${file}"`, { cwd: req.workingDir });
          }
        }
        
        res.json({ success: true });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Git Unstage
    this.app.post('/api/git/unstage', async (req, res) => {
      try {
        const { files } = req.body;
        const fileList = Array.isArray(files) ? files : [files];
        
        if (fileList.includes('*')) {
          await execAsync('git reset HEAD', { cwd: req.workingDir });
        } else {
          for (const file of fileList) {
            await execAsync(`git reset HEAD "${file}"`, { cwd: req.workingDir });
          }
        }
        
        res.json({ success: true });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Git Commit
    this.app.post('/api/git/commit', async (req, res) => {
      try {
        const { message } = req.body;
        
        if (!message || !message.trim()) {
          return res.status(400).json({ error: 'Commit message is required' });
        }
        
        await execAsync(`git commit -m "${message.replace(/"/g, '\\"')}"`, { cwd: req.workingDir });
        res.json({ success: true });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Git Discard
    this.app.post('/api/git/discard', async (req, res) => {
      try {
        const { files } = req.body;
        const fileList = Array.isArray(files) ? files : [files];
        
        if (fileList.includes('*')) {
          // Discard all changes
          await execAsync('git checkout -- .', { cwd: req.workingDir });
          // Clean untracked files
          await execAsync('git clean -fd', { cwd: req.workingDir });
        } else {
          for (const file of fileList) {
            // Check if file is tracked
            try {
              await execAsync(`git ls-files --error-unmatch "${file}"`, { cwd: req.workingDir });
              // Tracked file - checkout
              await execAsync(`git checkout -- "${file}"`, { cwd: req.workingDir });
            } catch (e) {
              // Untracked file - remove
              await execAsync(`rm "${file}"`, { cwd: req.workingDir });
            }
          }
        }
        
        res.json({ success: true });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Tree State API
    this.app.post('/api/tree-state/save', async (req, res) => {
        try {
            const { excludedPaths } = req.body;
            const vgDir = path.join(req.workingDir, '.vg');
            await fs.ensureDir(vgDir);
            await fs.writeJson(path.join(vgDir, 'tree-state.json'), { excludedPaths }, { spaces: 2 });
            res.json({ success: true, count: excludedPaths.length });
        } catch (error) { res.status(500).json({ error: error.message }); }
    });

    this.app.get('/api/tree-state/load', async (req, res) => {
        try {
            const stateFile = path.join(req.workingDir, '.vg', 'tree-state.json');
            if (!await fs.pathExists(stateFile)) return res.json({ excludedPaths: [] });
            const data = await fs.readJson(stateFile);
            res.json({ excludedPaths: data.excludedPaths || [] });
        } catch (error) { res.status(500).json({ error: error.message }); }
    });

    // Commands
    this.app.get('/api/commands/load', async (req, res) => {
        try {
            const commandsFile = path.join(req.workingDir, '.vg', 'commands.json');
            if (!await fs.pathExists(commandsFile)) return res.json({ commands: [] });
            const data = await fs.readJson(commandsFile);
            res.json({ commands: data.commands || [] });
        } catch (error) { res.status(500).json({ error: error.message }); }
    });

    this.app.post('/api/commands/save', async (req, res) => {
        try {
            const { commands } = req.body;
            const vgDir = path.join(req.workingDir, '.vg');
            await fs.ensureDir(vgDir);
            await fs.writeJson(path.join(vgDir, 'commands.json'), { commands }, { spaces: 2 });
            res.json({ success: true, count: commands.length });
        } catch (error) { res.status(500).json({ error: error.message }); }
    });

    this.app.get('/api/extension-path', (req, res) => {
      try {
        const extensionPath = path.join(__dirname, 'views', 'vg-coder');
        res.json({ path: extensionPath, exists: fs.existsSync(extensionPath) });
      } catch (error) { res.status(500).json({ error: error.message }); }
    });
    
    this.app.post('/api/shutdown', async (req, res) => {
        res.json({ success: true });
        setTimeout(async () => { await this.stop(); process.exit(0); }, 500);
    });
  }

  async start() {
    return new Promise((resolve, reject) => {
        const tryPort = (port) => {
            const onError = (e) => {
                if (e.code === 'EADDRINUSE') {
                    this.httpServer.close();
                    tryPort(port + 1);
                } else {
                    this.httpServer.removeListener('error', onError);
                    reject(e);
                }
            };
            this.httpServer.once('error', onError);
            this.server = this.httpServer.listen(port, () => {
                this.httpServer.removeListener('error', onError);
                this.port = this.server.address().port;
                console.log(chalk.green(`🚀 Server Online: http://localhost:${this.port}`));
                console.log(chalk.blue(`📦 Dist served at: http://localhost:${this.port}/dist`));
                resolve();
            });
        };
        tryPort(this.port);
    });
  }

  async stop() {
    await this.projectManager.releaseLock();
    if (this.server) this.server.close();
  }
}

module.exports = ApiServer;
