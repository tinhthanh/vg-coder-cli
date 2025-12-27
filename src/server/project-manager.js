const path = require('path');
const fs = require('fs-extra');
const os = require('os');
const crypto = require('crypto');
const chalk = require('chalk');
const http = require('http');

/**
 * ProjectManager - Singleton for managing multiple projects in one server
 */
class ProjectManager {
  constructor() {
    if (ProjectManager.instance) {
      return ProjectManager.instance;
    }

    this.projects = new Map(); // projectId -> ProjectContext
    this.currentProjectId = null;
    this.lockFilePath = path.join(os.homedir(), '.vg', 'vg-leader.lock');
    
    ProjectManager.instance = this;
  }

  /**
   * Register a new project
   * @param {string} workingDir - Absolute path to project directory
   * @returns {string} projectId
   */
  registerProject(workingDir) {
    const resolvedPath = path.resolve(workingDir);
    const projectId = this.generateProjectId(resolvedPath);
    
    // Check if already registered
    if (this.projects.has(projectId)) {
      console.log(chalk.yellow(`⚠️  Project already registered: ${path.basename(resolvedPath)}`));
      return projectId;
    }

    const projectContext = {
      id: projectId,
      name: path.basename(resolvedPath),
      workingDir: resolvedPath,
      active: this.projects.size === 0, // First project is active by default
      createdAt: Date.now(),
      lastActive: Date.now()
    };

    this.projects.set(projectId, projectContext);
    
    // Set as current if first project
    if (this.projects.size === 1) {
      this.currentProjectId = projectId;
    }

    console.log(chalk.green(`✓ Registered project: ${chalk.cyan(projectContext.name)} (${this.projects.size} total)`));
    
    return projectId;
  }

  /**
   * Switch to a different project
   * @param {string} projectId
   * @returns {boolean} success
   */
  switchProject(projectId) {
    if (!this.projects.has(projectId)) {
      console.error(chalk.red(`❌ Project not found: ${projectId}`));
      return false;
    }

    // Deactivate current project
    if (this.currentProjectId) {
      const current = this.projects.get(this.currentProjectId);
      if (current) {
        current.active = false;
      }
    }

    // Activate new project
    const newProject = this.projects.get(projectId);
    newProject.active = true;
    newProject.lastActive = Date.now();
    this.currentProjectId = projectId;

    console.log(chalk.blue(`Switched to project: ${chalk.cyan(newProject.name)}`));
    
    return true;
  }

  /**
   * Get currently active project
   * @returns {ProjectContext|null}
   */
  getActiveProject() {
    if (!this.currentProjectId) {
      return null;
    }
    return this.projects.get(this.currentProjectId);
  }

  /**
   * Get all projects
   * @returns {Array<ProjectContext>}
   */
  getAllProjects() {
    return Array.from(this.projects.values())
      .sort((a, b) => b.lastActive - a.lastActive); // Sort by last active
  }

  /**
   * Remove a project
   * @param {string} projectId
   */
  removeProject(projectId) {
    const project = this.projects.get(projectId);
    if (!project) return;

    this.projects.delete(projectId);
    console.log(chalk.yellow(`Removed project: ${project.name}`));

    // If removed project was active, switch to another
    if (projectId === this.currentProjectId) {
      const remaining = Array.from(this.projects.keys());
      if (remaining.length > 0) {
        this.switchProject(remaining[0]);
      } else {
        this.currentProjectId = null;
      }
    }
  }

  /**
   * Generate unique project ID from path
   * @param {string} projectPath
   * @returns {string}
   */
  generateProjectId(projectPath) {
    return crypto
      .createHash('md5')
      .update(projectPath)
      .digest('hex')
      .substring(0, 8);
  }

  /**
   * Acquire leader lock
   * @param {number} port
   * @param {number} pid
   * @returns {Promise<boolean>}
   */
  async acquireLock(port, pid = process.pid) {
    try {
      // Ensure .vg directory exists
      await fs.ensureDir(path.dirname(this.lockFilePath));

      // Check if lock already exists
      if (await fs.pathExists(this.lockFilePath)) {
        const existingLock = await fs.readJson(this.lockFilePath);
        
        // Check if existing leader is still alive
        const isAlive = await this.checkLeaderHealth(existingLock.port);
        if (isAlive) {
          console.log(chalk.yellow('⚠️  Leader already exists'));
          return false;
        } else {
          console.log(chalk.yellow('⚠️  Stale lock file detected, cleaning up...'));
          await fs.remove(this.lockFilePath);
        }
      }

      // Write lock file
      const lockData = {
        port,
        pid,
        startTime: Date.now(),
        hostname: os.hostname()
      };

      await fs.writeJson(this.lockFilePath, lockData, { spaces: 2 });
      console.log(chalk.green(`✓ Acquired leader lock (PID: ${pid}, Port: ${port})`));
      
      return true;
    } catch (error) {
      console.error(chalk.red('❌ Failed to acquire lock:'), error.message);
      return false;
    }
  }

