'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { buildSandbox, loadFile } = require('./helpers/apps-script-harness.cjs');

const SRC = path.resolve(__dirname, '../src');

function buildCodeSandbox(overrides) {
  const { sandbox } = buildSandbox({
    scriptProperties: { GOOGLE_SHEET_ID: 'test-id', ADMIN_EMAILS: 'admin@example.com' },
    userEmail: 'admin@example.com',
    sheetData: {
      Candidates: [['ID', 'Name', 'Position', 'Level', 'Status', 'CreatedAt', 'CreatedBy']],
      Interviewers: [['Email', 'Name', 'Role', 'Active']],
      Evaluations: [['ID', 'CandidateID', 'InterviewerEmail', 'TechnicalSkills', 'ProblemSolving', 'Communication', 'SystemDesign', 'CultureFit', 'Notes', 'SubmittedAt']],
      Summary: [['CandidateID', 'Name', 'AvgTechnical', 'AvgProblemSolving', 'AvgCommunication', 'AvgSystemDesign', 'AvgCultureFit', 'FinalScore', 'Recommendation', 'LastUpdated']],
      AuditLog: [['Timestamp', 'UserEmail', 'Action', 'EntityType', 'EntityID', 'Detail']]
    }
  });

  sandbox.ScriptApp = {
    getService: function () {
      return {
        getUrl: function () {
          return 'https://example.test/app?foo=1&bar=2';
        }
      };
    }
  };
  sandbox.HtmlService = {
    XFrameOptionsMode: { ALLOWALL: 'ALLOWALL' },
    createTemplateFromFile: function () {
      return {
        evaluate: function () {
          return {
            setTitle: function () { return this; },
            setXFrameOptionsMode: function () { return this; }
          };
        }
      };
    },
    createHtmlOutput: function (html) {
      return {
        content: html,
        setTitle: function (title) {
          this.title = title;
          return this;
        }
      };
    }
  };
  sandbox.Auth = {
    getCurrentUserEmail: function () { return 'admin@example.com'; },
    requireAuthorised: function () {},
    isAdmin: function () { return true; }
  };
  sandbox.Candidates = {};
  sandbox.Evaluations = {};
  sandbox.Summary = {};
  sandbox.AuditLog = { logEvent: function () {} };
  sandbox.PropertiesService = sandbox.PropertiesService;
  sandbox.Config = { getSheetId: function () { return 'test-id'; } };

  Object.assign(sandbox, overrides || {});
  loadFile(sandbox, path.join(SRC, 'Code.js'));
  return sandbox;
}

describe('Code — updateEval', () => {
  it('refreshes and logs using the updated evaluation candidate id', () => {
    let refreshedCandidateId = null;
    let auditArgs = null;
    const sandbox = buildCodeSandbox({
      Evaluations: {
        updateEvaluation: function () {
          return { id: 'ev1', candidateId: 'candidate-123' };
        }
      },
      Summary: {
        refreshSummary: function (candidateId) {
          refreshedCandidateId = candidateId;
        }
      },
      AuditLog: {
        logEvent: function () {
          auditArgs = Array.prototype.slice.call(arguments);
        }
      }
    });

    sandbox.updateEval('ev1', {
      scores: {
        technicalSkills: 8,
        problemSolving: 8,
        communication: 8,
        systemDesign: 8,
        cultureFit: 8
      },
      notes: 'Updated'
    });

    assert.equal(refreshedCandidateId, 'candidate-123');
    assert.equal(auditArgs[4], 'candidate-123');
  });
});

describe('Code — doGet', () => {
  it('escapes generic error content before rendering HTML', () => {
    const sandbox = buildCodeSandbox({
      Auth: {
        getCurrentUserEmail: function () { return 'admin@example.com'; },
        requireAuthorised: function () {
          throw new Error('boom <img src=x onerror=alert(1)>');
        },
        isAdmin: function () { return true; }
      }
    });

    const result = sandbox.doGet({ parameter: {} });

    assert.match(result.content, /&lt;img src=x onerror=alert\(1\)&gt;/);
    assert.doesNotMatch(result.content, /<img src=x onerror=alert\(1\)>/);
  });

  it('escapes the user email on the access denied page', () => {
    const sandbox = buildCodeSandbox({
      Auth: {
        getCurrentUserEmail: function () {
          return 'bad@example.com<script>alert(1)</script>';
        },
        requireAuthorised: function () {
          throw new Error('User bad@example.com<script>alert(1)</script> is not authorised.');
        },
        isAdmin: function () { return false; }
      }
    });

    const result = sandbox.doGet({ parameter: {} });

    assert.match(result.content, /bad@example\.com&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
    assert.doesNotMatch(result.content, /bad@example\.com<script>alert\(1\)<\/script>/);
  });
});