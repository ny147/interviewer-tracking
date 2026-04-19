/**
 * Code.js — Main entry point for the Apps Script web app.
 *
 * Routes:
 *   GET  /          → Candidate list page
 *   GET  /?page=eval&candidateId=<id>   → Evaluation form
 *   GET  /?page=summary                 → Summary dashboard
 *
 * POST handlers are called via google.script.run from the client.
 */

/* global HtmlService, Auth, Candidates, Evaluations, Summary, AuditLog, Session, ScriptApp, SpreadsheetApp, PropertiesService, Config */

// ── Web App Entry ─────────────────────────────────────────────────────────────

function escapeHtml_(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Serves the web app.  Requires the user to be authorised.
 * @param {object} e  — event object from Apps Script
 */
function doGet(e) {
  try {
    var email = Auth.getCurrentUserEmail();
    Auth.requireAuthorised(email);

    var page       = (e && e.parameter && e.parameter.page) || 'candidates';
    var title      = 'Interviewer';
    var webAppUrl  = ScriptApp.getService().getUrl();
    var template;

    if (page === 'eval') {
      template = HtmlService.createTemplateFromFile('html/evaluation');
      template.candidateId = (e.parameter && e.parameter.candidateId) || '';
      title = 'Evaluate Candidate';
    } else if (page === 'summary') {
      template = HtmlService.createTemplateFromFile('html/summary');
      title = 'Summary Dashboard';
    } else if (page === 'report') {
      template = HtmlService.createTemplateFromFile('html/report');
      template.candidateId = (e.parameter && e.parameter.candidateId) || '';
      title = 'Candidate Report';
    } else if (page === 'admin') {
      if (!Auth.isAdmin(email)) throw new Error('Admin access required.');
      template = HtmlService.createTemplateFromFile('html/admin');
      title = 'Admin';
    } else {
      template = HtmlService.createTemplateFromFile('html/candidates');
      title = 'Candidates';
    }

    template.userEmail  = email;
    template.isAdmin    = Auth.isAdmin(email);
    template.webAppUrl  = webAppUrl;

    return template.evaluate()
      .setTitle(title)
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);

  } catch (err) {
    var webAppUrl = ScriptApp.getService().getUrl();
    var isAuthError = String(err.message || '').indexOf('not authorised') !== -1;
    var safeWebAppUrl = escapeHtml_(webAppUrl);

    if (isAuthError) {
      // Friendly access-denied page with sign-out option
      var userEmail = '';
      try { userEmail = Auth.getCurrentUserEmail(); } catch (e2) {}
      var safeUserEmail = escapeHtml_(userEmail);
      var deniedHtml = '<!DOCTYPE html><html><head><title>Access Denied — Interviewer</title>'
        + '<style>'
        + 'body{font-family:system-ui,sans-serif;background:#f5f7fa;color:#1a1a2e;margin:0;}'
        + 'header{background:#2563eb;color:#fff;padding:1rem 1.5rem;display:flex;justify-content:space-between;align-items:center;}'
        + 'header h1{font-size:1.25rem;}'
        + '.card{max-width:480px;margin:4rem auto;background:#fff;border-radius:12px;padding:2.5rem;box-shadow:0 2px 8px rgba(0,0,0,.1);text-align:center;}'
        + '.icon{font-size:3rem;margin-bottom:1rem;}'
        + 'h2{font-size:1.25rem;margin-bottom:.75rem;color:#1a1a2e;}'
        + 'p{color:#64748b;font-size:.9rem;margin-bottom:1.5rem;}'
        + '.email-badge{display:inline-block;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:6px;padding:.4rem .9rem;font-size:.85rem;color:#374151;margin-bottom:1.5rem;}'
        + '.btn{display:inline-block;padding:.65rem 1.5rem;border-radius:8px;font-size:.9rem;font-weight:600;text-decoration:none;cursor:pointer;border:none;}'
        + '.btn-primary{background:#2563eb;color:#fff;}'
        + '.btn-secondary{background:#e5e7eb;color:#374151;margin-left:.75rem;}'
        + '</style></head><body>'
        + '<header><h1>Interviewer</h1></header>'
        + '<div class="card">'
        + '<div class="icon">🔒</div>'
        + '<h2>Access Denied</h2>'
        + (safeUserEmail ? '<div class="email-badge">' + safeUserEmail + '</div><br>' : '')
        + '<p>Your account is not authorised to use this system.<br>Please contact your administrator to request access.</p>'
        + '<a class="btn btn-primary" href="' + safeWebAppUrl + '" target="_top">Try Again</a>'
        + '<a class="btn btn-secondary" href="https://accounts.google.com/Logout" target="_top">Sign Out</a>'
        + '</div></body></html>';
      return HtmlService.createHtmlOutput(deniedHtml).setTitle('Access Denied');
    }

    // Generic error page
    var safeErrorMessage = escapeHtml_(String(err.message || err));
    var errorHtml = '<!DOCTYPE html><html><head><title>Error — Interviewer</title>'
      + '<style>'
      + 'body{font-family:system-ui,sans-serif;background:#f5f7fa;margin:0;}'
      + 'header{background:#2563eb;color:#fff;padding:1rem 1.5rem;}'
      + 'header h1{font-size:1.25rem;}'
      + '.card{max-width:560px;margin:3rem auto;background:#fff;border-radius:12px;padding:2rem;box-shadow:0 2px 8px rgba(0,0,0,.1);}'
      + 'h2{color:#b91c1c;margin-bottom:1rem;}'
      + 'pre{background:#fef2f2;border:1px solid #fecaca;color:#991b1b;padding:1rem;border-radius:6px;white-space:pre-wrap;font-size:.85rem;}'
      + 'a{color:#2563eb;text-decoration:none;}'
      + '</style></head><body>'
      + '<header><h1>Interviewer</h1></header>'
      + '<div class="card">'
      + '<h2>Something went wrong</h2>'
      + '<pre>' + safeErrorMessage + '</pre>'
      + '<p style="margin-top:1.25rem"><a href="' + safeWebAppUrl + '" target="_top">← Back to home</a></p>'
      + '</div></body></html>';
    return HtmlService.createHtmlOutput(errorHtml).setTitle('Error');
  }
}

