const { Command } = require('commander');
const path = require('path');
const fs = require('fs-extra');
const chalk = require('chalk');
const ora = require('ora');
const packageJson = require('../package.json');

const ProjectDetector = require('./detectors/project-detector');
const FileScanner = require('./scanner/file-scanner');
const TokenManager = require('./tokenizer/token-manager');
const HtmlExporter = require('./exporter/html-exporter');
const ClipboardManager = require('./utils/clipboard');
const ApiServer = require('./server/api-server');

class VGCoderCLI {
  constructor() {
    this.program = new Command();
    this.setupCommands();
  }

  setupCommands() {
    this.program
      .name('vg')
      .description('CLI tool để phân tích dự án, nối file mã nguồn, đếm token và xuất HTML')
      .version(packageJson.version);

    this.program
      .command('analyze [path]')
      .alias('a')
      .description('Phân tích dự án và tạo output HTML')
      .option('-o, --output <path>', 'Thư mục output', './vg-output')
      .option('-m, --max-tokens <number>', 'Số token tối đa mỗi chunk', '8000')
      .option('-t, --model <model>', 'Model AI để đếm token', 'gpt-4')
      .option('--extensions <extensions>', 'Danh sách extensions (comma-separated)')
      .option('--include-hidden', 'Bao gồm file ẩn')
      .option('--no-structure', 'Không ưu tiên giữ cấu trúc file')
      .option('--theme <theme>', 'Theme cho syntax highlighting', 'github')
      .option('--clipboard-only', 'Copy content to clipboard without creating files')
      .option('-c, --clipboard', 'Alias for --clipboard-only')
      .option('--save-txt', 'Save AI-friendly content to vg-projects.txt file')
      .action(this.handleAnalyze.bind(this));

    this.program
      .command('info [path]')
      .description('Hiển thị thông tin về dự án')
      .action(this.handleInfo.bind(this));

    this.program
      .command('clean')
      .description('Xóa thư mục output')
      .option('-o, --output <path>', 'Thư mục output', './vg-output')
      .action(this.handleClean.bind(this));

    this.program
      .command('start')
      .alias('s')
      .description('Khởi động API server')
      .option('-p, --port <port>', 'Port cho server', '6868')
      .action(this.handleStart.bind(this));
  }

  async handleAnalyze(projectPath, options) {
    const spinner = ora('Initializing analysis...').start();
    try {
      projectPath = path.resolve(projectPath || process.cwd());
      const clipboardMode = options.clipboardOnly || options.clipboard;
      const saveTxtMode = options.saveTxt;
      const specialMode = clipboardMode || saveTxtMode;
      const outputPath = specialMode ? null : path.resolve(options.output || './vg-output');
      
      if (!await fs.pathExists(projectPath)) {
        throw new Error(`Project path does not exist: ${projectPath}`);
      }
      if (!specialMode && !outputPath) {
        throw new Error('Output path is required for normal mode');
      }

      spinner.text = 'Detecting project type...';
      const detector = new ProjectDetector(projectPath);
      const projectInfo = await detector.detectAll();
      
      console.log(chalk.blue('\n📁 Project Detection:'));
      console.log(`Primary Type: ${chalk.green(projectInfo.primary)}`);

      spinner.text = 'Scanning files...';
      const scannerOptions = {
        maxTokens: parseInt(options.maxTokens),
        extensions: options.extensions ? options.extensions.split(',').map(ext => ext.trim()) : undefined,
        includeHidden: options.includeHidden
      };
      const scanner = new FileScanner(projectPath, scannerOptions);
      const scanResult = await scanner.scanProject();
      
      console.log(chalk.blue('\n📊 Scan Results:'));
      console.log(`Files Found: ${scanResult.stats.totalFiles}`);
      const treeStructure = scanner.renderProjectTree(scanResult.tree);

      spinner.text = 'Analyzing tokens...';
      const tokenManager = new TokenManager({
        model: options.model,
        maxTokens: parseInt(options.maxTokens),
        preserveStructure: options.structure !== false
      });
      const tokenAnalysis = tokenManager.analyzeFiles(scanResult.files);
      
      console.log(chalk.blue('\n🧮 Token Analysis:'));
      console.log(`Total Tokens: ${chalk.yellow(tokenAnalysis.summary.totalTokens.toLocaleString())}`);

      spinner.text = 'Creating content chunks...';

      if (clipboardMode) {
        const aiContent = await scanner.createCombinedContentForAI(scanResult.files, { includeStats: false, includeTree: false, preserveLineNumbers: true });
        await ClipboardManager.copyToClipboard(aiContent);
        tokenManager.cleanup();
        spinner.succeed('Content copied to clipboard successfully!');
        return;
      }

      if (saveTxtMode) {
        const aiContent = await scanner.createCombinedContentForAI(scanResult.files, { includeStats: false, includeTree: false, preserveLineNumbers: true });
        const outputFilePath = path.resolve('vg-projects.txt');
        await fs.writeFile(outputFilePath, aiContent, 'utf8');
        tokenManager.cleanup();
        spinner.succeed('Content saved to vg-projects.txt successfully!');
        return;
      }

      const combinedContent = await scanner.createCombinedContent(scanResult.files);
      const chunks = await tokenManager.chunkContent(combinedContent, {
        projectType: projectInfo.primary,
        projectPath: projectPath,
        totalFiles: scanResult.files.length
      });
      
      spinner.text = 'Generating HTML output...';
      const exporter = new HtmlExporter(outputPath, { theme: options.theme, title: `VG Coder Analysis - ${path.basename(projectPath)}` });
      
      const exportResult = await exporter.exportChunks(chunks, {
        projectType: projectInfo.primary,
        projectInfo: projectInfo,
        scanStats: scanResult.stats,
        tokenStats: tokenAnalysis.summary,
        directoryStructure: treeStructure,
        files: scanResult.files
      });
      
      tokenManager.cleanup();
      spinner.succeed('Analysis completed successfully!');
      console.log(chalk.blue('\n🌐 Open in browser:'));
      console.log(`file://${exportResult.indexPath}`);
      
    } catch (error) {
      spinner.fail('Analysis failed');
      console.error(chalk.red('\n❌ Error:'), error.message);
      process.exit(1);
    }
  }

