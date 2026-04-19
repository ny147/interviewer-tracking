'use strict';
/**
 * apps-script-harness.cjs
 *
 * A lightweight, VM-based harness that emulates the Google Apps Script
 * runtime for unit tests.  It provides in-memory mocks of the GAS global
 * objects most commonly used by this project:
 *   - SpreadsheetApp  (getActiveSpreadsheet → Spreadsheet → Sheet)
 *   - Session         (getActiveUser → {getEmail})
 *   - PropertiesService (getScriptProperties → {getProperty, setProperty})
 *   - Utilities       (getUuid, formatDate)
 *   - Logger          (log)
 *
 * Usage:
 *   const { buildSandbox } = require('./apps-script-harness.cjs');
 *   const { sandbox, sheets } = buildSandbox({
 *     scriptProperties: { GOOGLE_SHEET_ID: 'test-id', ADMIN_EMAILS: 'a@b.com' },
 *     userEmail: 'interviewer@example.com',
 *     sheetData: {
 *       Interviewers: [['Email','Name','Role','Active'], ['interviewer@example.com','Alice','interviewer','TRUE']],
 *       Candidates:   [['ID','Name','Position','Level','Status','CreatedAt','CreatedBy']],
 *     }
 *   });
 *   // Then load source files into the sandbox with loadFile(sandbox, filePath).
 */

const vm = require('vm');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ──────────────────────────────────────────────────────────────────────────────
// Sheet mock
// ──────────────────────────────────────────────────────────────────────────────

function buildSheetMock(data) {
  // data is a 2-D array; first row is headers.
  let rows = data ? data.map(r => [...r]) : [];

  return {
    _rows: rows,
    getName() { return ''; },
    getLastRow() { return rows.length; },
    getLastColumn() { return rows.length > 0 ? rows[0].length : 0; },
    getRange(row, col, numRows, numCols) {
      // row/col are 1-based
      const getValues = () => {
        const result = [];
        for (let r = row - 1; r < row - 1 + (numRows || 1); r++) {
          const rowData = [];
          for (let c = col - 1; c < col - 1 + (numCols || 1); c++) {
            rowData.push((rows[r] && rows[r][c] !== undefined) ? rows[r][c] : '');
          }
          result.push(rowData);
        }
        return result;
      };
      const setValues = (vals) => {
        for (let r = 0; r < vals.length; r++) {
          const rowIdx = row - 1 + r;
          while (rows.length <= rowIdx) rows.push([]);
          for (let c = 0; c < vals[r].length; c++) {
            const colIdx = col - 1 + c;
            while (rows[rowIdx].length <= colIdx) rows[rowIdx].push('');
            rows[rowIdx][colIdx] = vals[r][c];
          }
        }
      };
      return { getValues, setValues };
    },
    appendRow(rowArray) {
      rows.push([...rowArray]);
    },
    deleteRow(rowNum) {
      rows.splice(rowNum - 1, 1);
    }
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Spreadsheet mock
// ──────────────────────────────────────────────────────────────────────────────

function buildSpreadsheetMock(sheetData) {
  const sheetMocks = {};
  for (const [name, data] of Object.entries(sheetData || {})) {
    const mock = buildSheetMock(data);
    mock.getName = () => name;
    sheetMocks[name] = mock;
  }

  return {
    _sheets: sheetMocks,
    getSheetByName(name) {
      if (!sheetMocks[name]) {
        // auto-create
        const mock = buildSheetMock([]);
        mock.getName = () => name;
        sheetMocks[name] = mock;
      }
      return sheetMocks[name];
    }
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// GAS global mocks
// ──────────────────────────────────────────────────────────────────────────────

function buildGlobals({ scriptProperties, userEmail, sheetData }) {
  const spreadsheet = buildSpreadsheetMock(sheetData);

  const SpreadsheetApp = {
    getActiveSpreadsheet() { return spreadsheet; },
    openById(_id) { return spreadsheet; }
  };

  const props = { ...(scriptProperties || {}) };
  const PropertiesService = {
    getScriptProperties() {
      return {
        getProperty(key) { return props[key] !== undefined ? props[key] : null; },
        setProperty(key, val) { props[key] = val; }
      };
    }
  };

  const Session = {
    getActiveUser() {
      return { getEmail() { return userEmail || ''; } };
    }
  };

  const Utilities = {
    getUuid() { return crypto.randomUUID(); },
    formatDate(date, _tz, fmt) {
      // very simple ISO-like format
      return date instanceof Date ? date.toISOString() : String(date);
    }
  };

  const Logger = {
    _logs: [],
    log(msg) { this._logs.push(msg); }
  };

  return { SpreadsheetApp, PropertiesService, Session, Utilities, Logger, spreadsheet };
}

// ──────────────────────────────────────────────────────────────────────────────
// Sandbox builder
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Builds a vm.Context with GAS globals pre-populated.
 * Returns { sandbox, sheets } where sheets is a map name→sheetMock.
 */
function buildSandbox(options = {}) {
  const globals = buildGlobals(options);
  const sandbox = vm.createContext({
    ...globals,
    console,   // handy for debugging inside source files
    Date,
    Math,
    JSON,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    encodeURIComponent,
    decodeURIComponent,
    Object,
    Array,
    String,
    Number,
    Boolean,
    RegExp,
    Error,
    TypeError,
    undefined: undefined
  });

  return { sandbox, sheets: globals.spreadsheet._sheets };
}

/**
 * Loads a GAS source file into the sandbox so its top-level declarations
 * become available as sandbox globals.
 * @param {vm.Context} sandbox
 * @param {string} filePath  — absolute path to the .js file
 */
function loadFile(sandbox, filePath) {
  const code = fs.readFileSync(filePath, 'utf8');
  vm.runInContext(code, sandbox, { filename: path.basename(filePath) });
}

module.exports = { buildSandbox, loadFile };