// ── Server-side functions called via google.script.run ────────────────────────

/** @returns {object[]} */
function getCandidates() {
  Auth.requireAuthorised(Auth.getCurrentUserEmail());
  return Candidates.getAllCandidates();
}

/**
 * @param {{ name, position, level }} data
 * @returns {object}
 */
function createCandidate(data) {
  var email = Auth.getCurrentUserEmail();
  Auth.requireAuthorised(email);
  var candidate = Candidates.addCandidate(data, email);
  AuditLog.logEvent(email, 'CANDIDATE_CREATED', 'Candidate', candidate.id, candidate.name);
  return candidate;
}

/**
 * @param {{ candidateId, scores, notes }} data
 * @returns {object}
 */
function submitEval(data) {
  var email = Auth.getCurrentUserEmail();
  Auth.requireAuthorised(email);
  var result = Evaluations.submitEvaluation({
    candidateId:      data.candidateId,
    interviewerEmail: email,
    scores:           data.scores,
    notes:            data.notes || ''
  });
  Summary.refreshSummary(data.candidateId);
  AuditLog.logEvent(email, 'EVAL_SUBMITTED', 'Evaluation', result.id, data.candidateId);
  return result;
}

/**
 * @param {string} evalId
 * @param {{ scores, notes }} data
 * @returns {object}
 */
function updateEval(evalId, data) {
  var email = Auth.getCurrentUserEmail();
  Auth.requireAuthorised(email);
  var result = Evaluations.updateEvaluation(evalId, {
    scores:         data.scores,
    notes:          data.notes || '',
    requestingEmail: email
  });
  var candidateId = result && result.candidateId ? result.candidateId : data.candidateId;
  Summary.refreshSummary(candidateId);
  AuditLog.logEvent(email, 'EVAL_UPDATED', 'Evaluation', evalId, candidateId);
  return result;
}

/** @param {string} candidateId @returns {object[]} */
function getEvaluations(candidateId) {
  Auth.requireAuthorised(Auth.getCurrentUserEmail());
  return Evaluations.getEvaluationsForCandidate(candidateId);
}

/** @returns {object[]} */
function getSummary() {
  Auth.requireAuthorised(Auth.getCurrentUserEmail());
  var candidates = Candidates.getAllCandidates();
  return candidates.map(function (c) {
    var scores = Summary.computeScores(c.id);
    return Object.assign({}, c, scores || {});
  });
}

/**
 * Returns the current user's existing evaluation for a candidate, or null.
 * @param {string} candidateId
 * @returns {object|null}
 */
function getMyEvaluation(candidateId) {
  var email = Auth.getCurrentUserEmail();
  Auth.requireAuthorised(email);
  return Evaluations.getEvaluationByInterviewer(candidateId, email) || null;
}

/** @returns {object[]} — admin only */
function getInterviewers() {
  var email = Auth.getCurrentUserEmail();
  if (!Auth.isAdmin(email)) throw new Error('Admin access required.');
  var ss = SpreadsheetApp.openById(Config.getSheetId());
  var sheet = ss.getSheetByName('Interviewers');
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  var rows = sheet.getRange(2, 1, lastRow - 1, 4).getValues();
  return rows.map(function(r) {
    return { email: r[0], name: r[1], role: r[2], active: r[3] };
  });
}

