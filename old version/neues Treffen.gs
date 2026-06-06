function createAndLinkForm() {
  const ss = SpreadsheetApp.getActive();
  const overview = ss.getSheetByName('Treffen-Übersicht');
  const lastRow = overview.getLastRow();

  const date = overview.getRange(lastRow, 1).getValue();
  const meetingName = 'Treffen_' + Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy_MM_dd');

  const token = '__token_' + Date.now() + '_' + Math.floor(Math.random()*10000);

  const form = FormApp.create('Treffen am ' + Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd'));
  form.addListItem().setTitle('Name').setRequired(true);
  form.addListItem().setTitle('Kann nicht hosten / Will hosten').setRequired(false)
      .setChoiceValues(['Kann nicht hosten','Will hosten']);

  // Hilfs-Textfeld mit Token (wird später entfernt)
  form.addTextItem().setTitle(token).setRequired(false);

  // Verknüpfen mit dieser Tabelle
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());

  // Speichern für das zweite Skript
  const props = PropertiesService.getScriptProperties();
  props.setProperties({
    lastFormToken: token,
    lastFormId: form.getId(),
    lastMeetingName: meetingName,
    lastRow: String(lastRow)
  });

  // Optional: Edit-URL in Übersicht schreiben (Spalte B)
  overview.getRange(lastRow, 2).setValue(form.getEditUrl());

  Logger.log('Form erstellt: ' + form.getId());
}

/**
 * Public wrapper to allow calls from a web-app (doGet) executed as the script owner.
 * Requires a script property `TARGET_SPREADSHEET_ID` to be set to the spreadsheet ID.
 * This function opens the spreadsheet by ID and performs the same actions as createAndLinkForm().
 */
/**
 * Helper: create form and link it into the given spreadsheet & overview row.
 * If `row` is provided, it will use that row (1-based). Otherwise it will append a new row.
 * `date` and `deadline` are Date objects.
 */
function createAndLinkFormForSpreadsheet(ss, date, deadline, row) {
  const overview = ss.getSheetByName('Treffen-Übersicht');
  if (!overview) throw new Error('Treffen-Übersicht nicht gefunden.');

  // If no row provided, append a new row and set date/deadline
  if (!row) {
    overview.appendRow([date, '', deadline, false, '']);
    row = overview.getLastRow();
  } else {
    // set date and deadline in given row
    overview.getRange(row, 1).setValue(date);
    overview.getRange(row, 3).setValue(deadline);
  }

  const meetingName = 'Treffen_' + Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy_MM_dd');
  const token = '__token_' + Date.now() + '_' + Math.floor(Math.random() * 10000);

  const form = FormApp.create('Treffen am ' + Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd'));
  form.addListItem().setTitle('Name').setRequired(true);
  form.addListItem().setTitle('Kann nicht hosten / Will hosten').setRequired(false)
    .setChoiceValues(['Kann nicht hosten', 'Will hosten']);
  form.addTextItem().setTitle(token).setRequired(false);
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());

  const props = PropertiesService.getScriptProperties();
  props.setProperties({
    lastFormToken: token,
    lastFormId: form.getId(),
    lastMeetingName: meetingName,
    lastRow: String(row)
  });

  overview.getRange(row, 2).setValue(form.getEditUrl());
  Logger.log('Form erstellt: ' + form.getId() + ' für Row ' + row);
  return { formId: form.getId(), editUrl: form.getEditUrl(), meetingName: meetingName, row: row };
}

/**
 * UI wrapper for the active spreadsheet: create a new Treffen row (or use provided) and create/link form.
 * Expects ISO date strings `dateIso` and `deadlineIso` (yyyy-mm-dd). Returns result object.
 */
function createAndLinkFormFromUI(dateIso, deadlineIso) {
  const ss = SpreadsheetApp.getActive();
  if (!dateIso) throw new Error('Datum fehlt');
  const date = new Date(dateIso);
  const deadline = deadlineIso ? new Date(deadlineIso) : new Date(date.getTime() - 3 * 24 * 3600 * 1000);
  return createAndLinkFormForSpreadsheet(ss, date, deadline, null);
}

