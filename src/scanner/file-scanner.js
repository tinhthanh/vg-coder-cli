const fs = require('fs-extra');
const path = require('path');
const dirTree = require('directory-tree');
const IgnoreManager = require('../ignore/ignore-manager');

/**
 * Scanner để duyệt và nối file mã nguồn
 */
class FileScanner {
  constructor(projectPath, options = {}) {
    this.projectPath = projectPath;
    this.options = {
      maxFileSize: options.maxFileSize || 1024 * 1024, // 1MB default
      extensions: options.extensions || this.getDefaultExtensions(),
      includeHidden: options.includeHidden || false,
      maxDepth: options.maxDepth || 10,
      ...options
    };
    this.ignoreManager = new IgnoreManager(projectPath);
  }

  /**
   * Lấy danh sách extensions mặc định
   */
  getDefaultExtensions() {
    return [
      // Web Frontend
      '.js', '.jsx', '.ts', '.tsx', '.vue', '.svelte',
      '.html', '.htm', '.css', '.scss', '.sass', '.less',
      
      // Backend
      '.java', '.kt', '.scala', '.groovy',
      '.py', '.rb', '.php', '.go', '.rs',
      '.cs', '.vb', '.fs',
      '.cpp', '.c', '.h', '.hpp',
      
      // Config files
      '.json', '.yaml', '.yml', '.toml', '.ini', '.conf',
      '.xml', '.properties',
      
      // Build files
      '.gradle', '.maven', '.sbt',
      
      // Scripts
      '.sh', '.bat', '.ps1', '.cmd',
      
      // Documentation
      '.md', '.txt', '.rst',
      
      // SQL
      '.sql', '.ddl', '.dml'
    ];
  }

  /**
   * Scan toàn bộ project và trả về cấu trúc file
   */
  async scanProject() {
    const startTime = Date.now();
    
    try {
      // Lấy cấu trúc thư mục
      const tree = await this.buildFileTree();
      
      // Lấy danh sách files
      const files = await this.extractFiles(tree);
      
      // Lọc files theo ignore rules
      const filteredFiles = await this.filterFiles(files);
      
      // Đọc nội dung files
      const filesWithContent = await this.readFilesContent(filteredFiles);
      
      const endTime = Date.now();
      
      return {
        tree,
        files: filesWithContent,
        stats: {
          totalFiles: files.length,
          filteredFiles: filteredFiles.length,
          processedFiles: filesWithContent.length,
          scanTime: endTime - startTime,
          projectPath: this.projectPath
        }
      };
    } catch (error) {
      throw new Error(`Failed to scan project: ${error.message}`);
    }
  }

  /**
   * Xây dựng cây thư mục
   */
  async buildFileTree() {
    // Use manual scanning instead of directory-tree to ensure all Java files are found
    return await this.scanDirectoryManually(this.projectPath);
  }

  /**
   * Manually scan directory to ensure all files are found
   */
  async scanDirectoryManually(dirPath, relativePath = '') {
    const stats = await fs.stat(dirPath);
    const name = path.basename(dirPath);

    const node = {
      path: dirPath,
      name: name,
      size: stats.size,
      type: stats.isDirectory() ? 'directory' : 'file',
      extension: stats.isFile() ? path.extname(name) : undefined
    };

    if (stats.isDirectory()) {
      try {
        const entries = await fs.readdir(dirPath);
        const children = [];

        for (const entry of entries) {
          const entryPath = path.join(dirPath, entry);
          const entryRelativePath = path.join(relativePath, entry);

          // Skip ignored directories
          if (this.shouldIgnoreDirectoryName(entry)) {
            continue;
          }

          try {
            const childNode = await this.scanDirectoryManually(entryPath, entryRelativePath);
            if (childNode) {
              children.push(childNode);
            }
          } catch (error) {
            // Skip files/directories that can't be accessed
            continue;
          }
        }

        if (children.length > 0) {
          node.children = children;
        }
      } catch (error) {
        // Skip directories that can't be read
      }
    }

    return node;
  }

  /**
   * Get regex for build directories and hidden files to ignore
   */
  getBuildIgnoreRegex() {
    // Create regex pattern for directories to ignore
    const ignorePatterns = [
      // Hidden directories (starting with .)
      '^\\..*',

      // Build directories
      '^build$',
      '^target$',
      '^dist$',
      '^out$',
      '^bin$',

      // Dependencies
      '^node_modules$',
      '^vendor$',

      // Temporary files
      '^tmp$',
      '^temp$',

      // Logs
      '^logs$',
      '^log$',

      // Coverage reports
      '^coverage$'
    ];

    // Combine all patterns into one regex
    const combinedPattern = ignorePatterns.join('|');
    return new RegExp(`(${combinedPattern})`);
  }





