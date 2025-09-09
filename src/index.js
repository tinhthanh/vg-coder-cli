const { Command } = require('commander');
const path = require('path');
const fs = require('fs-extra');
const chalk = require('chalk');
const ora = require('ora');

const ProjectDetector = require('./detectors/project-detector');
const FileScanner = require('./scanner/file-scanner');
const TokenManager = require('./tokenizer/token-manager');
const HtmlExporter = require('./exporter/html-exporter');

/**
 * Main CLI Application
 */
class VGCoderCLI {
  constructor() {
    this.program = new Command();
    this.setupCommands();
  }

  /**
   * Setup CLI commands
   */
  setupCommands() {
    this.program
      .name('vg-coder')
      .description('CLI tool để phân tích dự án, nối file mã nguồn, đếm token và xuất HTML')
      .version('1.0.0');

    // Analyze command
    this.program
      .command('analyze [path]')
      .description('Phân tích dự án và tạo output HTML')
      .option('-o, --output <path>', 'Thư mục output', './vg-output')
      .option('-m, --max-tokens <number>', 'Số token tối đa mỗi chunk', '8000')
      .option('-t, --model <model>', 'Model AI để đếm token', 'gpt-4')
      .option('--extensions <extensions>', 'Danh sách extensions (comma-separated)')
      .option('--include-hidden', 'Bao gồm file ẩn')
      .option('--no-structure', 'Không ưu tiên giữ cấu trúc file')
      .option('--theme <theme>', 'Theme cho syntax highlighting', 'github')
      .action(this.handleAnalyze.bind(this));

    // Info command
    this.program
      .command('info [path]')
      .description('Hiển thị thông tin về dự án')
      .action(this.handleInfo.bind(this));

    // Clean command
    this.program
      .command('clean')
      .description('Xóa thư mục output')
      .option('-o, --output <path>', 'Thư mục output', './vg-output')
      .action(this.handleClean.bind(this));
  }

  /**
   * Handle analyze command
   */
  async handleAnalyze(projectPath, options) {
    const spinner = ora('Initializing analysis...').start();
    
    try {
      // Resolve project path
      projectPath = path.resolve(projectPath || process.cwd());
      const outputPath = path.resolve(options.output);
      
      // Validate project path
      if (!await fs.pathExists(projectPath)) {
        throw new Error(`Project path does not exist: ${projectPath}`);
      }

      spinner.text = 'Detecting project type...';
      
      // Detect project type
      const detector = new ProjectDetector(projectPath);
      const projectInfo = await detector.detectAll();
      
      console.log(chalk.blue('\n📁 Project Detection:'));
      console.log(`Primary Type: ${chalk.green(projectInfo.primary)}`);
      if (Object.keys(projectInfo.detected).length > 1) {
        console.log(`Other Types: ${Object.keys(projectInfo.detected).filter(t => t !== projectInfo.primary).join(', ')}`);
      }

      spinner.text = 'Scanning files...';
      
      // Scan files
      const scannerOptions = {
        maxTokens: parseInt(options.maxTokens),
        extensions: options.extensions ? options.extensions.split(',').map(ext => ext.trim()) : undefined,
        includeHidden: options.includeHidden
      };
      
      const scanner = new FileScanner(projectPath, scannerOptions);
      const scanResult = await scanner.scanProject();
      
      console.log(chalk.blue('\n📊 Scan Results:'));
      console.log(`Files Found: ${scanResult.stats.totalFiles}`);
      console.log(`Files Processed: ${scanResult.stats.processedFiles}`);
      console.log(`Scan Time: ${scanResult.stats.scanTime}ms`);

      // Hiển thị cấu trúc thư mục được scan
      console.log(chalk.blue('\n📁 Directory Structure:'));
      const treeStructure = scanner.renderProjectTree(scanResult.tree);
      console.log(treeStructure);

      spinner.text = 'Analyzing tokens...';
      
      // Analyze tokens
      const tokenManager = new TokenManager({
        model: options.model,
        maxTokens: parseInt(options.maxTokens),
        preserveStructure: options.structure !== false
      });
      
      const tokenAnalysis = tokenManager.analyzeFiles(scanResult.files);
      
      console.log(chalk.blue('\n🧮 Token Analysis:'));
      console.log(`Total Tokens: ${chalk.yellow(tokenAnalysis.summary.totalTokens.toLocaleString())}`);
      console.log(`Average Tokens/File: ${tokenAnalysis.summary.averageTokensPerFile.toLocaleString()}`);
      console.log(`Files Exceeding Limit: ${tokenAnalysis.summary.filesExceedingLimit}`);
      console.log(`Estimated Chunks: ${tokenAnalysis.summary.estimatedChunks}`);

      spinner.text = 'Creating content chunks...';
      
      // Create combined content
      const combinedContent = await scanner.createCombinedContent(scanResult.files);
      
      // Chunk content
      const chunks = await tokenManager.chunkContent(combinedContent, {
        projectType: projectInfo.primary,
        projectPath: projectPath,
        totalFiles: scanResult.files.length
      });
      
      console.log(chalk.blue('\n✂️ Chunking Results:'));
      console.log(`Total Chunks: ${chunks.length}`);
      chunks.forEach((chunk, index) => {
        console.log(`  Chunk ${index + 1}: ${chunk.tokens.toLocaleString()} tokens (${chunk.metadata?.type || 'unknown'})`);
      });

      spinner.text = 'Generating HTML output...';
      
      // Export HTML
      const exporter = new HtmlExporter(outputPath, {
        theme: options.theme,
        title: `VG Coder Analysis - ${path.basename(projectPath)}`
      });
      
      const exportResult = await exporter.exportChunks(chunks, {
        projectType: projectInfo.primary,
        projectInfo: projectInfo,
        scanStats: scanResult.stats,
        tokenStats: tokenAnalysis.summary,
        directoryStructure: treeStructure
      });
      
      // Cleanup
      tokenManager.cleanup();
      
      spinner.succeed('Analysis completed successfully!');
      
      console.log(chalk.green('\n✅ Output Generated:'));
      console.log(`Index: ${chalk.cyan(exportResult.indexPath)}`);
      console.log(`Combined: ${chalk.cyan(exportResult.combinedPath)}`);
      console.log(`Chunks: ${chalk.cyan(exportResult.chunksPath)}`);
      console.log(`Total Files: ${exportResult.totalFiles}`);
      
      console.log(chalk.blue('\n🌐 Open in browser:'));
      console.log(`file://${exportResult.indexPath}`);
      
    } catch (error) {
      spinner.fail('Analysis failed');
      console.error(chalk.red('\n❌ Error:'), error.message);
      process.exit(1);
    }
  }