/**
 * Public wrapper to allow calls from a web-app (doGet) executed as the script owner.
 * Requires a script property `TARGET_SPREADSHEET_ID` to be set to the spreadsheet ID.
 * Accepts optional `dateIso` and `deadlineIso` to create a new meeting row.
 */
function createAndLinkFormPublic(dateIso, deadlineIso) {
  const props = PropertiesService.getScriptProperties();
  const targetId = props.getProperty('TARGET_SPREADSHEET_ID');
  if (!targetId) {
    throw new Error('TARGET_SPREADSHEET_ID ist nicht gesetzt. Setze die Spreadsheet-ID in den Script-Properties.');
  }
  const ss = SpreadsheetApp.openById(targetId);
  if (dateIso) {
    const date = new Date(dateIso);
    const deadline = deadlineIso ? new Date(deadlineIso) : new Date(date.getTime() - 3 * 24 * 3600 * 1000);
    return createAndLinkFormForSpreadsheet(ss, date, deadline, null);
  }

  // If no dates provided, fallback to old behavior (use lastRow)
  const overview = ss.getSheetByName('Treffen-Übersicht');
  if (!overview) throw new Error('Treffen-Übersicht nicht gefunden in Spreadsheet ID ' + targetId);
  const lastRow = overview.getLastRow();
  const date = overview.getRange(lastRow, 1).getValue();
  const meetingName = 'Treffen_' + Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy_MM_dd');
  const token = '__token_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
  const form = FormApp.create('Treffen am ' + Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd'));
  form.addListItem().setTitle('Name').setRequired(true);
  form.addListItem().setTitle('Kann nicht hosten / Will hosten').setRequired(false)
    .setChoiceValues(['Kann nicht hosten', 'Will hosten']);
  form.addTextItem().setTitle(token).setRequired(false);
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());
  props.setProperties({
    lastFormToken: token,
    lastFormId: form.getId(),
    lastMeetingName: meetingName,
    lastRow: String(lastRow)
  });
  overview.getRange(lastRow, 2).setValue(form.getEditUrl());
  Logger.log('Form erstellt (public): ' + form.getId());
  return { formId: form.getId(), editUrl: form.getEditUrl(), meetingName: meetingName };
}

/**
 * Return open meetings (Freze != TRUE) with published form URLs.
 * If a script property `TARGET_SPREADSHEET_ID` is set, opens that spreadsheet;
 * otherwise uses the active spreadsheet. Returns array of {dateIso, dateDisplay, sheetName, publishedUrl}.
 */
function getOpenMeetingForms() {
  const props = PropertiesService.getScriptProperties();
  const targetId = props.getProperty('TARGET_SPREADSHEET_ID');
  let ss;
  if (targetId) {
    ss = SpreadsheetApp.openById(targetId);
  } else {
    ss = SpreadsheetApp.getActive();
  }
  const overview = ss.getSheetByName('Treffen-Übersicht');
  if (!overview) return [];
  const last = overview.getLastRow();
  if (last < 2) return [];
  const rows = overview.getRange(2,1,last-1,5).getValues();
  const results = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const date = row[0];
    const editLink = (row[1] || '').toString().trim();
    const freze = row[3];
    const sheetName = (row[4] || '').toString().trim();
    const frezeIsTrue = String(freze).toUpperCase() === 'TRUE';
    if (frezeIsTrue) continue;
    let publishedUrl = null;
    if (editLink) {
      // try to extract form id from edit link
      const m = editLink.match(/\/d\/([a-zA-Z0-9_-]+)/);
      if (m && m[1]) {
        try {
          const form = FormApp.openById(m[1]);
          publishedUrl = form.getPublishedUrl ? form.getPublishedUrl() : null;
        } catch (e) {
          try {
            // fallback: convert edit link to viewform by replacing /edit with /viewform
            publishedUrl = editLink.replace(/\/edit.*$/,'/viewform');
          } catch (e2) {
            publishedUrl = null;
          }
        }
      }
    }
    const dateIso = (date && date.toISOString) ? date.toISOString().substring(0,10) : '';
    const dateDisplay = (date && date.toLocaleDateString) ? date.toLocaleDateString() : '';
    results.push({ dateIso: dateIso, dateDisplay: dateDisplay, sheetName: sheetName, publishedUrl: publishedUrl });
  }
  return results;
}