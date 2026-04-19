'use strict';
/**
 * candidates.test.js — TDD tests for Candidates.js
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { buildSandbox, loadFile } = require('./helpers/apps-script-harness.cjs');

const SRC = path.resolve(__dirname, '../src');

function buildSandboxWithAuth(userEmail, interviewerRows) {
  const { sandbox } = buildSandbox({
    scriptProperties: { GOOGLE_SHEET_ID: 'test-id', ADMIN_EMAILS: userEmail },
    userEmail,
    sheetData: {
      Interviewers: [
        ['Email', 'Name', 'Role', 'Active'],
        ...interviewerRows
      ],
      Candidates: [
        ['ID', 'Name', 'Position', 'Level', 'Status', 'CreatedAt', 'CreatedBy']
      ]
    }
  });
  loadFile(sandbox, path.join(SRC, 'Config.js'));
  loadFile(sandbox, path.join(SRC, 'Auth.js'));
  loadFile(sandbox, path.join(SRC, 'Candidates.js'));
  return sandbox;
}

describe('Candidates — addCandidate', () => {
  it('appends a row and returns a candidate object', () => {
    const sandbox = buildSandboxWithAuth('admin@example.com', []);
    const candidate = sandbox.Candidates.addCandidate({
      name: 'Jane Doe',
      position: 'Senior Data Engineer',
      level: 'Senior'
    }, 'admin@example.com');

    assert.equal(candidate.name, 'Jane Doe');
    assert.equal(candidate.position, 'Senior Data Engineer');
    assert.equal(candidate.level, 'Senior');
    assert.equal(candidate.status, 'Active');
    assert.ok(candidate.id, 'should have an id');
    assert.ok(candidate.createdAt, 'should have createdAt');
    assert.equal(candidate.createdBy, 'admin@example.com');
  });

  it('throws when name is empty', () => {
    const sandbox = buildSandboxWithAuth('admin@example.com', []);
    assert.throws(
      () => sandbox.Candidates.addCandidate({ name: '', position: 'Eng', level: 'Mid' }, 'admin@example.com'),
      /name.*required/i
    );
  });
});

describe('Candidates — getAllCandidates', () => {
  it('returns empty array when no data rows exist', () => {
    const sandbox = buildSandboxWithAuth('admin@example.com', []);
    const list = sandbox.Candidates.getAllCandidates();
    assert.equal(list.length, 0);
  });

  it('returns all candidates as objects', () => {
    const { sandbox } = buildSandbox({
      scriptProperties: { GOOGLE_SHEET_ID: 'test-id', ADMIN_EMAILS: 'admin@example.com' },
      userEmail: 'admin@example.com',
      sheetData: {
        Candidates: [
          ['ID', 'Name', 'Position', 'Level', 'Status', 'CreatedAt', 'CreatedBy'],
          ['c1', 'Alice', 'SDE', 'Senior', 'Active', '2026-01-01', 'admin@example.com'],
          ['c2', 'Bob', 'DE', 'Mid', 'Active', '2026-01-02', 'admin@example.com']
        ],
        Interviewers: [['Email', 'Name', 'Role', 'Active']]
      }
    });
    loadFile(sandbox, path.join(SRC, 'Config.js'));
    loadFile(sandbox, path.join(SRC, 'Auth.js'));
    loadFile(sandbox, path.join(SRC, 'Candidates.js'));
    const list = sandbox.Candidates.getAllCandidates();
    assert.equal(list.length, 2);
    assert.equal(list[0].id, 'c1');
    assert.equal(list[1].name, 'Bob');
  });
});

describe('Candidates — getCandidateById', () => {
  it('returns the matching candidate', () => {
    const { sandbox } = buildSandbox({
      scriptProperties: { GOOGLE_SHEET_ID: 'test-id', ADMIN_EMAILS: 'admin@example.com' },
      userEmail: 'admin@example.com',
      sheetData: {
        Candidates: [
          ['ID', 'Name', 'Position', 'Level', 'Status', 'CreatedAt', 'CreatedBy'],
          ['c1', 'Alice', 'SDE', 'Senior', 'Active', '2026-01-01', 'admin@example.com']
        ],
        Interviewers: [['Email', 'Name', 'Role', 'Active']]
      }
    });
    loadFile(sandbox, path.join(SRC, 'Config.js'));
    loadFile(sandbox, path.join(SRC, 'Auth.js'));
    loadFile(sandbox, path.join(SRC, 'Candidates.js'));
    const c = sandbox.Candidates.getCandidateById('c1');
    assert.equal(c.name, 'Alice');
  });

  it('returns null for unknown id', () => {
    const sandbox = buildSandboxWithAuth('admin@example.com', []);
    const c = sandbox.Candidates.getCandidateById('missing');
    assert.equal(c, null);
  });
});

describe('Candidates — updateCandidateStatus', () => {
  it('updates the status field in the sheet', () => {
    const { sandbox, sheets } = buildSandbox({
      scriptProperties: { GOOGLE_SHEET_ID: 'test-id', ADMIN_EMAILS: 'admin@example.com' },
      userEmail: 'admin@example.com',
      sheetData: {
        Candidates: [
          ['ID', 'Name', 'Position', 'Level', 'Status', 'CreatedAt', 'CreatedBy'],
          ['c1', 'Alice', 'SDE', 'Senior', 'Active', '2026-01-01', 'admin@example.com']
        ],
        Interviewers: [['Email', 'Name', 'Role', 'Active']]
      }
    });
    loadFile(sandbox, path.join(SRC, 'Config.js'));
    loadFile(sandbox, path.join(SRC, 'Auth.js'));
    loadFile(sandbox, path.join(SRC, 'Candidates.js'));
    sandbox.Candidates.updateCandidateStatus('c1', 'Hired');
    const row = sheets['Candidates']._rows[1];
    assert.equal(row[4], 'Hired'); // Status is column index 4
  });
});
