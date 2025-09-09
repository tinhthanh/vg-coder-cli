// Jest setup file
const fs = require('fs-extra');
const path = require('path');

// Setup test environment
beforeAll(async () => {
  // Create test directories if needed
  const testDir = path.join(__dirname, 'fixtures');
  await fs.ensureDir(testDir);
});

// Cleanup after tests
afterAll(async () => {
  // Clean up test outputs
  const testOutputDir = path.join(__dirname, '../test-output');
  if (await fs.pathExists(testOutputDir)) {
    await fs.remove(testOutputDir);
  }
});

// Global test timeout
jest.setTimeout(30000);
