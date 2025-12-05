const { encoding_for_model, get_encoding } = require('tiktoken');

/**
 * Quản lý token counting và chunking
 */
class TokenManager {
  constructor(options = {}) {
    this.options = {
      model: options.model || 'gpt-4',
      maxTokens: options.maxTokens || 8000,
      chunkOverlap: options.chunkOverlap || 200,
      preserveStructure: options.preserveStructure !== false,
      ...options
    };
    
    this.encoding = null;
    this.initializeEncoding();
  }

  /**
   * Khởi tạo encoding
   */
  initializeEncoding() {
    try {
      // Thử sử dụng encoding cho model cụ thể
      this.encoding = encoding_for_model(this.options.model);
    } catch (error) {
      try {
        // Fallback to cl100k_base (GPT-4, GPT-3.5-turbo)
        this.encoding = get_encoding('cl100k_base');
      } catch (fallbackError) {
        // Fallback to p50k_base (GPT-3)
        this.encoding = get_encoding('p50k_base');
      }
    }
  }

  /**
   * Đếm tokens trong text
   */
  countTokens(text) {
    if (!text || typeof text !== 'string') {
      return 0;
    }
    
    try {
      const tokens = this.encoding.encode(text);
      return tokens.length;
    } catch (error) {
      // Fallback: estimate based on characters (rough approximation)
      return Math.ceil(text.length / 4);
    }
  }

  /**
   * Phân tích token usage cho một file
   */
  analyzeFile(file) {
    const headerTokens = this.countTokens(this.generateFileHeader(file));
    const contentTokens = this.countTokens(file.content);
    const totalTokens = headerTokens + contentTokens;
    
    return {
      file: file.relativePath,
      headerTokens,
      contentTokens,
      totalTokens,
      exceedsLimit: totalTokens > this.options.maxTokens,
      chunksNeeded: Math.ceil(totalTokens / this.options.maxTokens)
    };
  }

  /**
   * Phân tích token usage cho tất cả files
   */
  analyzeFiles(files) {
    const analyses = files.map(file => this.analyzeFile(file));
    
    const totalTokens = analyses.reduce((sum, analysis) => sum + analysis.totalTokens, 0);
    const filesExceedingLimit = analyses.filter(analysis => analysis.exceedsLimit);
    const totalChunks = analyses.reduce((sum, analysis) => sum + analysis.chunksNeeded, 0);
    
    return {
      files: analyses,
      summary: {
        totalFiles: files.length,
        totalTokens,
        averageTokensPerFile: Math.round(totalTokens / files.length),
        filesExceedingLimit: filesExceedingLimit.length,
        totalChunks,
        estimatedChunks: Math.ceil(totalTokens / this.options.maxTokens)
      }
    };
  }

  /**
   * Phân tích và điền thông tin token vào cấu trúc cây thư mục
   * Tính toán token cho từng file và tổng hợp cho folder
   */
  analyzeTree(tree, files) {
    // Tạo map để lookup content file nhanh hơn
    const fileMap = new Map();
    files.forEach(f => {
      if (f.content) {
        fileMap.set(f.path, f.content);
      }
    });

    const traverse = (node) => {
      if (!node) return 0;

      // Nếu là file
      if (node.type === 'file') {
        const content = fileMap.get(node.path);
        // Nếu không có content (binary hoặc error), token là 0
        node.tokens = content ? this.countTokens(content) : 0;
        return node.tokens;
      }

      // Nếu là directory có con
      if (node.children) {
        let sum = 0;
        
        // Sắp xếp: Folder trước, File sau
        node.children.sort((a, b) => {
          if (a.type === b.type) return a.name.localeCompare(b.name);
          return a.type === 'directory' ? -1 : 1;
        });

        // Đệ quy tính tổng token của con
        node.children.forEach(child => {
          sum += traverse(child);
        });

        node.tokens = sum;
        return sum;
      }

      // Nếu là node rỗng hoặc loại khác
      node.tokens = 0;
      return 0;
    };

    traverse(tree);
    return tree;
  }

  /**
   * Chia nhỏ content thành chunks
   */
  async chunkContent(content, metadata = {}) {
    const totalTokens = this.countTokens(content);
    
    if (totalTokens <= this.options.maxTokens) {
      return [{
        content,
        tokens: totalTokens,
        chunkIndex: 0,
        totalChunks: 1,
        metadata
      }];
    }
    
    return this.options.preserveStructure 
      ? await this.chunkByStructure(content, metadata)
      : await this.chunkByTokens(content, metadata);
  }

  /**
   * Chia nhỏ theo cấu trúc (ưu tiên giữ nguyên files)
   */
  async chunkByStructure(content, metadata = {}) {
    const chunks = [];
    const lines = content.split('\n');
    let currentChunk = '';
    let currentTokens = 0;
    let chunkIndex = 0;
    
    // Tìm file boundaries
    const fileBoundaries = this.findFileBoundaries(lines);
    
    for (let i = 0; i < fileBoundaries.length; i++) {
      const boundary = fileBoundaries[i];
      const fileContent = lines.slice(boundary.start, boundary.end).join('\n');
      const fileTokens = this.countTokens(fileContent);
      
      // Nếu file này làm chunk vượt quá limit
      if (currentTokens + fileTokens > this.options.maxTokens && currentChunk) {
        // Lưu chunk hiện tại
        chunks.push({
          content: currentChunk.trim(),
          tokens: currentTokens,
          chunkIndex: chunkIndex++,
          totalChunks: 0, // Sẽ update sau
          metadata: { ...metadata, type: 'structure' }
        });
        
        currentChunk = '';
        currentTokens = 0;
      }
      
      // Nếu file quá lớn, chia nhỏ file này
      if (fileTokens > this.options.maxTokens) {
        const fileChunks = await this.chunkLargeFile(fileContent, boundary.filePath);
        chunks.push(...fileChunks.map(chunk => ({
          ...chunk,
          chunkIndex: chunkIndex++,
          metadata: { ...metadata, ...chunk.metadata, type: 'large-file' }
        })));
      } else {
        currentChunk += fileContent + '\n';
        currentTokens += fileTokens;
      }
    }
    
    // Thêm chunk cuối cùng
    if (currentChunk.trim()) {
      chunks.push({
        content: currentChunk.trim(),
        tokens: currentTokens,
        chunkIndex: chunkIndex++,
        totalChunks: 0,
        metadata: { ...metadata, type: 'structure' }
      });
    }
    
    // Update totalChunks
    chunks.forEach(chunk => {
      chunk.totalChunks = chunks.length;
    });
    
    return chunks;
  }

