const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs-extra');
const chalk = require('chalk');
const packageJson = require('../../package.json');

const ProjectDetector = require('../detectors/project-detector');
const FileScanner = require('../scanner/file-scanner');
const TokenManager = require('../tokenizer/token-manager');
const BashExecutor = require('../utils/bash-executor');

/**
 * API Server for VG Coder CLI
 */
class ApiServer {
  constructor(port = 6868) {
    this.port = port;
    this.app = express();
    this.server = null;
    this.workingDir = process.cwd(); // Track working directory
    this.setupMiddleware();
    this.setupRoutes();
  }

  /**
   * Setup Express middleware
   */
  setupMiddleware() {
    this.app.use(cors());
    this.app.use(bodyParser.json());
    this.app.use(bodyParser.urlencoded({ extended: true }));
    
    // Request logging
    this.app.use((req, res, next) => {
      console.log(chalk.blue(`[${new Date().toISOString()}] ${req.method} ${req.path}`));
      next();
    });
  }

  /**
   * Setup API routes
   */
  setupRoutes() {
    // Dashboard - serve HTML interface
    this.app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, 'views', 'dashboard.html'));
    });

    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        version: packageJson.version,
        timestamp: new Date().toISOString()
      });
    });

    // Analyze endpoint - returns project.txt file
    this.app.post('/api/analyze', async (req, res) => {
      try {
        const { path: projectPath, options = {} } = req.body;

        if (!projectPath) {
          return res.status(400).json({
            error: 'Missing required field: path'
          });
        }

        const resolvedPath = path.resolve(projectPath);

        // Validate project path
        if (!await fs.pathExists(resolvedPath)) {
          return res.status(404).json({
            error: `Project path does not exist: ${projectPath}`
          });
        }

        console.log(chalk.yellow(`Analyzing project: ${resolvedPath}`));

        // Detect project type
        const detector = new ProjectDetector(resolvedPath);
        const projectInfo = await detector.detectAll();

        // Scan files (no token limit, get all files)
        const scannerOptions = {
          extensions: options.extensions ? options.extensions.split(',').map(ext => ext.trim()) : undefined,
          includeHidden: options.includeHidden || false
        };

        const scanner = new FileScanner(resolvedPath, scannerOptions);
        const scanResult = await scanner.scanProject();

        // Create AI-friendly content
        const aiContent = await scanner.createCombinedContentForAI(scanResult.files, {
          includeStats: true,
          includeTree: true,
          preserveLineNumbers: true
        });

        // Set response headers for file download
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="project.txt"');
        res.send(aiContent);

        console.log(chalk.green(`✓ Analysis completed: ${scanResult.files.length} files`));

      } catch (error) {
        console.error(chalk.red('Error during analysis:'), error);
        res.status(500).json({
          error: 'Analysis failed',
          message: error.message
        });
      }
    });

    // Info endpoint
    this.app.get('/api/info', async (req, res) => {
      try {
        const projectPath = req.query.path;

        if (!projectPath) {
          return res.status(400).json({
            error: 'Missing required query parameter: path'
          });
        }

        const resolvedPath = path.resolve(projectPath);

        if (!await fs.pathExists(resolvedPath)) {
          return res.status(404).json({
            error: `Project path does not exist: ${projectPath}`
          });
        }

        // Detect project
        const detector = new ProjectDetector(resolvedPath);
        const projectInfo = await detector.detectAll();

        // Quick scan
        const scanner = new FileScanner(resolvedPath);
        const scanResult = await scanner.scanProject();

        // Token analysis
        const tokenManager = new TokenManager();
        const tokenAnalysis = tokenManager.analyzeFiles(scanResult.files);
        tokenManager.cleanup();

        const extensions = [...new Set(scanResult.files.map(f => f.extension))].filter(Boolean);

        res.json({
          path: resolvedPath,
          primaryType: projectInfo.primary,
          detectedTechnologies: projectInfo.detected,
          stats: {
            totalFiles: scanResult.stats.processedFiles,
            totalSize: scanResult.files.reduce((sum, f) => sum + f.size, 0),
            totalLines: scanResult.files.reduce((sum, f) => sum + f.lines, 0),
            extensions: extensions
          },
          tokens: {
            total: tokenAnalysis.summary.totalTokens,
            averagePerFile: tokenAnalysis.summary.averageTokensPerFile,
            filesExceedingLimit: tokenAnalysis.summary.filesExceedingLimit,
            estimatedChunks: tokenAnalysis.summary.estimatedChunks
          }
        });

        console.log(chalk.green(`✓ Info retrieved for: ${resolvedPath}`));

      } catch (error) {
        console.error(chalk.red('Error getting info:'), error);
        res.status(500).json({
          error: 'Failed to get project info',
          message: error.message
        });
      }
    });

    // Clean endpoint
    this.app.delete('/api/clean', async (req, res) => {
      try {
        const { output } = req.body;

        if (!output) {
          return res.status(400).json({
            error: 'Missing required field: output'
          });
        }

        const outputPath = path.resolve(output);

        if (await fs.pathExists(outputPath)) {
          await fs.remove(outputPath);
          res.json({
            success: true,
            message: `Cleaned: ${outputPath}`
          });
          console.log(chalk.green(`✓ Cleaned: ${outputPath}`));
        } else {
          res.json({
            success: true,
            message: 'Output directory does not exist'
          });
        }

      } catch (error) {
        console.error(chalk.red('Error cleaning:'), error);
        res.status(500).json({
          error: 'Failed to clean',
          message: error.message
        });
      }
    });

    // Execute bash script endpoint
    this.app.post('/api/execute', async (req, res) => {
      try {
        const { bash } = req.body;

        if (!bash) {
          return res.status(400).json({
            error: 'Missing required field: bash'
          });
        }

        console.log(chalk.yellow(`Executing bash script (${bash.length} chars)...`));

        // Create executor with working directory
        const executor = new BashExecutor(this.workingDir);

        // Execute script (validates syntax first, then executes)
        const result = await executor.execute(bash);

        if (result.success) {
          console.log(chalk.green(`✓ Bash execution completed in ${result.executionTime}ms`));
          res.json(result);
        } else {
          console.log(chalk.red(`✗ Bash execution failed: ${result.error || 'Exit code ' + result.exitCode}`));
          res.status(400).json(result);
        }

      } catch (error) {
        console.error(chalk.red('Error executing bash:'), error);
        res.status(500).json({
          error: 'Execution failed',
          message: error.message
        });
      }
    });

    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({
        error: 'Not found',
        message: `Route ${req.method} ${req.path} not found`
      });
    });

    // Error handler
    this.app.use((err, req, res, next) => {
      console.error(chalk.red('Server error:'), err);
      res.status(500).json({
        error: 'Internal server error',
        message: err.message
      });
    });
  }

  /**
   * Start the server
   */
  async start() {
    return new Promise((resolve, reject) => {
      this.server = this.app.listen(this.port, () => {
        console.log(chalk.green(`\n🚀 VG Coder API Server started!`));
        console.log(chalk.blue(`📡 Listening on: http://localhost:${this.port}`));
        console.log(chalk.cyan(`\n🎨 Dashboard: http://localhost:${this.port}`));
        console.log(chalk.yellow(`\n📚 Available endpoints:`));
        console.log(`  GET  /health           - Health check`);
        console.log(`  POST /api/analyze      - Analyze project (returns project.txt)`);
        console.log(`  GET  /api/info?path=.  - Get project info`);
        console.log(`  DELETE /api/clean      - Clean output directory`);
        console.log(`  POST /api/execute      - Execute bash script`);
        console.log(chalk.gray(`\n💡 Press Ctrl+C to stop the server\n`));
        resolve();
      });

      this.server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          console.error(chalk.red(`\n❌ Port ${this.port} is already in use!`));
          console.log(chalk.yellow(`Try using a different port with: vg start -p <port>\n`));
        } else {
          console.error(chalk.red('\n❌ Server error:'), err.message);
        }
        reject(err);
      });
    });
  }

  /**
   * Stop the server
   */
  async stop() {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          console.log(chalk.yellow('\n👋 Server stopped\n'));
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

module.exports = ApiServer;
