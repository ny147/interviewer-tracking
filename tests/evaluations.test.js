'use strict';
/**
 * evaluations.test.js — TDD tests for Evaluations.js
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

function buildEvalSandbox(userEmail, evalRows) {
  const { sandbox } = buildSandbox({
    scriptProperties: { GOOGLE_SHEET_ID: 'test-id', ADMIN_EMAILS: userEmail },
    userEmail,
    sheetData: {
      Interviewers: [['Email', 'Name', 'Role', 'Active']],
      Candidates: [['ID', 'Name', 'Position', 'Level', 'Status', 'CreatedAt', 'CreatedBy']],
      Evaluations: [EVAL_HEADERS, ...evalRows]
    }
  });
  loadFile(sandbox, path.join(SRC, 'Config.js'));
  loadFile(sandbox, path.join(SRC, 'Auth.js'));
  loadFile(sandbox, path.join(SRC, 'Evaluations.js'));
  return sandbox;
}

const VALID_SCORES = {
  technical: 8,
  leadership: 7,
  stakeholder: 9
};

describe('Evaluations — submitEvaluation', () => {
  it('creates an evaluation and returns it', () => {
    const sandbox = buildEvalSandbox('alice@example.com', []);
    const ev = sandbox.Evaluations.submitEvaluation({
      candidateId: 'c1',
      interviewerEmail: 'alice@example.com',
      scores: VALID_SCORES,
      notes: 'Strong candidate'
    });

    assert.ok(ev.id);
    assert.equal(ev.candidateId, 'c1');
    assert.equal(ev.interviewerEmail, 'alice@example.com');
    assert.equal(ev.scores.technical, 8);
    assert.equal(ev.notes, 'Strong candidate');
    assert.ok(ev.submittedAt);
  });

  it('throws when a score is out of range (1–10)', () => {
    const sandbox = buildEvalSandbox('alice@example.com', []);
    assert.throws(
      () => sandbox.Evaluations.submitEvaluation({
        candidateId: 'c1',
        interviewerEmail: 'alice@example.com',
        scores: { ...VALID_SCORES, technical: 11 },
        notes: ''
      }),
      /score.*1.*10|out of range/i
    );
  });

  it('throws when score is below 1', () => {
    const sandbox = buildEvalSandbox('alice@example.com', []);
    assert.throws(
      () => sandbox.Evaluations.submitEvaluation({
        candidateId: 'c1',
        interviewerEmail: 'alice@example.com',
        scores: { ...VALID_SCORES, stakeholder: 0 },
        notes: ''
      }),
      /score.*1.*10|out of range/i
    );
  });

  it('prevents a second evaluation by the same interviewer for the same candidate', () => {
    const existingRow = ['ev1', 'c1', 'alice@example.com', 8, 7, 9, '', '2026-01-01'];
    const sandbox = buildEvalSandbox('alice@example.com', [existingRow]);
    assert.throws(
      () => sandbox.Evaluations.submitEvaluation({
        candidateId: 'c1',
        interviewerEmail: 'alice@example.com',
        scores: VALID_SCORES,
        notes: ''
      }),
      /already submitted|duplicate/i
    );
  });
});

describe('Evaluations — getEvaluationsForCandidate', () => {
  it('returns all evaluations for a given candidate id', () => {
    const rows = [
      ['ev1', 'c1', 'alice@example.com', 8, 7, 9, '', '2026-01-01'],
      ['ev2', 'c1', 'bob@example.com',   7, 8, 7, '', '2026-01-02'],
      ['ev3', 'c2', 'alice@example.com', 9, 9, 8, '', '2026-01-03']
    ];
    const sandbox = buildEvalSandbox('admin@example.com', rows);
    const result = sandbox.Evaluations.getEvaluationsForCandidate('c1');
    assert.equal(result.length, 2);
    assert.ok(result.every(e => e.candidateId === 'c1'));
  });

  it('returns empty array when no evaluations exist for candidate', () => {
    const sandbox = buildEvalSandbox('admin@example.com', []);
    const result = sandbox.Evaluations.getEvaluationsForCandidate('none');
    assert.equal(result.length, 0);
  });
});

describe('Evaluations — getEvaluationByInterviewer', () => {
  it('returns the evaluation by a specific interviewer for a candidate', () => {
    const rows = [['ev1', 'c1', 'alice@example.com', 8, 7, 9, 'Good', '2026-01-01']];
    const sandbox = buildEvalSandbox('alice@example.com', rows);
    const ev = sandbox.Evaluations.getEvaluationByInterviewer('c1', 'alice@example.com');
    assert.equal(ev.id, 'ev1');
  });

  it('returns null when no match', () => {
    const sandbox = buildEvalSandbox('alice@example.com', []);
    const ev = sandbox.Evaluations.getEvaluationByInterviewer('c1', 'alice@example.com');
    assert.equal(ev, null);
  });
});

describe('Evaluations — updateEvaluation', () => {
  it('updates scores and notes for own evaluation', () => {
    const rows = [['ev1', 'c1', 'alice@example.com', 8, 7, 9, '', '2026-01-01']];
    const sandbox = buildEvalSandbox('alice@example.com', rows);
    const updated = sandbox.Evaluations.updateEvaluation('ev1', {
      scores: { ...VALID_SCORES, technical: 10 },
      notes: 'Updated note',
      requestingEmail: 'alice@example.com'
    });
    assert.equal(updated.scores.technical, 10);
    assert.equal(updated.notes, 'Updated note');
  });

  it('throws when trying to update another interviewer\'s evaluation', () => {
    const rows = [['ev1', 'c1', 'alice@example.com', 8, 7, 9, '', '2026-01-01']];
    const sandbox = buildEvalSandbox('bob@example.com', rows);
    assert.throws(
      () => sandbox.Evaluations.updateEvaluation('ev1', {
        scores: VALID_SCORES,
        notes: '',
        requestingEmail: 'bob@example.com'
      }),
      /not authorised|ownership/i
    );
  });
});

describe('Evaluations — deleteEvaluationsForCandidate', () => {
  it('removes all evaluations for the candidate and returns the deleted count', () => {
    const { sandbox, sheets } = buildSandbox({
      scriptProperties: { GOOGLE_SHEET_ID: 'test-id', ADMIN_EMAILS: 'admin@example.com' },
      userEmail: 'admin@example.com',
      sheetData: {
        Interviewers: [['Email', 'Name', 'Role', 'Active']],
        Candidates: [['ID', 'Name', 'Position', 'Level', 'Status', 'CreatedAt', 'CreatedBy']],
        Evaluations: [
          EVAL_HEADERS,
          ['ev1', 'c1', 'alice@example.com', 8, 7, 9, '', '2026-01-01'],
          ['ev2', 'c2', 'bob@example.com', 7, 8, 7, '', '2026-01-02'],
          ['ev3', 'c1', 'carol@example.com', 9, 9, 8, '', '2026-01-03']
        ]
      }
    });
    loadFile(sandbox, path.join(SRC, 'Config.js'));
    loadFile(sandbox, path.join(SRC, 'Auth.js'));
    loadFile(sandbox, path.join(SRC, 'Evaluations.js'));

    const deletedCount = sandbox.Evaluations.deleteEvaluationsForCandidate('c1');

    assert.equal(deletedCount, 2);
    assert.equal(sheets['Evaluations']._rows.length, 2);
    assert.equal(sheets['Evaluations']._rows[1][1], 'c2');
  });
});
