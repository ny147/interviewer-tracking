'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('path');
const { buildSandbox, loadFile } = require('./helpers/apps-script-harness.cjs');

const SRC = path.resolve(__dirname, '../src');

function buildCodeSandbox(overrides, options) {
  options = options || {};
  const { sandbox } = buildSandbox({
    scriptProperties: Object.assign({ GOOGLE_SHEET_ID: 'test-id', ADMIN_EMAILS: 'admin@example.com' }, options.scriptProperties || {}),
    userEmail: options.userEmail || 'admin@example.com',
    sheetData: Object.assign({
      Candidates: [['ID', 'Name', 'Position', 'Level', 'Status', 'CreatedAt', 'CreatedBy']],
      Interviewers: [['Email', 'Name', 'Role', 'Active']],
      Evaluations: [['ID', 'CandidateID', 'InterviewerEmail', 'Technical', 'Leadership', 'Stakeholder', 'Notes', 'SubmittedAt']],
      Summary: [['CandidateID', 'Name', 'AvgTechnical', 'AvgLeadership', 'AvgStakeholder', 'FinalScore', 'Recommendation', 'LastUpdated']],
      AuditLog: [['Timestamp', 'UserEmail', 'Action', 'EntityType', 'EntityID', 'Detail']]
    }, options.sheetData || {})
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
      var template = {
        evaluate: function () {
          return {
            setTitle: function () { return this; },
            setXFrameOptionsMode: function () { return this; }
          };
        }
      };
      sandbox.__lastTemplate = template;
      return template;
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
        technical: 8,
        leadership: 8,
        stakeholder: 8
      },
      notes: 'Updated'
    });

    assert.equal(refreshedCandidateId, 'candidate-123');
    assert.equal(auditArgs[4], 'candidate-123');
  });
});

