/**
 * AuditLog.js — Records audit events to the AuditLog sheet.
 *
 * Sheet columns (0-based):
 *   0 Timestamp | 1 UserEmail | 2 Action | 3 EntityType | 4 EntityID | 5 Detail
 *
 * Action constants (not enforced, but used by convention):
 *   CANDIDATE_CREATED | EVAL_SUBMITTED | EVAL_UPDATED | STATUS_CHANGED
 */

/* global SpreadsheetApp, Utilities, Config */

var AuditLog = (function () {

  var HEADERS = ['Timestamp', 'UserEmail', 'Action', 'EntityType', 'EntityID', 'Detail'];
  var COL = { TIMESTAMP: 0, USER_EMAIL: 1, ACTION: 2, ENTITY_TYPE: 3, ENTITY_ID: 4, DETAIL: 5 };

  function getSheet_() {
    var spreadsheet = SpreadsheetApp.openById(Config.getSheetId());
    var sheet = spreadsheet.getSheetByName('AuditLog');

    if (!sheet) {
      sheet = spreadsheet.insertSheet('AuditLog');
    }

    if (sheet.getLastRow() < 1) {
      sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    }

    return sheet;
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Appends an audit event row to the AuditLog sheet.
   * @param {string} userEmail   — the acting user
   * @param {string} action      — e.g. 'CANDIDATE_CREATED'
   * @param {string} entityType  — e.g. 'Candidate'
   * @param {string} entityId    — the ID of the affected entity (or '')
   * @param {string} detail      — human-readable detail (or '')
   */
  function logEvent(userEmail, action, entityType, entityId, detail) {
    var now = Utilities.formatDate(new Date(), 'UTC', 'yyyy-MM-dd HH:mm:ss');
    getSheet_().appendRow([
      now,
      userEmail  || '',
      action     || '',
      entityType || '',
      entityId   || '',
      detail     || ''
    ]);
  }

  /**
   * Returns all audit log entries as objects, newest first.
   * @returns {object[]}
   */
  function getAuditLogs() {
    var sheet = getSheet_();
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];
    var rows = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
    return rows.map(function (r) {
      return {
        timestamp:  String(r[COL.TIMESTAMP]),
        userEmail:  String(r[COL.USER_EMAIL]),
        action:     String(r[COL.ACTION]),
        entityType: String(r[COL.ENTITY_TYPE]),
        entityId:   String(r[COL.ENTITY_ID]),
        detail:     String(r[COL.DETAIL])
      };
    }).reverse();
  }

  return {
    logEvent:     logEvent,
    getAuditLogs: getAuditLogs
  };
})();
