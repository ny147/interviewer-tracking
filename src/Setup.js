/**
 * Setup.js — One-shot Google Sheets schema initialisation.
 *
 * Run from the Apps Script editor ONCE after creating a new Spreadsheet:
 *   Editor → Run → setupSchema
 *
 * What it does:
 *   • Creates the four required sheets (Candidates, Interviewers,
 *     Evaluations, Summary) if they do not already exist.
 *   • Removes the default "Sheet1" created by Google.
 *   • Writes header rows on each sheet.
 *   • Freezes the header row.
 *   • Bolds and backgrounds the header row.
 *   • Adds data-validation drop-downs where applicable.
 *   • Sets sensible column widths.
 *
 * Re-running is safe — existing data rows are never touched.
 */

/* global SpreadsheetApp, SpreadsheetApp, Config, Logger */

function setupSchema() {
  var ss = SpreadsheetApp.openById(Config.getSheetId());

  // ── 1. Define sheets ───────────────────────────────────────────────────────
  var SHEETS = [
    {
      name: 'Candidates',
      headers: ['ID', 'Name', 'Position', 'Level', 'Status', 'CreatedAt', 'CreatedBy'],
      widths:  [220,  200,    220,         80,      90,       160,         220],
      validations: [
        // column index (0-based), allowed values
        { col: 3, values: ['Junior', 'Mid', 'Senior', 'Staff', 'Principal'] },
        { col: 4, values: ['Active', 'Hired', 'Rejected', 'On Hold'] }
      ]
    },
    {
      name: 'Interviewers',
      headers: ['Email', 'Name', 'Role', 'Active'],
      widths:  [260,     200,    130,    70],
      validations: [
        { col: 2, values: ['interviewer', 'hiring-manager', 'admin'] },
        { col: 3, values: ['TRUE', 'FALSE'] }
      ]
    },
    {
      name: 'Evaluations',
      headers: [
        'ID', 'CandidateID', 'InterviewerEmail',
        'TechnicalSkills', 'ProblemSolving', 'Communication',
        'SystemDesign', 'CultureFit', 'Notes', 'SubmittedAt'
      ],
      widths: [220, 220, 240, 110, 110, 110, 110, 90, 300, 160],
      validations: []
    },
    {
      name: 'Summary',
      headers: [
        'CandidateID', 'Name',
        'AvgTechnical', 'AvgProblemSolving', 'AvgCommunication',
        'AvgSystemDesign', 'AvgCultureFit',
        'FinalScore', 'Recommendation', 'LastUpdated'
      ],
      widths: [220, 200, 100, 130, 120, 110, 90, 90, 130, 160],
      validations: []
    },
    {
      name: 'AuditLog',
      headers: ['Timestamp', 'UserEmail', 'Action', 'EntityType', 'EntityID', 'Detail'],
      widths:  [160,          240,         160,      100,          220,        400],
      validations: []
    }
  ];

  // ── 2. Ensure each sheet exists and has correct headers ────────────────────
  SHEETS.forEach(function (def) {
    var sheet = ss.getSheetByName(def.name);

    if (!sheet) {
      sheet = ss.insertSheet(def.name);
      Logger.log('Created sheet: ' + def.name);
    } else {
      Logger.log('Sheet already exists: ' + def.name);
    }

    // Write headers only if row 1 is empty
    var firstCell = sheet.getRange(1, 1).getValue();
    if (!firstCell) {
      sheet.getRange(1, 1, 1, def.headers.length).setValues([def.headers]);
      Logger.log('  → Headers written');
    } else {
      Logger.log('  → Headers already present, skipping');
    }

    // Freeze header row
    sheet.setFrozenRows(1);

    // Bold + background the header row
    var headerRange = sheet.getRange(1, 1, 1, def.headers.length);
    headerRange
      .setFontWeight('bold')
      .setBackground('#1a73e8')
      .setFontColor('#ffffff');

    // Column widths
    def.widths.forEach(function (width, i) {
      sheet.setColumnWidth(i + 1, width);
    });

    // Data validation drop-downs
    def.validations.forEach(function (v) {
      var rule = SpreadsheetApp.newDataValidation()
        .requireValueInList(v.values, true)
        .setAllowInvalid(false)
        .build();
      // Apply to the entire column (rows 2 onward), up to row 1000
      sheet.getRange(2, v.col + 1, 999, 1).setDataValidation(rule);
    });
  });

  // ── 3. Remove the default "Sheet1" if it is empty ─────────────────────────
  var defaultSheet = ss.getSheetByName('Sheet1');
  if (defaultSheet && defaultSheet.getLastRow() === 0) {
    ss.deleteSheet(defaultSheet);
    Logger.log('Removed empty Sheet1');
  }

  // ── 4. Seed the Interviewers sheet with the first admin if it is empty ─────
  var interviewersSheet = ss.getSheetByName('Interviewers');
  if (interviewersSheet && interviewersSheet.getLastRow() < 2) {
    var adminEmails = Config.getAdminEmails();
    if (adminEmails.length) {
      interviewersSheet.appendRow([adminEmails[0], 'Admin', 'admin', 'TRUE']);
      Logger.log('Seeded Interviewers with: ' + adminEmails[0]);
    }
  }

  Logger.log('setupSchema complete.');
  SpreadsheetApp.getUi().alert('Schema setup complete!\n\nSheets created: Candidates, Interviewers, Evaluations, Summary, AuditLog.');
}