/**
 * Updates a candidate's status (admin only).
 * @param {string} candidateId
 * @param {string} status  e.g. 'Active' | 'Hired' | 'Rejected'
 */
function updateStatus(candidateId, status) {
  var email = Auth.getCurrentUserEmail();
  Auth.requireAuthorised(email);
  if (!Auth.isAdmin(email)) throw new Error('Admin access required.');
  Candidates.updateCandidateStatus(candidateId, status);
  AuditLog.logEvent(email, 'STATUS_CHANGED', 'Candidate', candidateId, status);
  return { ok: true };
}

/**
 * Returns all audit log entries (admin only).
 * @returns {object[]}
 */
function getAuditLogs() {
  var email = Auth.getCurrentUserEmail();
  if (!Auth.isAdmin(email)) throw new Error('Admin access required.');
  return AuditLog.getAuditLogs();
}

/**
 * Returns a single candidate by id.
 * @param {string} candidateId
 * @returns {object|null}
 */
function getCandidateDetail(candidateId) {
  Auth.requireAuthorised(Auth.getCurrentUserEmail());
  return Candidates.getCandidateById(candidateId);
}

/**
 * Returns the current score weights (admin only).
 * @returns {object}
 */
function getScoreWeights() {
  var email = Auth.getCurrentUserEmail();
  if (!Auth.isAdmin(email)) throw new Error('Admin access required.');
  var raw = PropertiesService.getScriptProperties().getProperty('SCORE_WEIGHTS') || '';
  var defaults = { technical: 20, problemSolving: 20, communication: 20, systemDesign: 20, cultureFit: 20 };
  if (!raw) return defaults;
  var parsed = {};
  raw.split(',').forEach(function (pair) {
    var parts = pair.trim().split(':');
    if (parts.length === 2) parsed[parts[0].trim()] = parseFloat(parts[1].trim()) || 0;
  });
  var keys = ['technical', 'problemSolving', 'communication', 'systemDesign', 'cultureFit'];
  var valid = keys.every(function (k) { return parsed[k] !== undefined; });
  return valid ? parsed : defaults;
}

/**
 * Saves configurable per-category score weights (admin only).
 * @param {{ technical, problemSolving, communication, systemDesign, cultureFit }} weights
 */
function saveScoreWeights(weights) {
  var email = Auth.getCurrentUserEmail();
  if (!Auth.isAdmin(email)) throw new Error('Admin access required.');
  var keys = ['technical', 'problemSolving', 'communication', 'systemDesign', 'cultureFit'];
  for (var i = 0; i < keys.length; i++) {
    var v = Number(weights[keys[i]]);
    if (isNaN(v) || v < 0 || v > 100) {
      throw new Error('Weight for ' + keys[i] + ' must be a number between 0 and 100.');
    }
  }
  var serialised = keys.map(function (k) { return k + ':' + Number(weights[k]); }).join(',');
  PropertiesService.getScriptProperties().setProperty('SCORE_WEIGHTS', serialised);
  AuditLog.logEvent(email, 'WEIGHTS_UPDATED', 'System', '', serialised);
  return { ok: true };
}

/**
 * @param {{ email, name, role }} data — admin only
 */
function addInterviewer(data) {
  var email = Auth.getCurrentUserEmail();
  if (!Auth.isAdmin(email)) throw new Error('Admin access required.');
  if (!data.email) throw new Error('Email is required.');
  var ss = SpreadsheetApp.openById(Config.getSheetId());
  var sheet = ss.getSheetByName('Interviewers');
  sheet.appendRow([data.email.trim().toLowerCase(), data.name || '', data.role || '', 'TRUE']);
  return { ok: true };
}

/**
 * @param {string} interviewerEmail
 * @param {boolean} active
 */
function toggleInterviewer(interviewerEmail, active) {
  var email = Auth.getCurrentUserEmail();
  if (!Auth.isAdmin(email)) throw new Error('Admin access required.');
  var ss = SpreadsheetApp.openById(Config.getSheetId());
  var sheet = ss.getSheetByName('Interviewers');
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) throw new Error('Interviewer not found.');
  var rows = sheet.getRange(2, 1, lastRow - 1, 4).getValues();
  var normalised = (interviewerEmail || '').toLowerCase().trim();
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][0]).toLowerCase().trim() === normalised) {
      sheet.getRange(i + 2, 4).setValue(active ? 'TRUE' : 'FALSE');
      return { ok: true };
    }
  }
  throw new Error('Interviewer not found: ' + interviewerEmail);
}
