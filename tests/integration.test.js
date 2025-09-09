const fs = require('fs-extra');
const path = require('path');
const VGCoderCLI = require('../src/index');

describe('Integration Tests', () => {
  let testProjectDir;
  let outputDir;

  beforeEach(async () => {
    testProjectDir = path.join(__dirname, 'fixtures', 'integration-project');
    outputDir = path.join(__dirname, '../test-output');
    
    await fs.ensureDir(testProjectDir);
    await fs.ensureDir(outputDir);
    
    // Create a sample project structure
    await createSampleProject(testProjectDir);
  });

  afterEach(async () => {
    if (await fs.pathExists(testProjectDir)) {
      await fs.remove(testProjectDir);
    }
    if (await fs.pathExists(outputDir)) {
      await fs.remove(outputDir);
    }
  });

  test('should analyze a complete project', async () => {
    const cli = new VGCoderCLI();
    
    // Mock console.log to capture output
    const originalLog = console.log;
    const logs = [];
    console.log = (...args) => logs.push(args.join(' '));
    
    try {
      // Simulate command line arguments
      process.argv = [
        'node',
        'vg-coder',
        'analyze',
        '--path', testProjectDir,
        '--output', outputDir,
        '--max-tokens', '4000'
      ];
      
      await cli.handleAnalyze(testProjectDir, {
        output: outputDir,
        maxTokens: '4000',
        model: 'gpt-4',
        structure: true,
        theme: 'github'
      });
      
      // Verify output files exist
      expect(await fs.pathExists(path.join(outputDir, 'index.html'))).toBe(true);
      expect(await fs.pathExists(path.join(outputDir, 'combined.html'))).toBe(true);
      expect(await fs.pathExists(path.join(outputDir, 'chunks'))).toBe(true);
      expect(await fs.pathExists(path.join(outputDir, 'assets'))).toBe(true);
      
      // Verify assets
      expect(await fs.pathExists(path.join(outputDir, 'assets', 'styles.css'))).toBe(true);
      expect(await fs.pathExists(path.join(outputDir, 'assets', 'scripts.js'))).toBe(true);
      expect(await fs.pathExists(path.join(outputDir, 'assets', 'highlight.css'))).toBe(true);
      
      // Verify at least one chunk file exists
      const chunksDir = path.join(outputDir, 'chunks');
      const chunkFiles = await fs.readdir(chunksDir);
      expect(chunkFiles.length).toBeGreaterThan(0);
      expect(chunkFiles.some(file => file.startsWith('chunk-'))).toBe(true);
      
    } finally {
      console.log = originalLog;
    }
  }, 30000);

  test('should handle info command', async () => {
    const cli = new VGCoderCLI();
    
    // Mock console.log to capture output
    const originalLog = console.log;
    const logs = [];
    console.log = (...args) => logs.push(args.join(' '));
    
    try {
      await cli.handleInfo(testProjectDir, {});
      
      // Verify that info was logged
      const logOutput = logs.join('\n');
      expect(logOutput).toContain('Project Information');
      expect(logOutput).toContain('File Statistics');
      expect(logOutput).toContain('Token Statistics');
      
    } finally {
      console.log = originalLog;
    }
  });

  test('should handle clean command', async () => {
    // Create some files in output directory
    await fs.writeFile(path.join(outputDir, 'test.html'), 'test content');
    expect(await fs.pathExists(path.join(outputDir, 'test.html'))).toBe(true);
    
    const cli = new VGCoderCLI();
    
    await cli.handleClean({
      output: outputDir
    });
    
    // Verify directory was cleaned
    expect(await fs.pathExists(outputDir)).toBe(false);
  });
});

async function createSampleProject(projectDir) {
  // Create package.json for Node.js project
  const packageJson = {
    name: 'test-project',
    version: '1.0.0',
    dependencies: {
      'express': '^4.18.0'
    }
  };
  await fs.writeJson(path.join(projectDir, 'package.json'), packageJson);
  
  // Create some source files
  const srcDir = path.join(projectDir, 'src');
  await fs.ensureDir(srcDir);
  
  await fs.writeFile(path.join(srcDir, 'index.js'), `
const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
`);

  await fs.writeFile(path.join(srcDir, 'utils.js'), `
function formatDate(date) {
  return date.toISOString().split('T')[0];
}

function calculateAge(birthDate) {
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  
  return age;
}

module.exports = {
  formatDate,
  calculateAge
};
`);

  // Create a CSS file
  await fs.writeFile(path.join(srcDir, 'styles.css'), `
body {
  font-family: Arial, sans-serif;
  margin: 0;
  padding: 20px;
  background-color: #f5f5f5;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}

h1 {
  color: #333;
  text-align: center;
}
`);

  // Create .gitignore
  await fs.writeFile(path.join(projectDir, '.gitignore'), `
node_modules/
*.log
.env
dist/
build/
coverage/
`);

  // Create README
  await fs.writeFile(path.join(projectDir, 'README.md'), `
# Test Project

This is a test project for VG Coder CLI.

## Features

- Express.js server
- Utility functions
- CSS styling

## Usage

\`\`\`bash
npm start
\`\`\`
`);
}
