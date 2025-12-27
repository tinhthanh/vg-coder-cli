#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Path to node-pty module
const nodePtyPath = path.join(__dirname, '..', 'node_modules', 'node-pty');

// Check if node-pty exists
if (!fs.existsSync(nodePtyPath)) {
  console.log('⚠️  node-pty not found, skipping rebuild');
  process.exit(0);
}

console.log('🔨 Building node-pty native binaries from source...');

try {
  // Remove prebuilds directory to force rebuild from source
  const prebuildsPath = path.join(nodePtyPath, 'prebuilds');
  if (fs.existsSync(prebuildsPath)) {
    console.log('   Removing prebuilds directory to force source build...');
    fs.rmSync(prebuildsPath, { recursive: true, force: true });
  }
  
  // Force rebuild from source using node-gyp
  execSync('npm run install', {
    cwd: nodePtyPath,
    stdio: 'inherit'
  });
  console.log('✅ node-pty built successfully from source!');
} catch (error) {
  console.warn('⚠️  node-pty rebuild failed. Terminal functionality may not work.');
  console.warn('   Please ensure you have:');
  console.warn('   - Python 3.x installed');
  console.warn('   - C++ compiler (Xcode Command Line Tools on macOS, Visual Studio Build Tools on Windows)');
  console.warn('   Run manually: cd node_modules/node-pty && npm run install');
  // Don't fail the installation
  process.exit(0);
}
