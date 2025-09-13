const fs = require('fs-extra');
const path = require('path');
const ignore = require('ignore');

/**
 * Quản lý ignore patterns theo chuẩn Git
 */
class IgnoreManager {
  constructor(projectPath) {
    this.projectPath = projectPath;
    this.ignoreInstances = new Map(); // Cache ignore instances theo thư mục
    this.defaultIgnores = this.getDefaultIgnores();
  }

  /**
   * Lấy danh sách ignore patterns mặc định
   */
  getDefaultIgnores() {
    return [
      // Node.js
      'node_modules/',
      'package-lock.json',
      'yarn.lock',
      'npm-debug.log*',
      'yarn-debug.log*',
      'yarn-error.log*',
      '.npm',
      '.yarn/',
      
      // Build outputs
      'dist/',
      'build/',
      'out/',
      'target/',
      'bin/',
      'obj/',
      
      // IDE và Editor
      '.vscode/',
      '.idea/',
      '*.swp',
      '*.swo',
      '*~',
      '.DS_Store',
      'Thumbs.db',
      
      // Logs
      'logs/',
      '*.log',
      
      // Environment files
      '.env',
      '.env.local',
      '.env.development.local',
      '.env.test.local',
      '.env.production.local',
      
      // Cache directories
      '.cache/',
      '.parcel-cache/',
      '.next/',
      '.nuxt/',
      
      // Coverage reports
      'coverage/',
      '*.lcov',
      
      // Dependency directories
      'bower_components/',
      'jspm_packages/',
      
      // Java
      '*.class',
      '*.jar',
      '*.war',
      '*.ear',
      '.gradle/',
      
      // Python
      '__pycache__/',
      '*.py[cod]',
      '*$py.class',
      '*.so',
      '.Python',
      'env/',
      'venv/',
      '.venv/',
      'pip-log.txt',
      'pip-delete-this-directory.txt',
      
      // .NET
      '[Bb]in/',
      '[Oo]bj/',
      '*.user',
      '*.suo',
      '*.userosscache',
      '*.sln.docstates',
      
      // Temporary files
      '*.tmp',
      '*.temp',
      '*.bak',
      '*.backup',
      
      // OS generated files
      '.DS_Store?',
      'ehthumbs.db',
      'Icon?',
      
      // VG Coder output
      'vg-output/'
    ];
  }

  /**
   * Lấy ignore instance cho một thư mục cụ thể
   */
  async getIgnoreInstance(dirPath) {
    const relativePath = path.relative(this.projectPath, dirPath);
    const cacheKey = relativePath || '.';
    
    if (this.ignoreInstances.has(cacheKey)) {
      return this.ignoreInstances.get(cacheKey);
    }

    const ig = ignore();
    
    // Thêm default ignores
    ig.add(this.defaultIgnores);
    
    // Đọc .gitignore và .vgignore từ root đến thư mục hiện tại
    const pathParts = relativePath ? relativePath.split(path.sep) : [];
    let currentPath = this.projectPath;

    // Đọc .gitignore và .vgignore từ root
    await this.addIgnoreFromPath(ig, currentPath);

    // Đọc .gitignore và .vgignore từ các thư mục con theo thứ tự
    for (const part of pathParts) {
      currentPath = path.join(currentPath, part);
      await this.addIgnoreFromPath(ig, currentPath);
    }
    
    this.ignoreInstances.set(cacheKey, ig);
    return ig;
  }

  /**
   * Thêm patterns từ .gitignore và .vgignore files
   */
  async addIgnoreFromPath(ig, dirPath) {
    // Đọc .gitignore
    const gitignorePath = path.join(dirPath, '.gitignore');
    try {
      if (await fs.pathExists(gitignorePath)) {
        const content = await fs.readFile(gitignorePath, 'utf8');
        const patterns = this.parseIgnoreContent(content, dirPath);
        ig.add(patterns);
      }
    } catch (error) {
      // Ignore errors reading .gitignore files
    }

    // Đọc .vgignore (có priority cao hơn .gitignore)
    const vgignorePath = path.join(dirPath, '.vgignore');
    try {
      if (await fs.pathExists(vgignorePath)) {
        const content = await fs.readFile(vgignorePath, 'utf8');
        const patterns = this.parseIgnoreContent(content, dirPath);
        ig.add(patterns);
      }
    } catch (error) {
      // Ignore errors reading .vgignore files
    }
  }

