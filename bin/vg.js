#!/usr/bin/env node

/**
 * VG Coder CLI Entry Point
 */

const VGCoderCLI = require('../src/index');

// Create and run CLI
const cli = new VGCoderCLI();
cli.run();
