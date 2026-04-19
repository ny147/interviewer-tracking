/**
 * Candidates.js — CRUD operations for the Candidates sheet.
 *
 * Sheet columns (1-based):
 *   1 ID | 2 Name | 3 Position | 4 Level | 5 Status | 6 CreatedAt | 7 CreatedBy
 */

/* global SpreadsheetApp, Utilities, Config */

var Candidates = (function () {

  var HEADERS = ['ID', 'Name', 'Position', 'Level', 'Status', 'CreatedAt', 'CreatedBy'];
  var COL = { ID: 0, NAME: 1, POSITION: 2, LEVEL: 3, STATUS: 4, CREATED_AT: 5, CREATED_BY: 6 };

  function getSheet_() {
    return SpreadsheetApp.openById(Config.getSheetId()).getSheetByName('Candidates');
  }

  /** Convert a raw row array into a plain candidate object. */
  function rowToObject_(row) {
    return {
      id:         String(row[COL.ID]),
      name:       String(row[COL.NAME]),
      position:   String(row[COL.POSITION]),
      level:      String(row[COL.LEVEL]),
      status:     String(row[COL.STATUS]),
      createdAt:  String(row[COL.CREATED_AT]),
      createdBy:  String(row[COL.CREATED_BY])
    };
  }

  /** Returns all data rows (skipping header). */
  function getAllRows_() {
    var sheet = getSheet_();
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];
    return sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Adds a new candidate to the sheet.
   * @param {{ name: string, position: string, level: string }} input
   * @param {string} createdByEmail
   * @returns {object} candidate object
   */
  function addCandidate(input, createdByEmail) {
    if (!input.name || !input.name.trim()) {
      throw new Error('Candidate name is required.');
    }

    var id = Utilities.getUuid();
    var now = Utilities.formatDate(new Date(), 'UTC', 'yyyy-MM-dd HH:mm:ss');

    var row = [
      id,
      input.name.trim(),
      (input.position || '').trim(),
      (input.level || '').trim(),
      'Active',
      now,
      createdByEmail
    ];

    getSheet_().appendRow(row);

    return rowToObject_(row);
  }

  /**
   * Returns all candidates as an array of objects.
   * @returns {object[]}
   */
  function getAllCandidates() {
    return getAllRows_().map(rowToObject_);
  }

  /**
   * Returns the candidate matching the given id, or null.
   * @param {string} id
   * @returns {object|null}
   */
  function getCandidateById(id) {
    var rows = getAllRows_();
    for (var i = 0; i < rows.length; i++) {
      if (String(rows[i][COL.ID]) === id) {
        return rowToObject_(rows[i]);
      }
    }
    return null;
  }

  /**
   * Updates the Status column for the given candidate id.
   * @param {string} id
   * @param {string} status  e.g. 'Active' | 'Hired' | 'Rejected'
   */
  function updateCandidateStatus(id, status) {
    var sheet = getSheet_();
    var rows = getAllRows_();
    for (var i = 0; i < rows.length; i++) {
      if (String(rows[i][COL.ID]) === id) {
        // row index in sheet = i + 2 (1-based + header offset)
        sheet.getRange(i + 2, COL.STATUS + 1, 1, 1).setValues([[status]]);
        return;
      }
    }
    throw new Error('Candidate not found: ' + id);
  }

  return {
    addCandidate: addCandidate,
    getAllCandidates: getAllCandidates,
    getCandidateById: getCandidateById,
    updateCandidateStatus: updateCandidateStatus
  };
})();
