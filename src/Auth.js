/**
 * Auth.js — Authentication and authorisation helpers.
 *
 * Checks whether the current (or supplied) email is allowed to use the system.
 * Two tiers:
 *   1. Admin — email present in the ADMIN_EMAILS Script Property.
 *   2. Interviewer — email present in the Interviewers sheet with Active = TRUE.
 */

/* global Session, SpreadsheetApp, Config */

var Auth = (function () {

  /**
   * Returns the email of the currently signed-in Google user.
   * @returns {string}
   */
  function getCurrentUserEmail() {
    return Session.getActiveUser().getEmail();
  }

  /**
   * Returns true if email matches an entry in ADMIN_EMAILS (case-insensitive).
   * @param {string} email
   * @returns {boolean}
   */
  function isAdmin(email) {
    var normalised = (email || '').toLowerCase().trim();
    return Config.getAdminEmails().indexOf(normalised) !== -1;
  }

  /**
   * Returns true if email is an admin OR an active interviewer in the sheet.
   * @param {string} email
   * @returns {boolean}
   */
  function isAuthorised(email) {
    if (isAdmin(email)) return true;

    var ss = SpreadsheetApp.openById(Config.getSheetId());
    var sheet = ss.getSheetByName('Interviewers');
    if (!sheet) return false;
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return false;

    // Headers in row 1: Email, Name, Role, Active
    var data = sheet.getRange(2, 1, lastRow - 1, 4).getValues();
    var normalised = (email || '').toLowerCase().trim();

    for (var i = 0; i < data.length; i++) {
      var rowEmail = String(data[i][0]).toLowerCase().trim();
      var active   = String(data[i][3]).toUpperCase().trim();
      if (rowEmail === normalised && active === 'TRUE') {
        return true;
      }
    }
    return false;
  }

  /**
   * Throws an Error if the user is not authorised.
   * @param {string} email
   */
  function requireAuthorised(email) {
    if (!isAuthorised(email)) {
      throw new Error('User ' + email + ' is not authorised to access this system.');
    }
  }

  return {
    getCurrentUserEmail: getCurrentUserEmail,
    isAdmin: isAdmin,
    isAuthorised: isAuthorised,
    requireAuthorised: requireAuthorised
  };
})();