  async handleInfo(projectPath, options) {
    const spinner = ora('Gathering project information...').start();
    try {
      projectPath = path.resolve(projectPath || process.cwd());
      if (!await fs.pathExists(projectPath)) {
        throw new Error(`Project path does not exist: ${projectPath}`);
      }

      const detector = new ProjectDetector(projectPath);
      const projectInfo = await detector.detectAll();
      const scanner = new FileScanner(projectPath);
      const scanResult = await scanner.scanProject();
      const tokenManager = new TokenManager();
      const tokenAnalysis = tokenManager.analyzeFiles(scanResult.files);
      
      spinner.succeed('Information gathered');
      console.log(chalk.blue('\n📁 Project Information:'));
      console.log(`Path: ${chalk.cyan(projectPath)}`);
      console.log(`Primary Type: ${chalk.green(projectInfo.primary)}`);
      console.log(`Total Files: ${scanResult.stats.processedFiles}`);
      console.log(`Total Tokens: ${tokenAnalysis.summary.totalTokens.toLocaleString()}`);
      
      tokenManager.cleanup();
    } catch (error) {
      spinner.fail('Failed to gather information');
      console.error(chalk.red('\n❌ Error:'), error.message);
      process.exit(1);
    }
  }

  async handleClean(options) {
    const spinner = ora('Cleaning output directory...').start();
    try {
      const outputPath = path.resolve(options.output);
      if (await fs.pathExists(outputPath)) {
        await fs.remove(outputPath);
        spinner.succeed(`Cleaned: ${outputPath}`);
      } else {
        spinner.succeed('Output directory does not exist');
      }
    } catch (error) {
      spinner.fail('Failed to clean');
      console.error(chalk.red('\n❌ Error:'), error.message);
      process.exit(1);
    }
  }

  async handleStart(options) {
    try {
      const projectPath = process.cwd();
      const initialPort = parseInt(options.port);
      const projectManager = require('./server/project-manager');
      
      const leaderInfo = await projectManager.checkLeader();
      
      if (leaderInfo) {
        console.log(chalk.blue(`\n🔍 Found existing server at port ${leaderInfo.port}`));
        const joined = await projectManager.joinLeader(leaderInfo, projectPath);
        if (joined) return;
        console.log(chalk.yellow('⚠️  Failed to join leader, starting new server...'));
      }
      
      console.log(chalk.blue('\n🚀 Starting VG Coder Server...'));
      
      const server = new ApiServer(initialPort);
      const lockAcquired = await projectManager.acquireLock(initialPort);
      if (!lockAcquired) throw new Error('Failed to acquire leader lock');
      
      await server.start();
      server.projectManager.registerProject(projectPath);
      
      // --- EXTENSION INSTALLATION GUIDE ---
      // Calculate absolute path to the extension folder inside the package
      const extensionPath = path.resolve(__dirname, 'server', 'views', 'vg-coder');
      
      console.log(chalk.green('\n✅ Server is running!'));
      console.log(chalk.cyan('──────────────────────────────────────────────────'));
      console.log(`📡 URL:       http://localhost:${server.port}`);
      console.log(chalk.cyan('──────────────────────────────────────────────────'));
      
      console.log(chalk.yellow('\n🧩 CHƯA CÀI EXTENSION?'));
      console.log('1. Truy cập: chrome://extensions');
      console.log('2. Bật "Developer mode" (Góc phải trên)');
      console.log('3. Bấm "Load unpacked" và chọn thư mục dưới đây:');
      console.log(chalk.bgBlue.white.bold(` ${extensionPath} `));
      
      console.log(chalk.yellow('\n👉 HƯỚNG DẪN SỬ DỤNG:'));
      console.log('1. Mở trang chat AI (ChatGPT, Claude, v.v.)');
      console.log('2. Click vào bong bóng 🚀 ở góc phải dưới để mở Dashboard.');
      console.log('3. Bắt đầu code!');
      console.log(chalk.gray('\n(Nhấn Ctrl+C để dừng server)'));
      
      const shutdown = async () => {
        console.log(chalk.yellow('\n\nShutting down server...'));
        await projectManager.releaseLock();
        await server.stop();
        process.exit(0);
      };
      
      process.on('SIGINT', shutdown);
      process.on('SIGTERM', shutdown);
      
    } catch (error) {
      console.error(chalk.red('\n❌ Failed to start server:'), error.message);
      process.exit(1);
    }
  }

  run() {
    this.program.parse();
  }
}

module.exports = VGCoderCLI;

if (require.main === module) {
  const cli = new VGCoderCLI();
  cli.run();
}
