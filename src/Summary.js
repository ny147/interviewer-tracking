/**
 * Summary.js — Scoring engine for the Summary sheet.
 *
 * Supported schema columns:
 *   CandidateID | Name | AvgTechnical | AvgLeadership | AvgStakeholder | FinalScore | Recommendation | LastUpdated
 *
 * Legacy summary/evaluation headers are still accepted so existing spreadsheets remain readable.
 */

/* global SpreadsheetApp, Utilities, Config, PropertiesService */

var Summary = (function () {

  var SUMMARY_HEADER_ALIASES = {
    candidateId: ['CandidateID'],
    name: ['Name'],
    avgTechnical: ['AvgTechnical'],
    avgLeadership: ['AvgLeadership', 'AvgProblemSolving'],
    avgStakeholder: ['AvgStakeholder', 'AvgCommunication'],
    finalScore: ['FinalScore'],
    recommendation: ['Recommendation'],
    lastUpdated: ['LastUpdated']
  };

  var EVAL_HEADER_ALIASES = {
    candidateId: ['CandidateID'],
    technical: ['Technical', 'TechnicalSkills'],
    leadership: ['Leadership', 'ProblemSolving'],
    stakeholder: ['Stakeholder', 'Communication']
  };

  /**
   * Returns weights from Script Properties SCORE_WEIGHTS, or equal defaults.
   * Format: "technical:33.33,leadership:33.33,stakeholder:33.34"
   */
  function getWeights_() {
    var defaults = { technical: 1, leadership: 1, stakeholder: 1 };
    try {
      var raw = PropertiesService.getScriptProperties().getProperty('SCORE_WEIGHTS');
      if (!raw) return defaults;
      var parsed = {};
      raw.split(',').forEach(function(pair) {
        var parts = pair.trim().split(':');
        if (parts.length === 2) parsed[parts[0].trim()] = parseFloat(parts[1].trim()) || 0;
      });
      if (parsed.problemSolving !== undefined && parsed.leadership === undefined) {
        parsed.leadership = parsed.problemSolving;
      }
      if (parsed.communication !== undefined && parsed.stakeholder === undefined) {
        parsed.stakeholder = parsed.communication;
      }

      var keys = ['technical', 'leadership', 'stakeholder'];
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

  function findHeaderIndex_(headers, aliases) {
    for (var i = 0; i < aliases.length; i++) {
      var idx = headers.indexOf(aliases[i]);
      if (idx !== -1) return idx;
    }
    return -1;
  }

  function getHeaders_(sheet) {
    var lastColumn = sheet.getLastColumn();
    if (lastColumn < 1) return [];
    return sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map(function (value) {
      return String(value || '').trim();
    });
  }

  function getEvalColumnMap_() {
    var headers = getHeaders_(getEvalSheet_());
    return {
      candidateId: findHeaderIndex_(headers, EVAL_HEADER_ALIASES.candidateId),
      technical: findHeaderIndex_(headers, EVAL_HEADER_ALIASES.technical),
      leadership: findHeaderIndex_(headers, EVAL_HEADER_ALIASES.leadership),
      stakeholder: findHeaderIndex_(headers, EVAL_HEADER_ALIASES.stakeholder)
    };
  }

  function getSummaryHeaders_() {
    return getHeaders_(getSummarySheet_());
  }

  function getCell_(row, idx) {
    return idx >= 0 && idx < row.length ? row[idx] : '';
  }

  function buildSummaryRow_(headers, values) {
    return headers.map(function (header) {
      if (SUMMARY_HEADER_ALIASES.candidateId.indexOf(header) !== -1) return values.candidateId;
      if (SUMMARY_HEADER_ALIASES.name.indexOf(header) !== -1) return values.name;
      if (SUMMARY_HEADER_ALIASES.avgTechnical.indexOf(header) !== -1) return values.avgTechnical;
      if (SUMMARY_HEADER_ALIASES.avgLeadership.indexOf(header) !== -1) return values.avgLeadership;
      if (SUMMARY_HEADER_ALIASES.avgStakeholder.indexOf(header) !== -1) return values.avgStakeholder;
      if (SUMMARY_HEADER_ALIASES.finalScore.indexOf(header) !== -1) return values.finalScore;
      if (SUMMARY_HEADER_ALIASES.recommendation.indexOf(header) !== -1) return values.recommendation;
      if (SUMMARY_HEADER_ALIASES.lastUpdated.indexOf(header) !== -1) return values.lastUpdated;
      return '';
    });
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

    var cols = getEvalColumnMap_();
    var rows = evalSheet.getRange(2, 1, lastRow - 1, evalSheet.getLastColumn()).getValues();
    var relevant = rows.filter(function (r) { return String(getCell_(r, cols.candidateId)) === candidateId; });

    if (!relevant.length) return null;

    function col_(idx) {
      return relevant.map(function (r) { return Number(r[idx]); });
    }

    var avgTechnical   = avg_(col_(cols.technical));
    var avgLeadership  = avg_(col_(cols.leadership));
    var avgStakeholder = avg_(col_(cols.stakeholder));

    // Weighted final score
    var w = getWeights_();
    var total = w.technical + w.leadership + w.stakeholder;
    if (!isFinite(total) || total <= 0) {
      w = { technical: 1, leadership: 1, stakeholder: 1 };
      total = 3;
    }
    var finalScore = Math.round((
      (avgTechnical   * w.technical +
       avgLeadership  * w.leadership +
       avgStakeholder * w.stakeholder) / total
    ) * 100) / 100;

    return {
      avgTechnical: avgTechnical,
      avgLeadership: avgLeadership,
      avgStakeholder: avgStakeholder,
      finalScore: finalScore
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
    var summarySheet = getSummarySheet_();
    var headers = getSummaryHeaders_();
    var newRow = buildSummaryRow_(headers, {
      candidateId: candidateId,
      name: candidateName,
      avgTechnical: scores.avgTechnical,
      avgLeadership: scores.avgLeadership,
      avgStakeholder: scores.avgStakeholder,
      finalScore: scores.finalScore,
      recommendation: getRecommendation(scores.finalScore),
      lastUpdated: now
    });
    var lastRow = summarySheet.getLastRow();

    // Check for an existing row to update
    if (lastRow >= 2) {
      var existingRows = summarySheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
      var candidateIdIdx = findHeaderIndex_(headers, SUMMARY_HEADER_ALIASES.candidateId);
      for (var i = 0; i < existingRows.length; i++) {
        if (String(existingRows[i][candidateIdIdx]) === candidateId) {
          summarySheet.getRange(i + 2, 1, 1, headers.length).setValues([newRow]);
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
