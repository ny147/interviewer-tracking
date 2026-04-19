#!/usr/bin/env node
/**
 * setup-clasp.js — Generates .clasp.json from .env values.
 *
 * Run with: npm run setup:clasp
 *
 * Reads GOOGLE_SCRIPT_ID from .env and writes .clasp.json so `clasp push`
 * knows which Apps Script project to target.
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// Load .env manually (no extra deps)
function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  const env   = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim();
    env[key] = val;
  }
  return env;
}

const env = loadEnv(path.join(ROOT, '.env'));

const scriptId = env['GOOGLE_SCRIPT_ID'];
if (!scriptId) {
  console.error('Error: GOOGLE_SCRIPT_ID is not set in .env');
  console.error('Edit .env and add: GOOGLE_SCRIPT_ID=<your-script-id>');
  process.exit(1);
}

const claspJson = {
  scriptId:  scriptId,
  rootDir:   './src',
  projectId: env['GCP_PROJECT_NUMBER'] || undefined
};

// Remove undefined keys
Object.keys(claspJson).forEach(k => claspJson[k] === undefined && delete claspJson[k]);

const outPath = path.join(ROOT, '.clasp.json');
fs.writeFileSync(outPath, JSON.stringify(claspJson, null, 2) + '\n', 'utf8');
console.log('✓ .clasp.json written with scriptId:', scriptId);