  /**
   * Chia nhỏ theo tokens (simple splitting)
   */
  async chunkByTokens(content, metadata = {}) {
    const chunks = [];
    const lines = content.split('\n');
    let currentChunk = '';
    let currentTokens = 0;
    let chunkIndex = 0;
    
    for (const line of lines) {
      const lineTokens = this.countTokens(line + '\n');
      
      if (currentTokens + lineTokens > this.options.maxTokens && currentChunk) {
        // Lưu chunk hiện tại
        chunks.push({
          content: currentChunk.trim(),
          tokens: currentTokens,
          chunkIndex: chunkIndex++,
          totalChunks: 0,
          metadata: { ...metadata, type: 'token-based' }
        });
        
        // Bắt đầu chunk mới với overlap
        if (this.options.chunkOverlap > 0) {
          const overlapLines = this.getOverlapLines(currentChunk, this.options.chunkOverlap);
          currentChunk = overlapLines;
          currentTokens = this.countTokens(overlapLines);
        } else {
          currentChunk = '';
          currentTokens = 0;
        }
      }
      
      currentChunk += line + '\n';
      currentTokens += lineTokens;
    }
    
    // Thêm chunk cuối cùng
    if (currentChunk.trim()) {
      chunks.push({
        content: currentChunk.trim(),
        tokens: currentTokens,
        chunkIndex: chunkIndex++,
        totalChunks: 0,
        metadata: { ...metadata, type: 'token-based' }
      });
    }
    
    // Update totalChunks
    chunks.forEach(chunk => {
      chunk.totalChunks = chunks.length;
    });
    
    return chunks;
  }

  /**
   * Chia nhỏ file lớn
   */
  async chunkLargeFile(fileContent, filePath) {
    const lines = fileContent.split('\n');
    const chunks = [];
    let currentChunk = '';
    let currentTokens = 0;
    let chunkIndex = 0;
    
    for (const line of lines) {
      const lineTokens = this.countTokens(line + '\n');

      if (currentTokens + lineTokens > this.options.maxTokens && currentChunk) {
        chunks.push({
          content: currentChunk.trim(),
          tokens: this.countTokens(currentChunk.trim()),
          chunkIndex: chunkIndex++,
          totalChunks: 0,
          metadata: { 
            filePath,
            partNumber: chunkIndex + 1,
            type: 'large-file-part'
          }
        });
        
        currentChunk = '';
        currentTokens = 0;
      }
      
      currentChunk += line + '\n';
      currentTokens += lineTokens;
    }
    
    // Thêm chunk cuối cùng
    if (currentChunk.trim()) {
      chunks.push({
        content: currentChunk.trim(),
        tokens: this.countTokens(currentChunk.trim()),
        chunkIndex: chunkIndex++,
        totalChunks: 0,
        metadata: { 
          filePath,
          partNumber: chunkIndex + 1,
          type: 'large-file-part'
        }
      });
    }
    
    // Update totalChunks
    chunks.forEach(chunk => {
      chunk.totalChunks = chunks.length;
    });
    
    return chunks;
  }

  /**
   * Tìm file boundaries trong content
   */
  findFileBoundaries(lines) {
    const boundaries = [];
    let currentStart = 0;
    let currentFilePath = null;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Tìm file header pattern
      if (line.includes('================================================================================')) {
        if (i + 1 < lines.length && lines[i + 1].startsWith('File: ')) {
          // Lưu boundary trước đó
          if (currentFilePath) {
            boundaries.push({
              start: currentStart,
              end: i,
              filePath: currentFilePath
            });
          }
          
          // Bắt đầu file mới
          currentStart = i;
          currentFilePath = lines[i + 1].replace('File: ', '').trim();
        }
      }
    }
    
    // Thêm boundary cuối cùng
    if (currentFilePath) {
      boundaries.push({
        start: currentStart,
        end: lines.length,
        filePath: currentFilePath
      });
    }
    
    return boundaries;
  }

  /**
   * Lấy overlap lines
   */
  getOverlapLines(content, maxTokens) {
    const lines = content.split('\n');
    let overlapContent = '';
    let tokens = 0;
    
    // Lấy từ cuối lên
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i] + '\n';
      const lineTokens = this.countTokens(line);
      
      if (tokens + lineTokens > maxTokens) {
        break;
      }
      
      overlapContent = line + overlapContent;
      tokens += lineTokens;
    }
    
    return overlapContent;
  }

  /**
   * Tạo file header
   */
  generateFileHeader(file) {
    return `
================================================================================
File: ${file.relativePath}
Size: ${file.size} bytes | Lines: ${file.lines}
================================================================================`;
  }

  /**
   * Cleanup encoding
   */
  cleanup() {
    if (this.encoding) {
      this.encoding.free();
    }
  }
}

module.exports = TokenManager;
