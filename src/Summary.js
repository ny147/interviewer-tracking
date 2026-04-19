/**
 * Summary.js — Scoring engine for the Summary sheet.
 *
 * Summary sheet columns (0-based):
 *   0 CandidateID | 1 Name
 *   2 AvgTechnical | 3 AvgProblemSolving | 4 AvgCommunication
 *   5 AvgSystemDesign | 6 AvgCultureFit
 *   7 FinalScore | 8 Recommendation | 9 LastUpdated
 *
 * Scoring weights (equal, all 20 %):
 *   FinalScore = mean(avgTechnical, avgProblemSolving, avgCommunication, avgSystemDesign, avgCultureFit)
 *
 * Recommendation thresholds:
 *   >= 8   → "Strong Hire"
 *   >= 6   → "Hire"
 *   < 6    → "No Hire"
 */

/* global SpreadsheetApp, Utilities, Config */

var Summary = (function () {

  var SUMMARY_HEADERS = [
    'CandidateID', 'Name',
    'AvgTechnical', 'AvgProblemSolving', 'AvgCommunication',
    'AvgSystemDesign', 'AvgCultureFit',
    'FinalScore', 'Recommendation', 'LastUpdated'
  ];

  var EVAL_HEADERS = [
    'ID', 'CandidateID', 'InterviewerEmail',
    'TechnicalSkills', 'ProblemSolving', 'Communication',
    'SystemDesign', 'CultureFit', 'Notes', 'SubmittedAt'
  ];

  var ECOL = { CANDIDATE_ID: 1, TECHNICAL: 3, PROBLEM_SOLVING: 4, COMMUNICATION: 5, SYSTEM_DESIGN: 6, CULTURE_FIT: 7 };
  var SCOL = { CANDIDATE_ID: 0, NAME: 1, AVG_TECHNICAL: 2, AVG_PROBLEM_SOLVING: 3, AVG_COMMUNICATION: 4, AVG_SYSTEM_DESIGN: 5, AVG_CULTURE_FIT: 6, FINAL_SCORE: 7, RECOMMENDATION: 8, LAST_UPDATED: 9 };

  /**
   * Returns weights from Script Properties SCORE_WEIGHTS, or equal defaults.
   * Format: "technical:30,problemSolving:25,communication:20,systemDesign:15,cultureFit:10"
   * Values are normalised so they always sum to 1.
   */
  function getWeights_() {
    var defaults = { technical: 20, problemSolving: 20, communication: 20, systemDesign: 20, cultureFit: 20 };
    try {
      var raw = PropertiesService.getScriptProperties().getProperty('SCORE_WEIGHTS');
      if (!raw) return defaults;
      var parsed = {};
      raw.split(',').forEach(function(pair) {
        var parts = pair.trim().split(':');
        if (parts.length === 2) parsed[parts[0].trim()] = parseFloat(parts[1].trim()) || 0;
      });
      // Only use if all 5 keys are present
      var keys = ['technical','problemSolving','communication','systemDesign','cultureFit'];
      var valid = keys.every(function(k) { return parsed[k] !== undefined; });
      if (!valid) return defaults;

      var total = keys.reduce(function (sum, key) {
        var value = Number(parsed[key]);
        return isFinite(value) ? sum + value : sum;
      }, 0);

      return total > 0 ? parsed : defaults;
    } catch (e) {
      return defaults;
    }
  }

  function getSummarySheet_() {
    return SpreadsheetApp.openById(Config.getSheetId()).getSheetByName('Summary');
  }

  function getEvalSheet_() {
    return SpreadsheetApp.openById(Config.getSheetId()).getSheetByName('Evaluations');
  }

  function getCandidateSheet_() {
    return SpreadsheetApp.openById(Config.getSheetId()).getSheetByName('Candidates');
  }

  function avg_(numbers) {
    if (!numbers.length) return 0;
    var sum = numbers.reduce(function (a, b) { return a + b; }, 0);
    return Math.round((sum / numbers.length) * 100) / 100;
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Computes category averages for all evaluations of a candidate.
   * Returns null if no evaluations exist.
   * @param {string} candidateId
   * @returns {object|null}
   */
  function computeScores(candidateId) {
    var evalSheet = getEvalSheet_();
    var lastRow = evalSheet.getLastRow();
    if (lastRow < 2) return null;

    var rows = evalSheet.getRange(2, 1, lastRow - 1, EVAL_HEADERS.length).getValues();
    var relevant = rows.filter(function (r) { return String(r[ECOL.CANDIDATE_ID]) === candidateId; });

    if (!relevant.length) return null;

    function col_(idx) {
      return relevant.map(function (r) { return Number(r[idx]); });
    }

    var avgTechnical      = avg_(col_(ECOL.TECHNICAL));
    var avgProblemSolving = avg_(col_(ECOL.PROBLEM_SOLVING));
    var avgCommunication  = avg_(col_(ECOL.COMMUNICATION));
    var avgSystemDesign   = avg_(col_(ECOL.SYSTEM_DESIGN));
    var avgCultureFit     = avg_(col_(ECOL.CULTURE_FIT));

    // Weighted final score
    var w = getWeights_();
    var total = w.technical + w.problemSolving + w.communication + w.systemDesign + w.cultureFit;
    if (!isFinite(total) || total <= 0) {
      w = { technical: 20, problemSolving: 20, communication: 20, systemDesign: 20, cultureFit: 20 };
      total = 100;
    }
    var finalScore = Math.round((
      (avgTechnical      * w.technical      +
       avgProblemSolving * w.problemSolving  +
       avgCommunication  * w.communication   +
       avgSystemDesign   * w.systemDesign    +
       avgCultureFit     * w.cultureFit) / total
    ) * 100) / 100;

    return {
      avgTechnical:      avgTechnical,
      avgProblemSolving: avgProblemSolving,
      avgCommunication:  avgCommunication,
      avgSystemDesign:   avgSystemDesign,
      avgCultureFit:     avgCultureFit,
      finalScore:        finalScore
    };
  }

  /**
   * Returns a hiring recommendation string based on the final score.
   * @param {number} finalScore
   * @returns {'Strong Hire'|'Hire'|'No Hire'}
   */
  function getRecommendation(finalScore) {
    if (finalScore >= 8) return 'Strong Hire';
    if (finalScore >= 6) return 'Hire';
    return 'No Hire';
  }

  /**
   * Refreshes (insert or update) the Summary row for a candidate.
   * @param {string} candidateId
   */
  function refreshSummary(candidateId) {
    var scores = computeScores(candidateId);
    if (!scores) return; // no evaluations yet — nothing to summarise

    // Look up candidate name
    var candSheet = getCandidateSheet_();
    var candLastRow = candSheet.getLastRow();
    var candidateName = candidateId;
    if (candLastRow >= 2) {
      var candRows = candSheet.getRange(2, 1, candLastRow - 1, 2).getValues();
      for (var ci = 0; ci < candRows.length; ci++) {
        if (String(candRows[ci][0]) === candidateId) {
          candidateName = String(candRows[ci][1]);
          break;
        }
      }
    }

    var now = Utilities.formatDate(new Date(), 'UTC', 'yyyy-MM-dd HH:mm:ss');
    var newRow = [
      candidateId,
      candidateName,
      scores.avgTechnical,
      scores.avgProblemSolving,
      scores.avgCommunication,
      scores.avgSystemDesign,
      scores.avgCultureFit,
      scores.finalScore,
      getRecommendation(scores.finalScore),
      now
    ];

    var summarySheet = getSummarySheet_();
    var lastRow = summarySheet.getLastRow();

    // Check for an existing row to update
    if (lastRow >= 2) {
      var existingRows = summarySheet.getRange(2, 1, lastRow - 1, SUMMARY_HEADERS.length).getValues();
      for (var i = 0; i < existingRows.length; i++) {
        if (String(existingRows[i][SCOL.CANDIDATE_ID]) === candidateId) {
          summarySheet.getRange(i + 2, 1, 1, SUMMARY_HEADERS.length).setValues([newRow]);
          return;
        }
      }
    }

    // No existing row — append
    summarySheet.appendRow(newRow);
  }

  return {
    computeScores:      computeScores,
    getRecommendation:  getRecommendation,
    refreshSummary:     refreshSummary
  };
})();
