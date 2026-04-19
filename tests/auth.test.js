'use strict';
/**
 * auth.test.js — TDD tests for Auth.js
 * RED phase: tests are written against the expected API before implementation.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { buildSandbox, loadFile } = require('./helpers/apps-script-harness.cjs');

const SRC = path.resolve(__dirname, '../src');

function buildAuthSandbox(userEmail, adminEmails, interviewerRows) {
  const { sandbox } = buildSandbox({
    scriptProperties: {
      GOOGLE_SHEET_ID: 'test-sheet-id',
      ADMIN_EMAILS: adminEmails
    },
    userEmail,
    sheetData: {
      Interviewers: [
        ['Email', 'Name', 'Role', 'Active'],
        ...interviewerRows
      ]
    }
  });
  loadFile(sandbox, path.join(SRC, 'Config.js'));
  loadFile(sandbox, path.join(SRC, 'Auth.js'));
  return sandbox;
}

describe('Auth — getCurrentUserEmail', () => {
  it('returns the active user email', () => {
    const sandbox = buildAuthSandbox('alice@example.com', '', []);
    assert.equal(sandbox.Auth.getCurrentUserEmail(), 'alice@example.com');
  });
});

describe('Auth — isAdmin', () => {
  it('returns true when email is in ADMIN_EMAILS', () => {
    const sandbox = buildAuthSandbox('admin@example.com', 'admin@example.com,boss@example.com', []);
    assert.equal(sandbox.Auth.isAdmin('admin@example.com'), true);
  });

  it('returns false when email is not in ADMIN_EMAILS', () => {
    const sandbox = buildAuthSandbox('other@example.com', 'admin@example.com', []);
    assert.equal(sandbox.Auth.isAdmin('other@example.com'), false);
  });

  it('is case-insensitive', () => {
    const sandbox = buildAuthSandbox('Admin@Example.com', 'admin@example.com', []);
    assert.equal(sandbox.Auth.isAdmin('Admin@Example.com'), true);
  });
});

describe('Auth — isAuthorised', () => {
  it('returns true for admin even if not in Interviewers sheet', () => {
    const sandbox = buildAuthSandbox('admin@example.com', 'admin@example.com', []);
    assert.equal(sandbox.Auth.isAuthorised('admin@example.com'), true);
  });

  it('returns false when the Interviewers sheet is missing', () => {
    const sandbox = buildAuthSandbox('alice@example.com', '', []);
    sandbox.SpreadsheetApp.openById = function () {
      return {
        getSheetByName: function () {
          return null;
        }
      };
    };

    assert.equal(sandbox.Auth.isAuthorised('alice@example.com'), false);
  });

  it('returns true for email in active Interviewers row', () => {
    const sandbox = buildAuthSandbox(
      'alice@example.com', '',
      [['alice@example.com', 'Alice', 'interviewer', 'TRUE']]
    );
    assert.equal(sandbox.Auth.isAuthorised('alice@example.com'), true);
  });

  it('returns false for email in Interviewers sheet but inactive', () => {
    const sandbox = buildAuthSandbox(
      'bob@example.com', '',
      [['bob@example.com', 'Bob', 'interviewer', 'FALSE']]
    );
    assert.equal(sandbox.Auth.isAuthorised('bob@example.com'), false);
  });

  it('returns false for unknown email', () => {
    const sandbox = buildAuthSandbox('unknown@example.com', '', []);
    assert.equal(sandbox.Auth.isAuthorised('unknown@example.com'), false);
  });
});

describe('Auth — requireAuthorised', () => {
  it('does not throw for authorised user', () => {
    const sandbox = buildAuthSandbox(
      'alice@example.com', '',
      [['alice@example.com', 'Alice', 'interviewer', 'TRUE']]
    );
    assert.doesNotThrow(() => sandbox.Auth.requireAuthorised('alice@example.com'));
  });

  it('throws for unauthorised user', () => {
    const sandbox = buildAuthSandbox('spy@example.com', '', []);
    assert.throws(
      () => sandbox.Auth.requireAuthorised('spy@example.com'),
      /not authorised/i
    );
  });
});
