/**
 * Evaluations.js — CRUD for the Evaluations sheet.
 *
 * Supported schema columns:
 *   ID | CandidateID | InterviewerEmail | Technical | Leadership | Stakeholder | Notes | SubmittedAt
 *
 * Legacy columns are also tolerated so existing spreadsheets continue to work:
 *   TechnicalSkills -> Technical
 *   ProblemSolving  -> Leadership
 *   Communication   -> Stakeholder
 *
 * Business rules:
 *   - All scores must be integers 1–10.
 *   - One evaluation per interviewer per candidate.
 *   - Only the original interviewer may update an evaluation.
 */

/* global SpreadsheetApp, Utilities, Config */

var Evaluations = (function () {

  var HEADER_ALIASES = {
    id: ['ID'],
    candidateId: ['CandidateID'],
    interviewerEmail: ['InterviewerEmail'],
    technical: ['Technical', 'TechnicalSkills'],
    leadership: ['Leadership', 'ProblemSolving'],
    stakeholder: ['Stakeholder', 'Communication'],
    notes: ['Notes'],
    submittedAt: ['SubmittedAt']
  };

  var SCORE_FIELDS = ['technical', 'leadership', 'stakeholder'];

  function getSheet_() {
    return SpreadsheetApp.openById(Config.getSheetId()).getSheetByName('Evaluations');
  }

  function findHeaderIndex_(headers, aliases) {
    for (var i = 0; i < aliases.length; i++) {
      var idx = headers.indexOf(aliases[i]);
      if (idx !== -1) return idx;
    }
    return -1;
  }

  function getHeaders_() {
    var sheet = getSheet_();
    var lastColumn = sheet.getLastColumn();
    if (lastColumn < 1) return [];
    return sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map(function (value) {
      return String(value || '').trim();
    });
  }

  function getColumnMap_() {
    var headers = getHeaders_();
    return {
      headers: headers,
      id: findHeaderIndex_(headers, HEADER_ALIASES.id),
      candidateId: findHeaderIndex_(headers, HEADER_ALIASES.candidateId),
      interviewerEmail: findHeaderIndex_(headers, HEADER_ALIASES.interviewerEmail),
      technical: findHeaderIndex_(headers, HEADER_ALIASES.technical),
      leadership: findHeaderIndex_(headers, HEADER_ALIASES.leadership),
      stakeholder: findHeaderIndex_(headers, HEADER_ALIASES.stakeholder),
      notes: findHeaderIndex_(headers, HEADER_ALIASES.notes),
      submittedAt: findHeaderIndex_(headers, HEADER_ALIASES.submittedAt)
    };
  }

  function getCell_(row, idx) {
    return idx >= 0 && idx < row.length ? row[idx] : '';
  }

  function getAllRows_() {
    var sheet = getSheet_();
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];
    return sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
  }

  function rowToObject_(row, col) {
    return {
      id:               String(getCell_(row, col.id)),
      candidateId:      String(getCell_(row, col.candidateId)),
      interviewerEmail: String(getCell_(row, col.interviewerEmail)),
      scores: {
        technical:   Number(getCell_(row, col.technical)),
        leadership:  Number(getCell_(row, col.leadership)),
        stakeholder: Number(getCell_(row, col.stakeholder))
      },
      notes:       String(getCell_(row, col.notes)),
      submittedAt: String(getCell_(row, col.submittedAt))
    };
  }

  /**
   * Validates that all scores are integers in [1, 10].
   * Throws a descriptive error if any score is invalid.
   */
  function validateScores_(scores) {
    SCORE_FIELDS.forEach(function (field) {
      var v = scores[field];
      if (v === undefined || v === null || isNaN(Number(v))) {
        throw new Error('Score for ' + field + ' is required.');
      }
      var n = Number(v);
      if (n < 1 || n > 10) {
        throw new Error('Score for ' + field + ' is out of range — must be 1–10. Got: ' + n);
      }
    });
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Submits a new evaluation.
   * @param {{ candidateId, interviewerEmail, scores, notes }} input
   * @returns {object} evaluation object
   */
  function submitEvaluation(input) {
    var col = getColumnMap_();
    validateScores_(input.scores);

    // Duplicate check
    var existing = getEvaluationByInterviewer(input.candidateId, input.interviewerEmail);
    if (existing) {
      throw new Error(
        'Evaluation already submitted by ' + input.interviewerEmail +
        ' for candidate ' + input.candidateId + '.'
      );
    }

    var id  = Utilities.getUuid();
    var now = Utilities.formatDate(new Date(), 'UTC', 'yyyy-MM-dd HH:mm:ss');

    var row = [];
    for (var i = 0; i < col.headers.length; i++) row.push('');
    row[col.id] = id;
    row[col.candidateId] = input.candidateId;
    row[col.interviewerEmail] = input.interviewerEmail;
    row[col.technical] = input.scores.technical;
    row[col.leadership] = input.scores.leadership;
    row[col.stakeholder] = input.scores.stakeholder;
    if (col.notes !== -1) row[col.notes] = input.notes || '';
    if (col.submittedAt !== -1) row[col.submittedAt] = now;

    getSheet_().appendRow(row);
    return rowToObject_(row, col);
  }

  /**
   * Returns all evaluations for a candidate id.
   * @param {string} candidateId
   * @returns {object[]}
   */
  function getEvaluationsForCandidate(candidateId) {
    var col = getColumnMap_();
    return getAllRows_()
      .filter(function (r) { return String(getCell_(r, col.candidateId)) === candidateId; })
      .map(function (row) { return rowToObject_(row, col); });
  }

  /**
   * Returns the evaluation by a specific interviewer for a candidate, or null.
   * @param {string} candidateId
   * @param {string} interviewerEmail
   * @returns {object|null}
   */
  function getEvaluationByInterviewer(candidateId, interviewerEmail) {
    var col = getColumnMap_();
    var normalised = (interviewerEmail || '').toLowerCase().trim();
    var rows = getAllRows_();
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (
        String(getCell_(r, col.candidateId)) === candidateId &&
        String(getCell_(r, col.interviewerEmail)).toLowerCase().trim() === normalised
      ) {
        return rowToObject_(r, col);
      }
    }
    return null;
  }

  /**
   * Updates scores and notes on an existing evaluation.
   * Only the original interviewer may update their own evaluation.
   *
   * @param {string} evalId
   * @param {{ scores, notes, requestingEmail }} input
   * @returns {object} updated evaluation object
   */
  function updateEvaluation(evalId, input) {
    var col = getColumnMap_();
    validateScores_(input.scores);

    var sheet = getSheet_();
    var rows = getAllRows_();

    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (String(getCell_(r, col.id)) === evalId) {
        var owner = String(getCell_(r, col.interviewerEmail)).toLowerCase().trim();
        var requester = (input.requestingEmail || '').toLowerCase().trim();
        if (owner !== requester) {
          throw new Error(
            'Not authorised: ownership of evaluation ' + evalId +
            ' belongs to ' + owner + ', not ' + requester + '.'
          );
        }

        var sheetRow = i + 2; // 1-based + header offset
        sheet.getRange(sheetRow, col.technical + 1, 1, 1).setValues([[input.scores.technical]]);
        sheet.getRange(sheetRow, col.leadership + 1, 1, 1).setValues([[input.scores.leadership]]);
        sheet.getRange(sheetRow, col.stakeholder + 1, 1, 1).setValues([[input.scores.stakeholder]]);
        if (col.notes !== -1) {
          sheet.getRange(sheetRow, col.notes + 1, 1, 1).setValues([[input.notes || '']]);
        }

        // Return the updated object
        var updated = r.slice();
        updated[col.technical] = input.scores.technical;
        updated[col.leadership] = input.scores.leadership;
        updated[col.stakeholder] = input.scores.stakeholder;
        if (col.notes !== -1) updated[col.notes] = input.notes || '';
        return rowToObject_(updated, col);
      }
    }
    throw new Error('Evaluation not found: ' + evalId);
  }

  /**
   * Removes all evaluations for the given candidate id.
   * @param {string} candidateId
   * @returns {number} deleted row count
   */
  function deleteEvaluationsForCandidate(candidateId) {
    var col = getColumnMap_();
    var sheet = getSheet_();
    var rows = getAllRows_();
    var deletedCount = 0;

    for (var i = rows.length - 1; i >= 0; i--) {
      if (String(getCell_(rows[i], col.candidateId)) === candidateId) {
        sheet.deleteRow(i + 2);
        deletedCount++;
      }
    }

    return deletedCount;
  }

  return {
    submitEvaluation: submitEvaluation,
    getEvaluationsForCandidate: getEvaluationsForCandidate,
    getEvaluationByInterviewer: getEvaluationByInterviewer,
    updateEvaluation: updateEvaluation,
    deleteEvaluationsForCandidate: deleteEvaluationsForCandidate
  };
})();