describe('Code — doGet', () => {
  it('strips any existing query string from the web app url used by templates', () => {
    const sandbox = buildCodeSandbox();

    sandbox.doGet({ parameter: { page: 'candidates' } });

    assert.equal(sandbox.__lastTemplate.webAppUrl, 'https://example.test/app');
  });

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

describe('Code — admin access management', () => {
  it('adds admin emails to script properties when an admin interviewer is created', () => {
    const sandbox = buildCodeSandbox();

    sandbox.addInterviewer({ email: 'manager@example.com', name: 'Manager', role: 'Admin' });

    const adminEmails = sandbox.PropertiesService.getScriptProperties().getProperty('ADMIN_EMAILS');
    assert.match(adminEmails, /manager@example.com/);
  });

  it('removes admin emails from script properties when an admin interviewer is deactivated', () => {
    const sandbox = buildCodeSandbox({}, {
      sheetData: {
        Interviewers: [
          ['Email', 'Name', 'Role', 'Active'],
          ['admin@example.com', 'Primary Admin', 'Admin', 'TRUE'],
          ['manager@example.com', 'Manager', 'Admin', 'TRUE']
        ]
      },
      scriptProperties: {
        ADMIN_EMAILS: 'admin@example.com,manager@example.com'
      }
    });

    sandbox.toggleInterviewer('manager@example.com', false);

    const adminEmails = sandbox.PropertiesService.getScriptProperties().getProperty('ADMIN_EMAILS');
    assert.equal(adminEmails, 'admin@example.com');
  });
});

describe('Code — updateStatus', () => {
  it('delegates candidate status updates and writes an audit log entry', () => {
    var updatedCandidateId = null;
    var updatedStatus = null;
    var auditArgs = null;
    const sandbox = buildCodeSandbox({
      Candidates: {
        updateCandidateStatus: function (candidateId, status) {
          updatedCandidateId = candidateId;
          updatedStatus = status;
        }
      },
      AuditLog: {
        logEvent: function () {
          auditArgs = Array.prototype.slice.call(arguments);
        }
      }
    });

    const result = sandbox.updateStatus('c1', 'Hired');

    assert.equal(updatedCandidateId, 'c1');
    assert.equal(updatedStatus, 'Hired');
    assert.equal(result.ok, true);
    assert.deepEqual(auditArgs, ['admin@example.com', 'STATUS_CHANGED', 'Candidate', 'c1', 'Hired']);
  });
});

describe('Code — deleteCandidate', () => {
  it('deletes the candidate, removes dependent data, and writes an audit log entry', () => {
    var removedCandidateId = null;
    var deletedEvaluationsCandidateId = null;
    var deletedSummaryCandidateId = null;
    var auditArgs = null;
    const sandbox = buildCodeSandbox({
      Candidates: {
        removeCandidate: function (candidateId) {
          removedCandidateId = candidateId;
          return { id: candidateId, name: 'Alice' };
        }
      },
      Evaluations: {
        deleteEvaluationsForCandidate: function (candidateId) {
          deletedEvaluationsCandidateId = candidateId;
          return 2;
        }
      },
      Summary: {
        removeSummary: function (candidateId) {
          deletedSummaryCandidateId = candidateId;
          return true;
        }
      },
      AuditLog: {
        logEvent: function () {
          auditArgs = Array.prototype.slice.call(arguments);
        }
      }
    });

    const result = sandbox.deleteCandidate('c1');

    assert.equal(removedCandidateId, 'c1');
    assert.equal(deletedEvaluationsCandidateId, 'c1');
    assert.equal(deletedSummaryCandidateId, 'c1');
    assert.equal(result.ok, true);
    assert.equal(result.deletedEvaluations, 2);
    assert.deepEqual(auditArgs, ['admin@example.com', 'CANDIDATE_REMOVED', 'Candidate', 'c1', 'Alice']);
  });

  it('does not remove the candidate when dependent cleanup fails', () => {
    var removedCandidateId = null;
    var removedSummaryCandidateId = null;
    const sandbox = buildCodeSandbox({
      Candidates: {
        removeCandidate: function (candidateId) {
          removedCandidateId = candidateId;
          return { id: candidateId, name: 'Alice' };
        }
      },
      Evaluations: {
        deleteEvaluationsForCandidate: function () {
          throw new Error('Evaluation cleanup failed.');
        }
      },
      Summary: {
        removeSummary: function (candidateId) {
          removedSummaryCandidateId = candidateId;
          return true;
        }
      }
    });

    assert.throws(
      function () { sandbox.deleteCandidate('c1'); },
      /evaluation cleanup failed/i
    );
    assert.equal(removedCandidateId, null);
    assert.equal(removedSummaryCandidateId, null);
  });
});

describe('HTML regressions', () => {
  it('shares persisted theme behaviour through reusable partials across all app pages', () => {
    ['admin.html', 'candidates.html', 'evaluation.html', 'summary.html', 'report.html'].forEach(function (fileName) {
      const html = fs.readFileSync(path.join(SRC, 'html', fileName), 'utf8');

      assert.match(html, /include\('html\/shared\/theme-head'\)/);
      assert.match(html, /include\('html\/shared\/theme-utils'\)/);
      assert.match(html, /id="themeToggle"/);
    });

    const themeHead = fs.readFileSync(path.join(SRC, 'html', 'shared', 'theme-head.html'), 'utf8');
    const themeUtils = fs.readFileSync(path.join(SRC, 'html', 'shared', 'theme-utils.html'), 'utf8');

    assert.match(themeHead, /darkMode:\s*'class'/);
    assert.match(themeHead, /localStorage\.getItem\('interviewer-theme'\)/);
    assert.match(themeUtils, /function toggleTheme\(/);
    assert.match(themeUtils, /function bindSystemThemePreference\(/);
  });

  it('uses a top-level window open fallback when evaluation save succeeds', () => {
    const html = fs.readFileSync(path.join(SRC, 'html', 'evaluation.html'), 'utf8');

    assert.match(html, /window\.open\(APP_URL \+ '\?page=candidates', '_top'\)/);
  });

  it('shows only technical, leadership, and stakeholder inputs on the evaluation page', () => {
    const html = fs.readFileSync(path.join(SRC, 'html', 'evaluation.html'), 'utf8');

    assert.match(html, /Technical/);
    assert.match(html, /Leadership/);
    assert.match(html, /Stakeholder/);
    assert.doesNotMatch(html, /Problem Solving/);
    assert.doesNotMatch(html, /System Design/);
    assert.doesNotMatch(html, /Culture Fit/);
  });

  it('renders a client-side status update control on the candidates page', () => {
    const html = fs.readFileSync(path.join(SRC, 'html', 'candidates.html'), 'utf8');

    assert.match(html, /updateStatus\(/);
    assert.match(html, /google\.script\.run[\s\S]*\.updateStatus\(/);
  });

  it('renders a client-side candidate removal control on the candidates page', () => {
    const html = fs.readFileSync(path.join(SRC, 'html', 'candidates.html'), 'utf8');

    assert.match(html, /confirmRemoveCandidate\(/);
    assert.match(html, /google\.script\.run[\s\S]*\.deleteCandidate\(/);
  });

  it('shows three score columns on the summary page', () => {
    const html = fs.readFileSync(path.join(SRC, 'html', 'summary.html'), 'utf8');

    assert.match(html, /Leadership/);
    assert.match(html, /Stakeholder/);
    assert.doesNotMatch(html, /avgProblemSolving/);
    assert.doesNotMatch(html, /avgCultureFit/);
  });

  it('shows three score weights on the admin page', () => {
    const html = fs.readFileSync(path.join(SRC, 'html', 'admin.html'), 'utf8');

    assert.match(html, /w-leadership/);
    assert.match(html, /w-stakeholder/);
    assert.doesNotMatch(html, /w-problemSolving/);
    assert.doesNotMatch(html, /w-cultureFit/);
  });
});