  /**
   * Release leader lock
   * @returns {Promise<void>}
   */
  async releaseLock() {
    try {
      if (await fs.pathExists(this.lockFilePath)) {
        await fs.remove(this.lockFilePath);
        console.log(chalk.green('✓ Released leader lock'));
      }
    } catch (error) {
      console.error(chalk.red('❌ Failed to release lock:'), error.message);
    }
  }

  /**
   * Check if leader exists and is healthy
   * @returns {Promise<Object|null>} Leader info or null
   */
  async checkLeader() {
    try {
      if (!await fs.pathExists(this.lockFilePath)) {
        return null;
      }

      const lockData = await fs.readJson(this.lockFilePath);
      
      // Check if leader is healthy
      const isHealthy = await this.checkLeaderHealth(lockData.port);
      
      if (isHealthy) {
        return lockData;
      } else {
        // Stale lock file
        console.log(chalk.yellow('⚠️  Leader not responding, cleaning up stale lock...'));
        await fs.remove(this.lockFilePath);
        return null;
      }
    } catch (error) {
      console.error(chalk.red('❌ Error checking leader:'), error.message);
      return null;
    }
  }

  /**
   * Check if leader server is healthy
   * @param {number} port
   * @returns {Promise<boolean>}
   */
  async checkLeaderHealth(port) {
    return new Promise((resolve) => {
      const req = http.get(`http://localhost:${port}/health`, (res) => {
        resolve(res.statusCode === 200);
      });

      req.on('error', () => {
        resolve(false);
      });

      req.setTimeout(2000, () => {
        req.destroy();
        resolve(false);
      });
    });
  }

  /**
   * Join existing leader as follower
   * @param {Object} leaderInfo
   * @param {string} projectPath
   * @returns {Promise<boolean>}
   */
  async joinLeader(leaderInfo, projectPath) {
    try {
      const { port } = leaderInfo;
      const resolvedPath = path.resolve(projectPath);
      const projectName = path.basename(resolvedPath);

      console.log(chalk.blue(`\n📡 Joining leader at port ${port}...`));
      
      // Send registration request to leader
      const response = await this.sendHttpRequest(port, '/api/projects/register', {
        method: 'POST',
        body: JSON.stringify({
          workingDir: resolvedPath,
          name: projectName
        })
      });

      if (response.success) {
        console.log(chalk.green('\n──────────────────────────────────────────────────'));
        console.log(`🔗 ${chalk.bold('Project Registered')}    ${chalk.green('● Joined')}`);
        console.log(chalk.gray('──────────────────────────────────────────────────'));
        console.log(`📁 Project:   ${chalk.cyan(projectName)}`);
        console.log(`🌐 Dashboard: ${chalk.blue(`http://localhost:${port}`)}`);
        console.log(`📊 Total:     ${chalk.yellow(response.totalProjects)} project(s)`);
        console.log(chalk.green('──────────────────────────────────────────────────\n'));
        console.log(chalk.blue('💡 Open the dashboard to switch between projects.'));
        return true;
      } else {
        throw new Error(response.error || 'Failed to register project');
      }
    } catch (error) {
      console.error(chalk.red('❌ Failed to join leader:'), error.message);
      return false;
    }
  }

  /**
   * Send HTTP request to server
   * @param {number} port
   * @param {string} path
   * @param {Object} options
   * @returns {Promise<Object>}
   */
  sendHttpRequest(port, path, options = {}) {
    return new Promise((resolve, reject) => {
      const postData = options.body || '';
      
      const req = http.request({
        hostname: 'localhost',
        port: port,
        path: path,
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      }, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            resolve(parsed);
          } catch (error) {
            reject(new Error('Invalid JSON response'));
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.setTimeout(5000, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      if (postData) {
        req.write(postData);
      }
      
      req.end();
    });
  }
}

// Export singleton instance
module.exports = new ProjectManager();
