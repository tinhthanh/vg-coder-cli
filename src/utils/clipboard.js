const { spawn } = require('child_process');
const os = require('os');

/**
 * Cross-platform clipboard utility
 */
class ClipboardManager {
  /**
   * Copy text to clipboard
   */
  static async copyToClipboard(text) {
    const platform = os.platform();
    
    try {
      switch (platform) {
        case 'darwin': // macOS
          return await this.copyMacOS(text);
        case 'win32': // Windows
          return await this.copyWindows(text);
        case 'linux': // Linux
          return await this.copyLinux(text);
        default:
          throw new Error(`Unsupported platform: ${platform}`);
      }
    } catch (error) {
      throw new Error(`Failed to copy to clipboard: ${error.message}`);
    }
  }

  /**
   * Copy to clipboard on macOS
   */
  static async copyMacOS(text) {
    return new Promise((resolve, reject) => {
      const pbcopy = spawn('pbcopy');
      
      pbcopy.stdin.write(text);
      pbcopy.stdin.end();
      
      pbcopy.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`pbcopy exited with code ${code}`));
        }
      });
      
      pbcopy.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Copy to clipboard on Windows
   */
  static async copyWindows(text) {
    return new Promise((resolve, reject) => {
      const clip = spawn('clip');
      
      clip.stdin.write(text);
      clip.stdin.end();
      
      clip.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`clip exited with code ${code}`));
        }
      });
      
      clip.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Copy to clipboard on Linux
   */
  static async copyLinux(text) {
    // Try xclip first, then xsel as fallback
    try {
      return await this.copyLinuxXclip(text);
    } catch (error) {
      try {
        return await this.copyLinuxXsel(text);
      } catch (xselError) {
        throw new Error('Neither xclip nor xsel is available. Please install one of them.');
      }
    }
  }

  /**
   * Copy using xclip
   */
  static async copyLinuxXclip(text) {
    return new Promise((resolve, reject) => {
      const xclip = spawn('xclip', ['-selection', 'clipboard']);
      
      xclip.stdin.write(text);
      xclip.stdin.end();
      
      xclip.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`xclip exited with code ${code}`));
        }
      });
      
      xclip.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Copy using xsel
   */
  static async copyLinuxXsel(text) {
    return new Promise((resolve, reject) => {
      const xsel = spawn('xsel', ['--clipboard', '--input']);
      
      xsel.stdin.write(text);
      xsel.stdin.end();
      
      xsel.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`xsel exited with code ${code}`));
        }
      });
      
      xsel.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Get clipboard content size info
   */
  static getContentInfo(text) {
    const lines = text.split('\n').length;
    const chars = text.length;
    const bytes = Buffer.byteLength(text, 'utf8');
    
    return {
      lines,
      characters: chars,
      bytes,
      size: this.formatBytes(bytes)
    };
  }

  /**
   * Format bytes to human readable
   */
  static formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

module.exports = ClipboardManager;