  /**
   * Handle info command
   */
  async handleInfo(projectPath, options) {
    const spinner = ora('Gathering project information...').start();
    
    try {
      // Resolve project path
      projectPath = path.resolve(projectPath || process.cwd());
      
      if (!await fs.pathExists(projectPath)) {
        throw new Error(`Project path does not exist: ${projectPath}`);
      }

      // Detect project
      const detector = new ProjectDetector(projectPath);
      const projectInfo = await detector.detectAll();
      
      // Quick scan
      const scanner = new FileScanner(projectPath);
      const scanResult = await scanner.scanProject();
      
      // Token analysis
      const tokenManager = new TokenManager();
      const tokenAnalysis = tokenManager.analyzeFiles(scanResult.files);
      
      spinner.succeed('Information gathered');
      
      console.log(chalk.blue('\n📁 Project Information:'));
      console.log(`Path: ${chalk.cyan(projectPath)}`);
      console.log(`Primary Type: ${chalk.green(projectInfo.primary)}`);
      
      if (Object.keys(projectInfo.detected).length > 0) {
        console.log('\nDetected Technologies:');
        Object.entries(projectInfo.detected).forEach(([type, info]) => {
          console.log(`  ${chalk.yellow(type)}: ${info.confidence} confidence`);
          if (info.version) {
            console.log(`    Version: ${info.version}`);
          }
        });
      }
      
      console.log(chalk.blue('\n📊 File Statistics:'));
      console.log(`Total Files: ${scanResult.stats.processedFiles}`);
      console.log(`Total Size: ${scanner.formatBytes(scanResult.files.reduce((sum, f) => sum + f.size, 0))}`);
      console.log(`Total Lines: ${scanResult.files.reduce((sum, f) => sum + f.lines, 0).toLocaleString()}`);
      
      const extensions = [...new Set(scanResult.files.map(f => f.extension))].filter(Boolean);
      console.log(`Extensions: ${extensions.join(', ')}`);
      
      console.log(chalk.blue('\n🧮 Token Statistics:'));
      console.log(`Total Tokens: ${tokenAnalysis.summary.totalTokens.toLocaleString()}`);
      console.log(`Average Tokens/File: ${tokenAnalysis.summary.averageTokensPerFile.toLocaleString()}`);
      console.log(`Files Exceeding 8K Limit: ${tokenAnalysis.summary.filesExceedingLimit}`);
      console.log(`Estimated Chunks (8K): ${tokenAnalysis.summary.estimatedChunks}`);
      
      tokenManager.cleanup();
      
    } catch (error) {
      spinner.fail('Failed to gather information');
      console.error(chalk.red('\n❌ Error:'), error.message);
      process.exit(1);
    }
  }

  /**
   * Handle clean command
   */
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

  /**
   * Run CLI
   */
  run() {
    this.program.parse();
  }
}

// Export for testing
module.exports = VGCoderCLI;

// Run if called directly
if (require.main === module) {
  const cli = new VGCoderCLI();
  cli.run();
}
