const fs = require('fs-extra');
const path = require('path');
const VGCoderCLI = require('../src/index');

describe('Ignore Patterns Tests', () => {
  let mockProjectDir;
  let outputDir;

  beforeEach(async () => {
    mockProjectDir = path.join(__dirname, 'fixtures', 'mock-project');
    outputDir = path.join(__dirname, '../test-output');
    
    await fs.ensureDir(mockProjectDir);
    await fs.ensureDir(outputDir);
    await createMockProjectWithBuildDirs(mockProjectDir);
  });

  afterEach(async () => {
    if (await fs.pathExists(mockProjectDir)) {
      await fs.remove(mockProjectDir);
    }
    if (await fs.pathExists(outputDir)) {
      await fs.remove(outputDir);
    }
  });

  test('should ignore build directories and hidden files', async () => {
    const cli = new VGCoderCLI();

    // Capture console output
    const originalLog = console.log;
    const originalError = console.error;
    const originalExit = process.exit;

    let consoleOutput = '';
    let errorOutput = '';
    let exitCalled = false;

    console.log = (...args) => {
      consoleOutput += args.join(' ') + '\n';
    };
    console.error = (...args) => {
      errorOutput += args.join(' ') + '\n';
    };
    process.exit = (code) => {
      exitCalled = true;
      throw new Error(`Process exit called with code ${code}`);
    };

    try {
      await cli.handleAnalyze(mockProjectDir, {
        maxTokens: 5000,
        output: outputDir
      });
    } catch (error) {
      if (!error.message.includes('Process exit called')) {
        throw error;
      }
    } finally {
      console.log = originalLog;
      console.error = originalError;
      process.exit = originalExit;
    }

    // Check that analysis completed
    expect(consoleOutput).toContain('✅ Output Generated');
    
    // Check output files exist
    const outputFiles = await fs.readdir(outputDir);
    expect(outputFiles).toContain('index.html');
    
    // Read the generated HTML to check content
    const indexContent = await fs.readFile(path.join(outputDir, 'index.html'), 'utf8');
    
    // Should NOT contain build directory files
    expect(indexContent).not.toContain('.git');
    expect(indexContent).not.toContain('.gradle');
    expect(indexContent).not.toContain('.idea');
    expect(indexContent).not.toContain('node_modules');
    expect(indexContent).not.toContain('build/');
    expect(indexContent).not.toContain('target/');
    expect(indexContent).not.toContain('dist/');
    
    // Should contain source files
    expect(indexContent).toContain('src/');
    expect(indexContent).toContain('Main.java');
    expect(indexContent).toContain('package.json');
  });

  test('should show correct directory structure without build dirs', async () => {
    const cli = new VGCoderCLI();
    
    // Capture console output
    const originalLog = console.log;
    let consoleOutput = '';
    console.log = (...args) => {
      consoleOutput += args.join(' ') + '\n';
    };

    try {
      await cli.handleAnalyze(mockProjectDir, {
        maxTokens: 5000,
        output: outputDir
      });
    } finally {
      console.log = originalLog;
    }

    // Check directory structure output
    expect(consoleOutput).toContain('📁 Directory Structure:');
    expect(consoleOutput).toContain('└── src');
    expect(consoleOutput).toContain('Main.java');
    
    // Should NOT show build directories
    expect(consoleOutput).not.toContain('.git/');
    expect(consoleOutput).not.toContain('.gradle/');
    expect(consoleOutput).not.toContain('build/');
    expect(consoleOutput).not.toContain('node_modules/');
    expect(consoleOutput).not.toContain('.idea/');
  });

  test('should count files correctly excluding build dirs', async () => {
    const cli = new VGCoderCLI();
    
    // Capture console output
    const originalLog = console.log;
    let consoleOutput = '';
    console.log = (...args) => {
      consoleOutput += args.join(' ') + '\n';
    };

    try {
      await cli.handleAnalyze(mockProjectDir, {
        maxTokens: 5000,
        output: outputDir
      });
    } finally {
      console.log = originalLog;
    }

    // Extract file counts from output
    const filesFoundMatch = consoleOutput.match(/Files Found: (\d+)/);
    const filesProcessedMatch = consoleOutput.match(/Files Processed: (\d+)/);
    
    expect(filesFoundMatch).toBeTruthy();
    expect(filesProcessedMatch).toBeTruthy();
    
    const filesFound = parseInt(filesFoundMatch[1]);
    const filesProcessed = parseInt(filesProcessedMatch[1]);
    
    // Should find only source files (3: Main.java, package.json, README.md)
    expect(filesFound).toBeLessThanOrEqual(10); // Should be much less than if build dirs were included
    expect(filesProcessed).toBeLessThanOrEqual(filesFound);
    
    // Should not include the many files we created in build directories
    expect(filesFound).toBeLessThan(20); // If build dirs were included, this would be much higher
  });

  async function createMockProjectWithBuildDirs(projectDir) {
    // Create source files
    await fs.ensureDir(path.join(projectDir, 'src', 'main', 'java'));
    await fs.writeFile(
      path.join(projectDir, 'src', 'main', 'java', 'Main.java'),
      `public class Main {
    public static void main(String[] args) {
        System.out.println("Hello World");
    }
}`
    );

    await fs.writeFile(
      path.join(projectDir, 'package.json'),
      JSON.stringify({
        name: 'mock-project',
        version: '1.0.0',
        description: 'Mock project for testing'
      }, null, 2)
    );

    await fs.writeFile(
      path.join(projectDir, 'README.md'),
      '# Mock Project\n\nThis is a test project.'
    );

    // Create build directories that should be ignored
    await fs.ensureDir(path.join(projectDir, '.git', 'objects'));
    await fs.writeFile(
      path.join(projectDir, '.git', 'config'),
      '[core]\n\trepositoryformatversion = 0'
    );

    await fs.ensureDir(path.join(projectDir, '.gradle', 'caches'));
    await fs.writeFile(
      path.join(projectDir, '.gradle', 'gradle.properties'),
      'org.gradle.daemon=true'
    );

    await fs.ensureDir(path.join(projectDir, '.idea'));
    await fs.writeFile(
      path.join(projectDir, '.idea', 'workspace.xml'),
      '<?xml version="1.0" encoding="UTF-8"?>\n<project></project>'
    );

    await fs.ensureDir(path.join(projectDir, 'build', 'classes'));
    await fs.writeFile(
      path.join(projectDir, 'build', 'classes', 'Main.class'),
      'compiled class file content'
    );

    await fs.ensureDir(path.join(projectDir, 'target', 'classes'));
    await fs.writeFile(
      path.join(projectDir, 'target', 'classes', 'Main.class'),
      'compiled class file content'
    );

    await fs.ensureDir(path.join(projectDir, 'node_modules', 'some-package'));
    await fs.writeFile(
      path.join(projectDir, 'node_modules', 'some-package', 'index.js'),
      'module.exports = {};'
    );

    await fs.ensureDir(path.join(projectDir, 'dist'));
    await fs.writeFile(
      path.join(projectDir, 'dist', 'bundle.js'),
      'console.log("bundled");'
    );

    // Create more files in build directories to test ignore
    for (let i = 0; i < 10; i++) {
      await fs.writeFile(
        path.join(projectDir, '.git', `file${i}.txt`),
        `git file ${i}`
      );
      await fs.writeFile(
        path.join(projectDir, 'build', `build${i}.txt`),
        `build file ${i}`
      );
    }
  }

  test('should scan deep Java package structure', async () => {
    // Create a deep Java package structure
    const deepJavaDir = path.join(mockProjectDir, 'src', 'main', 'java', 'com', 'example', 'service');
    await fs.ensureDir(deepJavaDir);

    // Create Java files at different levels
    await fs.writeFile(path.join(deepJavaDir, 'UserService.java'), `
package com.example.service;

public class UserService {
    public void createUser() {
        // Implementation
    }
}
    `);

    await fs.writeFile(path.join(deepJavaDir, 'UserController.java'), `
package com.example.service;

@RestController
public class UserController {
    @Autowired
    private UserService userService;
}
    `);

    const cli = new VGCoderCLI();

    // Capture console output
    const originalLog = console.log;
    const originalExit = process.exit;
    let consoleOutput = '';

    console.log = (...args) => {
      consoleOutput += args.join(' ') + '\n';
    };
    process.exit = (code) => {
      throw new Error(`Process exit called with code ${code}`);
    };

    try {
      await cli.handleAnalyze(mockProjectDir, {
        maxTokens: 5000,
        output: outputDir
      });
    } catch (error) {
      // Ignore process.exit errors
      if (!error.message.includes('Process exit called')) {
        throw error;
      }
    } finally {
      console.log = originalLog;
      process.exit = originalExit;
    }

    // Check that deep Java files are found
    expect(consoleOutput).toContain('UserService.java');
    expect(consoleOutput).toContain('UserController.java');

    // Check HTML content includes deep Java files
    const htmlContent = await fs.readFile(path.join(outputDir, 'index.html'), 'utf8');
    expect(htmlContent).toContain('UserService.java');
    expect(htmlContent).toContain('UserController.java');
    expect(htmlContent).toContain('package com.example.service');
    expect(htmlContent).toContain('@RestController');
  });

  test('should handle real Spring Boot project structure', async () => {
    // Test with actual hdb-signature-service if it exists
    const realProjectPath = 'hdb-signature-service';

    // Check if real project exists
    try {
      await fs.access(realProjectPath);
    } catch (error) {
      console.log('Real project not found, skipping test');
      return;
    }

    const cli = new VGCoderCLI();

    // Capture console output
    const originalLog = console.log;
    const originalExit = process.exit;
    let consoleOutput = '';

    console.log = (...args) => {
      consoleOutput += args.join(' ') + '\n';
    };
    process.exit = (code) => {
      throw new Error(`Process exit called with code ${code}`);
    };

    try {
      await cli.handleAnalyze(realProjectPath, {
        maxTokens: 3000,
        output: outputDir
      });
    } catch (error) {
      // Ignore process.exit errors
      if (!error.message.includes('Process exit called')) {
        throw error;
      }
    } finally {
      console.log = originalLog;
      process.exit = originalExit;
    }

    // Check that Spring Boot files are detected
    expect(consoleOutput).toContain('springBoot');

    // Check that Java files are found - check in HTML since console might not show all files
    const htmlContent = await fs.readFile(path.join(outputDir, 'index.html'), 'utf8');
    expect(htmlContent).toContain('SignatureApplication.java');

    // Check that build directories are ignored but Java files are found
    const filesFoundMatch = consoleOutput.match(/Files Found: (\d+)/);
    if (filesFoundMatch) {
      const filesFound = parseInt(filesFoundMatch[1]);
      expect(filesFound).toBeGreaterThan(100); // Should find many Java files now
      expect(filesFound).toBeLessThan(300); // But still less than without ignore patterns
    }

    // Verify specific Java files are in HTML
    expect(htmlContent).toContain('package vn.com.hdb.signature');
    expect(htmlContent).toContain('MicrometerConfiguration.java');
    expect(htmlContent).toContain('BaseController.java');
    expect(htmlContent).toContain('InternalSignatureController.java');

    // Verify no build artifacts in HTML
    expect(htmlContent).not.toContain('.gradle/');
    expect(htmlContent).not.toContain('build/classes');
    expect(htmlContent).not.toContain('.git/');
  });
});
