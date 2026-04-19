#!/usr/bin/env node
/**
 * clean-properties.js
 *
 * Removes src/_SetupProperties.js after Script Properties have been set.
 * Run after: npm run set-properties → clasp push → run setScriptProperties
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const target = path.join(__dirname, '..', 'src', '_SetupProperties.js');

if (fs.existsSync(target)) {
  fs.unlinkSync(target);
  console.log('✓ Removed src/_SetupProperties.js');
} else {
  console.log('Nothing to clean (src/_SetupProperties.js not found).');
}