  /**
   * Trích xuất danh sách files từ tree
   */
  async extractFiles(tree) {
    const files = [];

    const traverse = (node, currentPath = '') => {
      // Skip ignored directories
      if (this.shouldIgnorePath(node.path || node.name)) {
        return;
      }

      // Nếu node có children thì là directory
      if (node.children) {
        node.children.forEach(child => traverse(child, currentPath));
      } else {
        // Nếu không có children thì là file
        const relativePath = path.relative(this.projectPath, node.path);

        // Skip files in ignored directories
        if (!this.shouldIgnorePath(relativePath)) {
          // Filter by extension
          const extensions = this.options.extensions || this.getDefaultExtensions();
          const hasValidExtension = extensions.some(ext =>
            node.name.toLowerCase().endsWith(ext.toLowerCase())
          );

          if (hasValidExtension) {
            files.push({
              path: node.path,
              relativePath: relativePath,
              name: node.name,
              extension: node.extension,
              size: node.size
            });
          }
        }
      }
    };

    traverse(tree);
    return files;
  }

  /**
   * Check if path should be ignored
   */
  shouldIgnorePath(filePath) {
    const pathParts = filePath.split(path.sep);

    // Check each part of the path
    for (const part of pathParts) {
      if (this.shouldIgnoreDirectoryName(part)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if directory/file should be ignored
   */
  shouldIgnoreDirectoryName(name) {
    // List of directories/files to ignore
    const ignoreList = [
      // Hidden directories (starting with .)
      '.git', '.svn', '.hg',
      '.gradle', '.maven', '.cache', '.npm',
      '.idea', '.vscode', '.eclipse',
      '.DS_Store', '.tmp',

      // Build directories
      'build', 'target', 'dist', 'out', 'bin',

      // Dependencies
      'node_modules', 'vendor',

      // Temporary files
      'tmp', 'temp',

      // Logs
      'logs', 'log',

      // Coverage reports
      'coverage', '.nyc_output'
    ];

    // Check if name starts with . (hidden files/dirs)
    if (name.startsWith('.')) {
      return true;
    }

    // Check if name is in ignore list
    return ignoreList.includes(name);
  }

  /**
   * Lọc files theo ignore rules
   */
  async filterFiles(files) {
    const filtered = [];
    
    for (const file of files) {
      // Kiểm tra size
      if (file.size > this.options.maxFileSize) {
        continue;
      }
      
      // Kiểm tra ignore rules
      const shouldIgnore = await this.ignoreManager.shouldIgnore(file.relativePath);
      if (!shouldIgnore) {
        filtered.push(file);
      }
    }
    
    return filtered;
  }

  /**
   * Đọc nội dung files
   */
  async readFilesContent(files) {
    const filesWithContent = [];
    
    for (const file of files) {
      try {
        const content = await this.readFileContent(file.path);
        if (content !== null) {
          filesWithContent.push({
            ...file,
            content,
            lines: content.split('\n').length,
            encoding: 'utf8'
          });
        }
      } catch (error) {
        // Log error but continue with other files
        console.warn(`Warning: Could not read file ${file.relativePath}: ${error.message}`);
      }
    }
    
    return filesWithContent;
  }

  /**
   * Đọc nội dung một file
   */
  async readFileContent(filePath) {
    try {
      // Kiểm tra xem file có phải binary không
      if (await this.isBinaryFile(filePath)) {
        return null;
      }
      
      const content = await fs.readFile(filePath, 'utf8');
      return content;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Kiểm tra xem file có phải binary không
   */
  async isBinaryFile(filePath) {
    try {
      const buffer = await fs.readFile(filePath);
      
      // Kiểm tra 1024 bytes đầu
      const chunk = buffer.slice(0, 1024);
      
      // Nếu có null bytes thì có thể là binary
      for (let i = 0; i < chunk.length; i++) {
        if (chunk[i] === 0) {
          return true;
        }
      }
      
      return false;
    } catch (error) {
      return true; // Assume binary if can't read
    }
  }

  /**
   * Tạo nội dung kết hợp từ tất cả files
   */
  async createCombinedContent(files, options = {}) {
    const {
      includeStats = true,
      includeTree = true,
      headerTemplate = this.getDefaultHeaderTemplate(),
      separatorTemplate = this.getDefaultSeparatorTemplate()
    } = options;

    let content = '';
    
    // Header với thông tin project
    if (includeStats) {
      content += this.generateProjectHeader(files);
      content += '\n\n';
    }
    
    // Cấu trúc thư mục
    if (includeTree) {
      content += this.generateTreeStructure(files);
      content += '\n\n';
    }
    
    // Nội dung từng file
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // Header cho file
      content += headerTemplate
        .replace('{path}', file.relativePath)
        .replace('{name}', file.name)
        .replace('{extension}', file.extension || '')
        .replace('{size}', file.size)
        .replace('{lines}', file.lines);
      
      content += '\n';
      content += file.content;
      content += '\n';
      
      // Separator giữa các files
      if (i < files.length - 1) {
        content += separatorTemplate;
        content += '\n';
      }
    }
    
    return content;
  }

  /**
   * Template header mặc định cho file
   */
  getDefaultHeaderTemplate() {
    return `
================================================================================
File: {path}
Size: {size} bytes | Lines: {lines}
================================================================================`;
  }

  /**
   * Template separator mặc định
   */
  getDefaultSeparatorTemplate() {
    return '\n\n';
  }

  /**
   * Tạo nội dung kết hợp cho AI tools với formatting chính xác
   */
  async createCombinedContentForAI(files, options = {}) {
    const {
      includeStats = false,
      includeTree = false,
      preserveLineNumbers = true
    } = options;

    let content = '';

    // Header với thông tin project (tùy chọn)
    if (includeStats) {
      content += this.generateProjectHeader(files);
      content += '\n\n';
    }

    // Cấu trúc thư mục (tùy chọn)
    if (includeTree) {
      content += this.generateTreeStructure(files);
      content += '\n\n';
    }

    // Nội dung từng file với formatting chính xác
    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // File boundary marker - không ảnh hưởng line numbering
      content += `// ===== FILE: ${file.relativePath} =====\n`;

      // Nội dung file nguyên bản
      content += file.content;

      // Đảm bảo file kết thúc bằng newline
      if (!file.content.endsWith('\n')) {
        content += '\n';
      }

      // Separator giữa các files
      if (i < files.length - 1) {
        content += '\n';
      }
    }

    return content;
  }

  /**
   * Tạo header thông tin project
   */
  generateProjectHeader(files) {
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    const totalLines = files.reduce((sum, file) => sum + file.lines, 0);
    
    return `
# Project Analysis Report
Generated: ${new Date().toISOString()}
Project Path: ${this.projectPath}

## Statistics
- Total Files: ${files.length}
- Total Size: ${this.formatBytes(totalSize)}
- Total Lines: ${totalLines.toLocaleString()}
- Extensions: ${[...new Set(files.map(f => f.extension))].filter(Boolean).join(', ')}
`;
  }

  /**
   * Tạo cấu trúc thư mục
   */
  generateTreeStructure(files) {
    const tree = {};
    
    // Build tree structure
    files.forEach(file => {
      const parts = file.relativePath.split(path.sep);
      let current = tree;
      
      parts.forEach((part, index) => {
        if (index === parts.length - 1) {
          // File
          current[part] = file;
        } else {
          // Directory
          if (!current[part]) {
            current[part] = {};
          }
          current = current[part];
        }
      });
    });
    
    // Generate tree string
    let treeStr = '\n## Project Structure\n```\n';
    treeStr += this.renderTree(tree, '', true);
    treeStr += '```\n';
    
    return treeStr;
  }

  /**
   * Render tree structure
   */
  renderTree(node, prefix = '', isLast = true) {
    let result = '';
    const entries = Object.entries(node);

    entries.forEach(([name, value], index) => {
      const isLastEntry = index === entries.length - 1;
      const connector = isLastEntry ? '└── ' : '├── ';

      result += prefix + connector + name + '\n';

      if (typeof value === 'object' && !value.relativePath) {
        // Directory
        const newPrefix = prefix + (isLastEntry ? '    ' : '│   ');
        result += this.renderTree(value, newPrefix, isLastEntry);
      }
    });

    return result;
  }

  /**
   * Render project tree structure
   */
  renderProjectTree(tree, maxDepth = 50) {
    if (!tree) return 'No tree structure available';

    const renderNode = (node, prefix = '', depth = 0) => {
      if (depth > maxDepth) return '';

      let result = '';

      if (node.children && node.children.length > 0) {
        // Filter out ignored directories
        const filteredChildren = node.children.filter(child =>
          !this.shouldIgnoreDirectoryName(child.name)
        );

        // Sort children: directories first, then files
        filteredChildren.sort((a, b) => {
          const aIsDir = a.children && a.children.length > 0;
          const bIsDir = b.children && b.children.length > 0;
          if (aIsDir && !bIsDir) return -1;
          if (!aIsDir && bIsDir) return 1;
          return a.name.localeCompare(b.name);
        });

        filteredChildren.forEach((child, index) => {
          const isLast = index === filteredChildren.length - 1;
          const connector = isLast ? '└── ' : '├── ';
          const nextPrefix = prefix + (isLast ? '    ' : '│   ');
          const isDirectory = child.children !== undefined;

          result += `${prefix}${connector}${child.name}`;
          if (!isDirectory) {
            // It's a file, show extension
            result += ` (${child.extension || 'file'})`;
          }
          result += '\n';

          if (isDirectory) {
            // Always render all children, no depth limit for full structure
            result += renderNode(child, nextPrefix, depth + 1);
          }
        });
      }

      return result;
    };

    let result = `${tree.name}/\n`;
    result += renderNode(tree);

    return result;
  }

  /**
   * Format bytes to human readable
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

module.exports = FileScanner;
