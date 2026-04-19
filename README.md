# Interviewer Tracking

Candidate evaluation system built with Google Apps Script, Google Sheets, and HTML Service.

The app supports:

- Candidate tracking
- Interviewer access control
- Per-candidate evaluations
- Weighted summary scoring
- Admin management
- Audit logs

The current scoring schema uses three categories:

- Technical
- Leadership
- Stakeholder

## Prerequisites

Before setting up the project, make sure you have:

- Node.js 18 or newer
- npm
- A Google account with access to Google Sheets and Google Apps Script
- `clasp` access through your Google account

## Step 1: Install Dependencies

From the project root, install dependencies:

```bash
npm install
```

## Step 2: Sign In To `clasp`

If you have not used `clasp` on your machine before, sign in first:

```bash
npx clasp login
```

You can verify it is available with:

```bash
npx clasp --version
```

## Step 3: Create The Google Sheet

Create a new Google Spreadsheet. This spreadsheet will act as the app database.

Copy the spreadsheet ID from the URL:

```text
https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit
```

## Step 4: Create The Apps Script Project

Create a standalone Google Apps Script project.

Copy the script ID from the project settings in the Apps Script editor.

## Step 5: Create Your `.env` File

Copy the template:

Windows Command Prompt:

```bat
copy .env.example .env
```

PowerShell:

```powershell
Copy-Item .env.example .env
```

macOS / Linux / Git Bash:

```bash
cp .env.example .env
```

Then fill in the values in `.env`:

```env
GOOGLE_SHEET_ID=your_google_spreadsheet_id_here
GOOGLE_SCRIPT_ID=your_apps_script_project_id_here
ADMIN_EMAILS=admin@example.com,owner@example.com
WEB_APP_URL=
GCP_PROJECT_NUMBER=
```

Notes:

- `GOOGLE_SHEET_ID` is required.
- `GOOGLE_SCRIPT_ID` is required.
- `ADMIN_EMAILS` is required.
- `WEB_APP_URL` is optional.
- `GCP_PROJECT_NUMBER` is optional.

Do not commit `.env`.

## Step 6: Generate `.clasp.json`

This project generates `.clasp.json` from the values in `.env`.

Run:

```bash
npm run setup:clasp
```

This creates a `.clasp.json` file that points `clasp` at the correct Apps Script project and uses `src/` as the root directory.

## Step 7: Push Script Properties

The app reads configuration from Apps Script Script Properties, not directly from `.env` in production.

Generate the temporary bootstrap file:

```bash
npm run set-properties
```

Push it to Apps Script:

```bash
npx clasp push
```

Then in the Apps Script editor:

1. Open the script project.
2. Choose the function `setScriptProperties`.
3. Click `Run`.
4. Approve permissions if prompted.

After that, remove the temporary bootstrap file and push again:

```bash
npm run clean-properties
npx clasp push
```

## Step 8: Create The Spreadsheet Schema

The project includes a `setupSchema()` function that creates or initializes the required sheets.

In the Apps Script editor:

1. Choose the function `setupSchema`.
2. Click `Run`.
3. Approve permissions if prompted.

This creates the required sheets:

- `Candidates`
- `Interviewers`
- `Evaluations`
- `Summary`
- `AuditLog`

It also writes headers, sets formatting, and seeds the first admin interviewer when possible.

## Step 9: Run Tests Locally

Run the automated test suite before deploying:

```bash
npm test
```

Watch mode is also available:

```bash
npm run test:watch
```

## Step 10: Push The Project

To upload the current source to Apps Script:

```bash
npm run push
```

This is equivalent to:

```bash
npx clasp push
```

## Step 11: Deploy The Web App

Create a deployment:

```bash
npm run deploy
```

Or push and deploy in one step:

```bash
npm run deploy:all
```

In the Apps Script deployment flow, use the web app settings that match the manifest and your security requirements.

The manifest currently uses:

- Execute as: `USER_ACCESSING`
- Web app access: `ANYONE`

After deployment, copy the web app URL.

## Step 12: Open The App

Open the deployed web app URL in your browser.

Log in with an admin email first so you can:

- Verify access works
- Add or deactivate interviewers
- Configure score weights
- Review audit logs

## Daily Development Workflow

Typical local workflow:

1. Make code changes.
2. Run `npm test`.
3. Push changes with `npm run push`.
4. If the deployed app should reflect the changes immediately, create a new deployment with `npm run deploy`.

For faster iteration while developing:

```bash
npm run watch
```

## Available Scripts

| Command | Purpose |
|---|---|
| `npm test` | Run all tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run setup:clasp` | Generate `.clasp.json` from `.env` |
| `npm run set-properties` | Generate temporary Apps Script property bootstrap file |
| `npm run clean-properties` | Remove the bootstrap file after properties are set |
| `npm run push` | Push `src/` to Apps Script |
| `npm run setup:schema` | Push and remind you to run `setupSchema` |
| `npm run deploy` | Create a deployment |
| `npm run deploy:all` | Push and deploy in one command |
| `npm run watch` | Push changes continuously |

## Project Structure

```text
src/
  appsscript.json
  AuditLog.js
  Auth.js
  Candidates.js
  Code.js
  Config.js
  Evaluations.js
  Setup.js
  Summary.js
  html/
    admin.html
    candidates.html
    evaluation.html
    report.html
    summary.html
tests/
scripts/
```

## Troubleshooting

### `GOOGLE_SCRIPT_ID is not set in .env`

Make sure `.env` exists and contains a valid `GOOGLE_SCRIPT_ID`.

### `GOOGLE_SHEET_ID` or `ADMIN_EMAILS` missing

These values are required for `npm run set-properties`.

### `clasp push` fails

Check:

- You are logged in with `npx clasp login`
- `.clasp.json` points to the correct Apps Script project
- The script project still exists and you have permission to edit it

### Access denied in the web app

Check:

- Your email is listed in `ADMIN_EMAILS`, or
- Your email exists in the `Interviewers` sheet with `Active = TRUE`

### Existing spreadsheet still shows old score columns

The application supports legacy evaluation headers for compatibility, but `setupSchema()` now defines the three-score model:

- Technical
- Leadership
- Stakeholder

If you want the spreadsheet itself to exactly match the latest schema, update the existing sheet headers or rebuild the sheets in a clean spreadsheet.

## Recommended First Run Checklist

1. Install dependencies.
2. Log into `clasp`.
3. Fill `.env`.
4. Run `npm run setup:clasp`.
5. Run `npm run set-properties`.
6. Run `npx clasp push`.
7. Run `setScriptProperties` in the Apps Script editor.
8. Run `npm run clean-properties`.
9. Run `npx clasp push` again.
10. Run `setupSchema` in Apps Script.
11. Run `npm test`.
12. Run `npm run deploy`.
