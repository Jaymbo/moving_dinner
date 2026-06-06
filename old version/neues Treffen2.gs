function findAndRenameResponseSheet() {
  const ss = SpreadsheetApp.getActive();
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty('lastFormToken');
  const formId = props.getProperty('lastFormId');
  const meetingName = props.getProperty('lastMeetingName');
  const lastRow = Number(props.getProperty('lastRow')) || ss.getSheetByName('Treffen-Übersicht').getLastRow();
  const overview = ss.getSheetByName('Treffen-Übersicht');

  // 1) Versuchen: Token im Header finden
  const sheetByToken = findSheetByHeaderToken(ss, token);

  // 2) Fallback: Standard-Antwortblatt-Name (lokale Varianten)
  const sheetByDefaultName = findResponseSheetByDefaultName(ss, [/* optional: ignore IDs */]);

  // 3) letzter Fallback: neues Blatt per ID-Differenz (falls du vorher alte IDs gespeichert hast)
  // (Optional implementieren — hier direkt check token/default)
  const sh = sheetByToken || sheetByDefaultName;
  if (!sh) throw new Error('Antwortblatt nicht gefunden. Prüfe Logs/Properties.');

  // Vorbereiten
  try {
    sh.getRange('D1').setValue('Host/Gast');
    sh.setName(meetingName);
  } catch (e) {
    Logger.log('Fehler beim Vorbereiten: ' + e.message);
  }

  // Verschiebe das neue Treffen-Blatt an die richtige Position (nach allen Nicht-Treffen_ Blättern)
  try {
    moveSheetAfterNonTreffen(ss, sh);
  } catch (e) {
    Logger.log('Fehler beim Verschieben des neuen Blatts: ' + e.message);
  }

  // Übersicht befüllen entsprechend Struktur: A=Datum, B=Link, C=Deadline, D=Freze, E=Blattname
  let createdEditUrl = '';
  try {
    // Link (Spalte B) setzen, wenn möglich
    if (formId) {
      try {
        const form = FormApp.openById(formId);
        const editUrl = form.getEditUrl();
        overview.getRange(lastRow, 2).setValue(editUrl);
        createdEditUrl = editUrl;
      } catch (e) {
        Logger.log('Konnte Formular-Edit-URL nicht lesen: ' + e.message);
      }
    }
  } catch (e) {
    Logger.log('Fehler beim Setzen der Link-Spalte: ' + e.message);
  }

  try {
    // Blattname (Spalte E) mit dem tatsächlichen Tabellennamen speichern
    overview.getRange(lastRow, 5).setValue(sh.getName());
  } catch (e) {
    Logger.log('Konnte Blatt-Info nicht setzen: ' + e.message);
  }

  try {
    // Freze (Spalte D) setzen auf False
    overview.getRange(lastRow, 4).setValue('FALSE');
  } catch (e) {
    Logger.log('Konnte Freze nicht setzen: ' + e.message);
  }

  // Notify all contacts about the newly created meeting (centralized place)
  try {
    const meetingDate = overview.getRange(lastRow,1).getValue();
    if (typeof notifyAllNewMeeting === 'function') {
      try { notifyAllNewMeeting(meetingDate, createdEditUrl); } catch(e) { Logger.log('notifyAllNewMeeting failed: ' + e.message); }
    } else {
      Logger.log('notifyAllNewMeeting not found; skipping notification.');
    }
  } catch (e) {
    Logger.log('Fehler beim Aufruf von notifyAllNewMeeting: ' + e.message);
  }

  // Token-Item aus Formular entfernen (optional)
  try {
    const form = FormApp.openById(formId);
    const textItems = form.getItems(FormApp.ItemType.TEXT);
    for (let i = 0; i < textItems.length; i++) {
      if (textItems[i].getTitle() === token) {
        form.deleteItem(textItems[i]);
        break;
      }
    }
  } catch (e) {
    Logger.log('Token-Item konnte nicht entfernt werden: ' + e.message);
  }

  // Aufräumen
  props.deleteProperty('lastFormToken');
  props.deleteProperty('lastFormId');
  props.deleteProperty('lastMeetingName');
  props.deleteProperty('lastRow');

  Logger.log('Antwortblatt umbenannt und Übersicht aktualisiert: ' + meetingName);
}

