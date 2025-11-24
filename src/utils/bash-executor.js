const { exec } = require('child_process');
const path = require('path');
const fs = require('fs-extra');
const { promisify } = require('util');

const execAsync = promisify(exec);

/**
 * Bash Script Executor
 * Validates and executes bash scripts safely
 */
class BashExecutor {
  constructor(workingDir) {
    this.workingDir = workingDir || process.cwd();
    this.tempDir = path.join(this.workingDir, '.vg', 'temp-execute');
  }

  /**
   * Ensure temp directory exists
   */
  async ensureTempDir() {
    await fs.ensureDir(this.tempDir);
  }

  /**
   * Cleanup temp directory
   */
  async cleanup() {
    try {
      if (await fs.pathExists(this.tempDir)) {
        await fs.remove(this.tempDir);
      }
    } catch (error) {
      console.error('Cleanup error:', error.message);
    }
  }

  /**
   * Validate bash script syntax
   * @param {string} bashScript - The bash script to validate
   * @returns {Promise<{valid: boolean, error: string|null}>}
   */
  async validateSyntax(bashScript) {
    await this.ensureTempDir();
    
    const scriptPath = path.join(this.tempDir, 'validate.sh');
    
    try {
      // Write script to temp file
      await fs.writeFile(scriptPath, bashScript, 'utf8');
      
      // Validate syntax using bash -n
      await execAsync(`bash -n "${scriptPath}"`);
      
      return { valid: true, error: null };
      
    } catch (error) {
      return {
        valid: false,
        error: error.stderr || error.message
      };
    }
  }

  /**
   * Execute bash script in working directory
   * @param {string} bashScript - The bash script to execute
   * @returns {Promise<{success: boolean, stdout: string, stderr: string, exitCode: number}>}
   */
  async execute(bashScript) {
    const startTime = Date.now();
    
    try {
      // First validate syntax
      const validation = await this.validateSyntax(bashScript);
      
      if (!validation.valid) {
        return {
          success: false,
          error: 'Syntax validation failed',
          details: validation.error,
          executionTime: Date.now() - startTime
        };
      }

      // Execute script in working directory
      const result = await execAsync(bashScript, {
        cwd: this.workingDir,
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
        shell: '/bin/bash'
      });

      // Cleanup temp directory
      await this.cleanup();

      return {
        success: true,
        stdout: result.stdout || '',
        stderr: result.stderr || '',
        exitCode: 0,
        executionTime: Date.now() - startTime
      };

    } catch (error) {
      // Cleanup even on error
      await this.cleanup();

      // Check if it's an execution error (not syntax)
      if (error.code !== undefined) {
        return {
          success: false,
          stdout: error.stdout || '',
          stderr: error.stderr || error.message,
          exitCode: error.code || 1,
          executionTime: Date.now() - startTime
        };
      }

      // Unknown error
      return {
        success: false,
        error: 'Execution failed',
        details: error.message,
        executionTime: Date.now() - startTime
      };
    }
  }
}

module.exports = BashExecutor;