  /**
   * Parse nội dung .gitignore và .vgignore
   */
  parseIgnoreContent(content, basePath) {
    const lines = content.split('\n');
    const patterns = [];
    
    for (let line of lines) {
      line = line.trim();
      
      // Skip empty lines và comments
      if (!line || line.startsWith('#')) {
        continue;
      }
      
      // Xử lý relative path từ basePath
      const relativePath = path.relative(this.projectPath, basePath);
      if (relativePath && !line.startsWith('/')) {
        // Nếu pattern không bắt đầu bằng /, thêm relative path
        line = path.posix.join(relativePath, line);
      } else if (line.startsWith('/')) {
        // Remove leading slash cho absolute patterns
        line = line.substring(1);
      }
      
      patterns.push(line);
    }
    
    return patterns;
  }

  /**
   * Kiểm tra xem một file/thư mục có bị ignore không
   */
  async shouldIgnore(filePath) {
    try {
      const absolutePath = path.resolve(this.projectPath, filePath);
      const relativePath = path.relative(this.projectPath, absolutePath);
      
      // Không ignore nếu file nằm ngoài project
      if (relativePath.startsWith('..')) {
        return false;
      }
      
      const dirPath = path.dirname(absolutePath);
      const ig = await this.getIgnoreInstance(dirPath);
      
      return ig.ignores(relativePath);
    } catch (error) {
      return false;
    }
  }

  /**
   * Lọc danh sách files/directories
   */
  async filterIgnored(items) {
    const results = [];
    
    for (const item of items) {
      const shouldIgnore = await this.shouldIgnore(item);
      if (!shouldIgnore) {
        results.push(item);
      }
    }
    
    return results;
  }

  /**
   * Lấy tất cả patterns đang được áp dụng cho một thư mục
   */
  async getAppliedPatterns(dirPath = this.projectPath) {
    const ig = await this.getIgnoreInstance(dirPath);
    return {
      default: this.defaultIgnores,
      gitignore: ig._rules.filter(rule => !this.defaultIgnores.includes(rule.origin))
    };
  }

  /**
   * Kiểm tra xem có .gitignore file nào không
   */
  async hasGitignoreFiles() {
    const gitignoreFiles = [];
    
    const checkGitignore = async (dirPath) => {
      const gitignorePath = path.join(dirPath, '.gitignore');
      if (await fs.pathExists(gitignorePath)) {
        gitignoreFiles.push(path.relative(this.projectPath, gitignorePath));
      }
    };
    
    // Kiểm tra root
    await checkGitignore(this.projectPath);
    
    // Kiểm tra subdirectories (chỉ 2 levels để tránh quá chậm)
    try {
      const items = await fs.readdir(this.projectPath);
      for (const item of items) {
        const itemPath = path.join(this.projectPath, item);
        const stat = await fs.stat(itemPath);
        if (stat.isDirectory()) {
          await checkGitignore(itemPath);
          
          // Level 2
          try {
            const subItems = await fs.readdir(itemPath);
            for (const subItem of subItems) {
              const subItemPath = path.join(itemPath, subItem);
              const subStat = await fs.stat(subItemPath);
              if (subStat.isDirectory()) {
                await checkGitignore(subItemPath);
              }
            }
          } catch (error) {
            // Ignore errors
          }
        }
      }
    } catch (error) {
      // Ignore errors
    }
    
    return gitignoreFiles;
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.ignoreInstances.clear();
  }
}

module.exports = IgnoreManager;