/* -- Hilfsfunktionen (kopiere aus deinem existierenden Script oder verwende die hier) -- */

function findSheetByHeaderToken(ss, token) {
  if (!token) return null;
  const sheets = ss.getSheets();
  for (let i = 0; i < sheets.length; i++) {
    const sh = sheets[i];
    try {
      if (sh.getLastColumn() <= 0) continue;
      const headers = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0];
      if (headers && headers.indexOf(token) !== -1) return sh;
    } catch (e) { continue; }
  }
  return null;
}

/**
 * Verschiebt `sheet` so, dass es nach allen Blättern kommt, deren Name nicht mit "Treffen_" beginnt,
 * also an den Anfang der Gruppe aller "Treffen_"-Blätter.
 */
function moveSheetAfterNonTreffen(ss, sheet) {
  const sheets = ss.getSheets();
  let nonCount = 0;
  for (let i = 0; i < sheets.length; i++) {
    const name = sheets[i].getName();
    if (!/^Treffen_/.test(name)) nonCount++;
  }
  const targetPos = Math.min(nonCount + 1, sheets.length);
  try {
    ss.setActiveSheet(sheet);
    ss.moveActiveSheet(targetPos);
  } catch (e) {
    Logger.log('Fehler beim Verschieben des Blatts: ' + e.message);
  }
}

function findResponseSheetByDefaultName(ss) {
  const patterns = [/^Formularantworten\b/i, /^Form Responses\b/i, /^Formularantworten \d+/i, /^Form Responses \d+/i];
  const sheets = ss.getSheets();
  for (let i = 0; i < sheets.length; i++) {
    const name = sheets[i].getName();
    for (let p = 0; p < patterns.length; p++) {
      if (patterns[p].test(name)) return sheets[i];
    }
  }
  return null;
}

/**
 * Notify all contacts in `Stammdaten` that a new meeting exists.
 * This is a lightweight copy so notifications work even if `neues treffen.gs` was modified.
 */
function notifyAllNewMeeting(meetingDate, editUrl) {
  try {
    // helper to format date as DD.MM.YY
    function formatDateDDMMYY(d) {
      if (!d) return '';
      const date = (d instanceof Date) ? d : new Date(d);
      if (isNaN(date)) return '';
      const dd = String(date.getDate()).padStart(2, '0');
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const yy = String(date.getFullYear()).slice(-2);
      return dd + '.' + mm + '.' + yy;
    }

    const ss = SpreadsheetApp.getActive();
    const props = PropertiesService.getScriptProperties();
    const publicSite = props.getProperty('PUBLIC_WEBSITE_URL');
    const publishedUrl = editUrl ? editUrl.replace(/\/edit.*$/,'/viewform') : '';
    const link = publicSite || publishedUrl || editUrl || '';

    const stammdaten = ss.getSheetByName('Stammdaten');
    if (!stammdaten) { Logger.log('Stammdaten nicht gefunden; keine Benachrichtigung gesendet.'); return; }
    const last = stammdaten.getLastRow();
    if (last < 2) { Logger.log('Keine Kontakte in Stammdaten.'); return; }
    const rows = stammdaten.getRange(2,1,last-1,7).getValues();

    const dateText = formatDateDDMMYY(meetingDate);
    const subject = 'Neues Moving Dinner am ' + dateText;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const email = (row[5] || '').toString().trim(); // F
      const name = (row[1] || '').toString().trim(); // B
      if (!email) continue;
      const body = 'Hallo ' + (name || '') + ',\n\n' + 'Es wurde ein neues Moving Dinner erstellt für den ' + dateText + '.\nWeitere Informationen und Anmeldung: ' + link + '\n\nViele Grüße';
      try {
        MailApp.sendEmail(email, subject, body);
      } catch (e) {
        Logger.log('Fehler beim Senden der New-Meeting-Mail an ' + email + ': ' + e.message);
      }
    }
    Logger.log('Benachrichtigungen für neues Treffen versendet.');
  } catch (e) {
    Logger.log('notifyAllNewMeeting Fehler: ' + e.message);
  }
}