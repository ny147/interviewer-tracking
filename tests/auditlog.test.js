'use strict';
/**
 * auditlog.test.js — TDD tests for AuditLog.js (Phase 6d)
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { buildSandbox, loadFile } = require('./helpers/apps-script-harness.cjs');

const SRC = path.resolve(__dirname, '../src');

const AUDIT_HEADERS = ['Timestamp', 'UserEmail', 'Action', 'EntityType', 'EntityID', 'Detail'];

function createSheetMock(data) {
  const rows = (data || []).map(row => row.slice());

  return {
    _rows: rows,
    getLastRow() {
      return rows.length;
    },
    getRange(row, col, numRows, numCols) {
      return {
        getValues() {
          const result = [];
          for (let r = row - 1; r < row - 1 + (numRows || 1); r++) {
            const rowData = [];
            for (let c = col - 1; c < col - 1 + (numCols || 1); c++) {
              rowData.push((rows[r] && rows[r][c] !== undefined) ? rows[r][c] : '');
            }
            result.push(rowData);
          }
          return result;
        },
        setValues(values) {
          for (let r = 0; r < values.length; r++) {
            const rowIndex = row - 1 + r;
            while (rows.length <= rowIndex) rows.push([]);
            for (let c = 0; c < values[r].length; c++) {
              const colIndex = col - 1 + c;
              while (rows[rowIndex].length <= colIndex) rows[rowIndex].push('');
              rows[rowIndex][colIndex] = values[r][c];
            }
          }
        }
      };
    },
    appendRow(rowArray) {
      rows.push(rowArray.slice());
    }
  };
}

function buildAuditSandbox(auditRows) {
  const { sandbox, sheets } = buildSandbox({
    scriptProperties: { GOOGLE_SHEET_ID: 'test-id', ADMIN_EMAILS: 'admin@example.com' },
    userEmail: 'admin@example.com',
    sheetData: {
      Candidates:   [['ID', 'Name', 'Position', 'Level', 'Status', 'CreatedAt', 'CreatedBy']],
      Interviewers: [['Email', 'Name', 'Role', 'Active']],
      Evaluations:  [['ID', 'CandidateID', 'InterviewerEmail', 'Technical', 'Leadership', 'Stakeholder', 'Notes', 'SubmittedAt']],
      Summary:      [['CandidateID', 'Name', 'AvgTechnical', 'AvgLeadership', 'AvgStakeholder', 'FinalScore', 'Recommendation', 'LastUpdated']],
      AuditLog:     [AUDIT_HEADERS, ...(auditRows || [])]
    }
  });
  loadFile(sandbox, path.join(SRC, 'Config.js'));
  loadFile(sandbox, path.join(SRC, 'Auth.js'));
  loadFile(sandbox, path.join(SRC, 'AuditLog.js'));
  return { sandbox, sheets };
}

describe('AuditLog — logEvent', () => {
  it('appends a row with all fields to the AuditLog sheet', () => {
    const { sandbox, sheets } = buildAuditSandbox([]);
    sandbox.AuditLog.logEvent('user@example.com', 'CANDIDATE_CREATED', 'Candidate', 'c1', 'Jane Doe');

    const rows = sheets['AuditLog']._rows;
    assert.equal(rows.length, 2); // header + 1 data row
    const data = rows[1];
    assert.equal(data[1], 'user@example.com'); // UserEmail
    assert.equal(data[2], 'CANDIDATE_CREATED'); // Action
    assert.equal(data[3], 'Candidate');          // EntityType
    assert.equal(data[4], 'c1');                 // EntityID
    assert.equal(data[5], 'Jane Doe');           // Detail
    assert.ok(data[0]); // Timestamp is truthy
  });

  it('writes empty strings for optional entityId and detail', () => {
    const { sandbox, sheets } = buildAuditSandbox([]);
    sandbox.AuditLog.logEvent('admin@example.com', 'PAGE_LOAD', 'System', '', '');

    const rows = sheets['AuditLog']._rows;
    assert.equal(rows.length, 2);
    assert.equal(rows[1][4], ''); // entityId
    assert.equal(rows[1][5], ''); // detail
  });

  it('creates the AuditLog sheet with headers when it is missing', () => {
    const { sandbox, sheets } = buildSandbox({
      scriptProperties: { GOOGLE_SHEET_ID: 'test-id', ADMIN_EMAILS: 'admin@example.com' },
      userEmail: 'admin@example.com',
      sheetData: {
        Candidates:   [['ID', 'Name', 'Position', 'Level', 'Status', 'CreatedAt', 'CreatedBy']],
        Interviewers: [['Email', 'Name', 'Role', 'Active']],
        Evaluations:  [['ID', 'CandidateID', 'InterviewerEmail', 'Technical', 'Leadership', 'Stakeholder', 'Notes', 'SubmittedAt']],
        Summary:      [['CandidateID', 'Name', 'AvgTechnical', 'AvgLeadership', 'AvgStakeholder', 'FinalScore', 'Recommendation', 'LastUpdated']]
      }
    });
    const spreadsheet = {
      getSheetByName(name) {
        return sheets[name] || null;
      },
      insertSheet(name) {
        const sheet = createSheetMock([]);
        sheets[name] = sheet;
        return sheet;
      }
    };
    sandbox.SpreadsheetApp.openById = function () {
      return spreadsheet;
    };
    loadFile(sandbox, path.join(SRC, 'Config.js'));
    loadFile(sandbox, path.join(SRC, 'Auth.js'));
    loadFile(sandbox, path.join(SRC, 'AuditLog.js'));

    sandbox.AuditLog.logEvent('user@example.com', 'CANDIDATE_CREATED', 'Candidate', 'c1', 'Jane Doe');

    assert.ok(sheets.AuditLog);
    assert.deepEqual(sheets.AuditLog._rows[0], AUDIT_HEADERS);
    assert.equal(sheets.AuditLog._rows[1][2], 'CANDIDATE_CREATED');
    assert.equal(sheets.AuditLog._rows[1][4], 'c1');
  });
});

describe('AuditLog — getAuditLogs', () => {
  it('returns empty array when no data rows exist', () => {
    const { sandbox } = buildAuditSandbox([]);
    const result = sandbox.AuditLog.getAuditLogs();
    assert.equal(result.length, 0);
  });

  it('returns all log entries as objects with correct fields', () => {
    const rows = [
      ['2026-01-01 10:00:00', 'alice@example.com', 'CANDIDATE_CREATED', 'Candidate', 'c1', 'Jane Doe'],
      ['2026-01-02 11:00:00', 'bob@example.com',   'EVAL_SUBMITTED',    'Evaluation', 'ev1', 'c1']
    ];
    const { sandbox } = buildAuditSandbox(rows);
    const result = sandbox.AuditLog.getAuditLogs();
    assert.equal(result.length, 2);
    // Newest first (reversed)
    assert.equal(result[0].action, 'EVAL_SUBMITTED');
    assert.equal(result[0].userEmail, 'bob@example.com');
    assert.equal(result[1].action, 'CANDIDATE_CREATED');
    assert.equal(result[1].entityId, 'c1');
  });

  it('returns objects with all expected properties', () => {
    const rows = [
      ['2026-01-01 09:00:00', 'user@example.com', 'STATUS_CHANGED', 'Candidate', 'c2', 'Hired']
    ];
    const { sandbox } = buildAuditSandbox(rows);
    const [entry] = sandbox.AuditLog.getAuditLogs();
    assert.ok('timestamp'  in entry);
    assert.ok('userEmail'  in entry);
    assert.ok('action'     in entry);
    assert.ok('entityType' in entry);
    assert.ok('entityId'   in entry);
    assert.ok('detail'     in entry);
    assert.equal(entry.action, 'STATUS_CHANGED');
    assert.equal(entry.detail, 'Hired');
  });
});
