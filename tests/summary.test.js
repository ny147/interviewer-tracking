'use strict';
/**
 * summary.test.js — TDD tests for Summary.js
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { buildSandbox, loadFile } = require('./helpers/apps-script-harness.cjs');

const SRC = path.resolve(__dirname, '../src');

const EVAL_HEADERS = [
  'ID', 'CandidateID', 'InterviewerEmail',
  'Technical', 'Leadership', 'Stakeholder',
  'Notes', 'SubmittedAt'
];
const SUMMARY_HEADERS = [
  'CandidateID', 'Name',
  'AvgTechnical', 'AvgLeadership', 'AvgStakeholder',
  'FinalScore', 'Recommendation', 'LastUpdated'
];

function buildSummarySandbox(candidateRows, evalRows, summaryRows) {
  const { sandbox } = buildSandbox({
    scriptProperties: { GOOGLE_SHEET_ID: 'test-id', ADMIN_EMAILS: 'admin@example.com' },
    userEmail: 'admin@example.com',
    sheetData: {
      Candidates: [
        ['ID', 'Name', 'Position', 'Level', 'Status', 'CreatedAt', 'CreatedBy'],
        ...candidateRows
      ],
      Evaluations: [EVAL_HEADERS, ...evalRows],
      Summary: [SUMMARY_HEADERS, ...(summaryRows || [])],
      Interviewers: [['Email', 'Name', 'Role', 'Active']]
    }
  });
  loadFile(sandbox, path.join(SRC, 'Config.js'));
  loadFile(sandbox, path.join(SRC, 'Auth.js'));
  loadFile(sandbox, path.join(SRC, 'Summary.js'));
  return sandbox;
}

describe('Summary — computeScores', () => {
  it('returns correct category averages for a candidate with two evaluations', () => {
    const evalRows = [
      ['ev1', 'c1', 'alice@example.com', 8, 7, 9, '', '2026-01-01'],
      ['ev2', 'c1', 'bob@example.com',   6, 9, 7, '', '2026-01-02']
    ];
    const sandbox = buildSummarySandbox([['c1', 'Jane', 'SDE', 'Senior', 'Active', '', '']], evalRows);
    const result = sandbox.Summary.computeScores('c1');

    assert.equal(result.avgTechnical, 7);       // (8+6)/2
    assert.equal(result.avgLeadership, 8);      // (7+9)/2
    assert.equal(result.avgStakeholder, 8);     // (9+7)/2
  });

  it('returns null when no evaluations exist for candidate', () => {
    const sandbox = buildSummarySandbox([['c1', 'Jane', 'SDE', 'Senior', 'Active', '', '']], []);
    const result = sandbox.Summary.computeScores('c1');
    assert.equal(result, null);
  });

  it('falls back to default weighting when stored weights total zero', () => {
    const { sandbox } = buildSandbox({
      scriptProperties: {
        GOOGLE_SHEET_ID: 'test-id',
        ADMIN_EMAILS: 'admin@example.com',
        SCORE_WEIGHTS: 'technical:0,leadership:0,stakeholder:0'
      },
      userEmail: 'admin@example.com',
      sheetData: {
        Candidates: [
          ['ID', 'Name', 'Position', 'Level', 'Status', 'CreatedAt', 'CreatedBy'],
          ['c1', 'Jane', 'SDE', 'Senior', 'Active', '', '']
        ],
        Evaluations: [
          EVAL_HEADERS,
          ['ev1', 'c1', 'alice@example.com', 8, 6, 10, '', '2026-01-01']
        ],
        Summary: [SUMMARY_HEADERS],
        Interviewers: [['Email', 'Name', 'Role', 'Active']]
      }
    });
    loadFile(sandbox, path.join(SRC, 'Config.js'));
    loadFile(sandbox, path.join(SRC, 'Auth.js'));
    loadFile(sandbox, path.join(SRC, 'Summary.js'));

    const result = sandbox.Summary.computeScores('c1');

    assert.equal(result.finalScore, 8);
  });
});

describe('Summary — getRecommendation', () => {
  it('returns "Strong Hire" for final score >= 8', () => {
    const sandbox = buildSummarySandbox([], []);
    assert.equal(sandbox.Summary.getRecommendation(8.5), 'Strong Hire');
    assert.equal(sandbox.Summary.getRecommendation(8.0), 'Strong Hire');
  });

  it('returns "Hire" for score between 6 and 7.99', () => {
    const sandbox = buildSummarySandbox([], []);
    assert.equal(sandbox.Summary.getRecommendation(6.0), 'Hire');
    assert.equal(sandbox.Summary.getRecommendation(7.5), 'Hire');
  });

  it('returns "No Hire" for score < 6', () => {
    const sandbox = buildSummarySandbox([], []);
    assert.equal(sandbox.Summary.getRecommendation(5.9), 'No Hire');
    assert.equal(sandbox.Summary.getRecommendation(1.0), 'No Hire');
  });
});

describe('Summary — refreshSummary', () => {
  it('writes a summary row for a candidate with evaluations', () => {
    const evalRows = [
      ['ev1', 'c1', 'alice@example.com', 8, 8, 8, '', '2026-01-01']
    ];
    const { sandbox, sheets } = buildSandbox({
      scriptProperties: { GOOGLE_SHEET_ID: 'test-id', ADMIN_EMAILS: 'admin@example.com' },
      userEmail: 'admin@example.com',
      sheetData: {
        Candidates: [
          ['ID', 'Name', 'Position', 'Level', 'Status', 'CreatedAt', 'CreatedBy'],
          ['c1', 'Jane', 'SDE', 'Senior', 'Active', '', '']
        ],
        Evaluations: [EVAL_HEADERS, ...evalRows],
        Summary: [SUMMARY_HEADERS],
        Interviewers: [['Email', 'Name', 'Role', 'Active']]
      }
    });
    loadFile(sandbox, path.join(SRC, 'Config.js'));
    loadFile(sandbox, path.join(SRC, 'Auth.js'));
    loadFile(sandbox, path.join(SRC, 'Summary.js'));

    sandbox.Summary.refreshSummary('c1');

    const rows = sheets['Summary']._rows;
    // Row index 0 is headers, index 1 should be the new summary row
    assert.equal(rows.length, 2);
    assert.equal(rows[1][0], 'c1');
    assert.equal(rows[1][1], 'Jane');
    assert.equal(rows[1][5], 8);     // FinalScore = 8
    assert.equal(rows[1][6], 'Strong Hire');
  });

  it('updates an existing summary row instead of duplicating', () => {
    const evalRows = [
      ['ev1', 'c1', 'alice@example.com', 6, 6, 6, '', '2026-01-01']
    ];
    const existingSummaryRow = ['c1', 'Jane', 0, 0, 0, 0, 'No Hire', '2026-01-01'];
    const { sandbox, sheets } = buildSandbox({
      scriptProperties: { GOOGLE_SHEET_ID: 'test-id', ADMIN_EMAILS: 'admin@example.com' },
      userEmail: 'admin@example.com',
      sheetData: {
        Candidates: [
          ['ID', 'Name', 'Position', 'Level', 'Status', 'CreatedAt', 'CreatedBy'],
          ['c1', 'Jane', 'SDE', 'Senior', 'Active', '', '']
        ],
        Evaluations: [EVAL_HEADERS, ...evalRows],
        Summary: [SUMMARY_HEADERS, existingSummaryRow],
        Interviewers: [['Email', 'Name', 'Role', 'Active']]
      }
    });
    loadFile(sandbox, path.join(SRC, 'Config.js'));
    loadFile(sandbox, path.join(SRC, 'Auth.js'));
    loadFile(sandbox, path.join(SRC, 'Summary.js'));

    sandbox.Summary.refreshSummary('c1');

    const rows = sheets['Summary']._rows;
    assert.equal(rows.length, 2); // still only 1 data row, not 2
    assert.equal(rows[1][5], 6);  // updated FinalScore
    assert.equal(rows[1][6], 'Hire');
  });
});

describe('Summary — removeSummary', () => {
  it('removes an existing summary row for the candidate', () => {
    const { sandbox, sheets } = buildSandbox({
      scriptProperties: { GOOGLE_SHEET_ID: 'test-id', ADMIN_EMAILS: 'admin@example.com' },
      userEmail: 'admin@example.com',
      sheetData: {
        Candidates: [
          ['ID', 'Name', 'Position', 'Level', 'Status', 'CreatedAt', 'CreatedBy'],
          ['c1', 'Jane', 'SDE', 'Senior', 'Active', '', '']
        ],
        Evaluations: [EVAL_HEADERS],
        Summary: [
          SUMMARY_HEADERS,
          ['c1', 'Jane', 8, 8, 8, 8, 'Strong Hire', '2026-01-01']
        ],
        Interviewers: [['Email', 'Name', 'Role', 'Active']]
      }
    });
    loadFile(sandbox, path.join(SRC, 'Config.js'));
    loadFile(sandbox, path.join(SRC, 'Auth.js'));
    loadFile(sandbox, path.join(SRC, 'Summary.js'));

    const removed = sandbox.Summary.removeSummary('c1');

    assert.equal(removed, true);
    assert.equal(sheets['Summary']._rows.length, 1);
  });

  it('returns false when no summary row exists for the candidate', () => {
    const sandbox = buildSummarySandbox([], [], []);

    const removed = sandbox.Summary.removeSummary('missing');

    assert.equal(removed, false);
  });
});
