/**
 * Evaluations.js — CRUD for the Evaluations sheet.
 *
 * Sheet columns (0-based index / 1-based sheet col):
 *   0 ID | 1 CandidateID | 2 InterviewerEmail
 *   3 TechnicalSkills | 4 ProblemSolving | 5 Communication
 *   6 SystemDesign | 7 CultureFit | 8 Notes | 9 SubmittedAt
 *
 * Business rules:
 *   - All scores must be integers 1–10.
 *   - One evaluation per interviewer per candidate.
 *   - Only the original interviewer (or an admin) may update an evaluation.
 */

/* global SpreadsheetApp, Utilities, Config */

var Evaluations = (function () {

  var HEADERS = [
    'ID', 'CandidateID', 'InterviewerEmail',
    'TechnicalSkills', 'ProblemSolving', 'Communication',
    'SystemDesign', 'CultureFit', 'Notes', 'SubmittedAt'
  ];

  var COL = {
    ID: 0, CANDIDATE_ID: 1, INTERVIEWER: 2,
    TECHNICAL: 3, PROBLEM_SOLVING: 4, COMMUNICATION: 5,
    SYSTEM_DESIGN: 6, CULTURE_FIT: 7, NOTES: 8, SUBMITTED_AT: 9
  };

  var SCORE_FIELDS = ['technicalSkills', 'problemSolving', 'communication', 'systemDesign', 'cultureFit'];
  var SCORE_COL    = [COL.TECHNICAL, COL.PROBLEM_SOLVING, COL.COMMUNICATION, COL.SYSTEM_DESIGN, COL.CULTURE_FIT];

  function getSheet_() {
    return SpreadsheetApp.openById(Config.getSheetId()).getSheetByName('Evaluations');
  }

  function getAllRows_() {
    var sheet = getSheet_();
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];
    return sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
  }

  function rowToObject_(row) {
    return {
      id:               String(row[COL.ID]),
      candidateId:      String(row[COL.CANDIDATE_ID]),
      interviewerEmail: String(row[COL.INTERVIEWER]),
      scores: {
        technicalSkills: Number(row[COL.TECHNICAL]),
        problemSolving:  Number(row[COL.PROBLEM_SOLVING]),
        communication:   Number(row[COL.COMMUNICATION]),
        systemDesign:    Number(row[COL.SYSTEM_DESIGN]),
        cultureFit:      Number(row[COL.CULTURE_FIT])
      },
      notes:       String(row[COL.NOTES]),
      submittedAt: String(row[COL.SUBMITTED_AT])
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

    var row = [
      id,
      input.candidateId,
      input.interviewerEmail,
      input.scores.technicalSkills,
      input.scores.problemSolving,
      input.scores.communication,
      input.scores.systemDesign,
      input.scores.cultureFit,
      input.notes || '',
      now
    ];

    getSheet_().appendRow(row);
    return rowToObject_(row);
  }

  /**
   * Returns all evaluations for a candidate id.
   * @param {string} candidateId
   * @returns {object[]}
   */
  function getEvaluationsForCandidate(candidateId) {
    return getAllRows_()
      .filter(function (r) { return String(r[COL.CANDIDATE_ID]) === candidateId; })
      .map(rowToObject_);
  }

  /**
   * Returns the evaluation by a specific interviewer for a candidate, or null.
   * @param {string} candidateId
   * @param {string} interviewerEmail
   * @returns {object|null}
   */
  function getEvaluationByInterviewer(candidateId, interviewerEmail) {
    var normalised = (interviewerEmail || '').toLowerCase().trim();
    var rows = getAllRows_();
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (
        String(r[COL.CANDIDATE_ID]) === candidateId &&
        String(r[COL.INTERVIEWER]).toLowerCase().trim() === normalised
      ) {
        return rowToObject_(r);
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
    validateScores_(input.scores);

    var sheet = getSheet_();
    var rows = getAllRows_();

    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (String(r[COL.ID]) === evalId) {
        var owner = String(r[COL.INTERVIEWER]).toLowerCase().trim();
        var requester = (input.requestingEmail || '').toLowerCase().trim();
        if (owner !== requester) {
          throw new Error(
            'Not authorised: ownership of evaluation ' + evalId +
            ' belongs to ' + owner + ', not ' + requester + '.'
          );
        }

        var sheetRow = i + 2; // 1-based + header offset
        sheet.getRange(sheetRow, COL.TECHNICAL + 1, 1, 5).setValues([[
          input.scores.technicalSkills,
          input.scores.problemSolving,
          input.scores.communication,
          input.scores.systemDesign,
          input.scores.cultureFit
        ]]);
        sheet.getRange(sheetRow, COL.NOTES + 1, 1, 1).setValues([[input.notes || '']]);

        // Return the updated object
        var updated = r.slice();
        updated[COL.TECHNICAL]       = input.scores.technicalSkills;
        updated[COL.PROBLEM_SOLVING] = input.scores.problemSolving;
        updated[COL.COMMUNICATION]   = input.scores.communication;
        updated[COL.SYSTEM_DESIGN]   = input.scores.systemDesign;
        updated[COL.CULTURE_FIT]     = input.scores.cultureFit;
        updated[COL.NOTES]           = input.notes || '';
        return rowToObject_(updated);
      }
    }
    throw new Error('Evaluation not found: ' + evalId);
  }

  return {
    submitEvaluation: submitEvaluation,
    getEvaluationsForCandidate: getEvaluationsForCandidate,
    getEvaluationByInterviewer: getEvaluationByInterviewer,
    updateEvaluation: updateEvaluation
  };
})();
