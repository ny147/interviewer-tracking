/**
 * Config.js — Centralised configuration reader.
 *
 * Credentials are stored in Script Properties (set once by an admin via
 * the Apps Script UI: File → Project properties → Script properties).
 * This keeps secrets out of source code and out of version control.
 *
 * Script Property keys mirror the .env keys:
 *   GOOGLE_SHEET_ID   — Spreadsheet ID
 *   ADMIN_EMAILS      — comma-separated admin addresses
 */

/* global PropertiesService */

var Config = (function () {
  /**
   * Returns a Script Property value, throwing if the key is missing.
   * @param {string} key
   * @returns {string}
   */
  function require_(key) {
    var value = PropertiesService.getScriptProperties().getProperty(key);
    if (!value) {
      throw new Error('Missing Script Property: ' + key);
    }
    return value;
  }

  /**
   * Returns the Google Spreadsheet ID used as the database.
   * @returns {string}
   */
  function getSheetId() {
    return require_('GOOGLE_SHEET_ID');
  }

  /**
   * Returns the list of admin email addresses.
   * @returns {string[]}
   */
  function getAdminEmails() {
    var raw = PropertiesService.getScriptProperties().getProperty('ADMIN_EMAILS') || '';
    return raw.split(',').map(function (e) { return e.trim().toLowerCase(); }).filter(Boolean);
  }

  return {
    getSheetId: getSheetId,
    getAdminEmails: getAdminEmails
  };
})();
