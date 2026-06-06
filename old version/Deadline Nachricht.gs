/**
 * Täglicher Aufruf: schickt eine Erinnerung einen Tag vor der Deadline
 * für alle Einträge in `Treffen-Übersicht`, bei denen Spalte D (Freze)
 * nicht TRUE ist und jetzt zwischen (Deadline - 1 Tag) und Deadline liegt.
 * Empfänger: alle Kontakte aus `Stammdaten`, die sich noch nicht im
 * Antwortblatt (Blattname in Übersicht Spalte E) eingetragen haben.
 *
 * Hinweis: einen zeitbasierten Trigger mit `createDailyReminderTrigger()`
 * einmal manuell anlegen (oder über Apps Script > Triggers). Dadurch läuft
 * die Funktion automatisch einmal pro Tag.
 */
function sendPreDeadlineRemindersDaily() {
  const ss = SpreadsheetApp.getActive();
  const overview = ss.getSheetByName('Treffen-Übersicht');
  const stammdaten = ss.getSheetByName('Stammdaten');
  if (!overview) { Logger.log('Treffen-Übersicht nicht gefunden.'); return; }
  if (!stammdaten) { Logger.log('Stammdaten nicht gefunden.'); return; }

  // Load Stammdaten: expect at least columns B=Name, F=Email; keep display name
  const sdLast = stammdaten.getLastRow();
  const sdValues = sdLast > 1 ? stammdaten.getRange(2,1,sdLast-1,7).getValues() : [];
  const nameToContact = {};
  for (let i = 0; i < sdValues.length; i++) {
    const row = sdValues[i];
    const name = (row[1] || '').toString().trim(); // B
    const email = (row[5] || '').toString().trim(); // F
    if (name) nameToContact[normalize(name)] = { displayName: name, email: email };
  }

  const now = new Date();
  const lastRow = overview.getLastRow();
  if (lastRow < 2) { Logger.log('Keine Einträge in Treffen-Übersicht.'); return; }

  for (let r = 2; r <= lastRow; r++) {
    try {
      const meetingDate = overview.getRange(r,1).getValue(); // A
      const meetingLink = (overview.getRange(r,2).getValue() || '').toString().trim(); // B
      const deadline = overview.getRange(r,3).getValue(); // C
      const freze = overview.getRange(r,4).getValue(); // D
      const sheetName = (overview.getRange(r,5).getValue() || '').toString().trim(); // E

      if (!deadline || !(deadline instanceof Date)) continue;
      const frezeIsTrue = String(freze).toUpperCase() === 'TRUE';
      if (frezeIsTrue) continue; // already processed/frozen

      // We want now in [deadline - 1 day, deadline)
      const oneDayBefore = new Date(deadline.getTime() - 24 * 60 * 60 * 1000);
      if (now < oneDayBefore || now >= deadline) continue; // not in reminder window

      if (!sheetName) {
        Logger.log('Zeile ' + r + ': Blattname fehlt, überspringe Erinnerung.');
        continue;
      }

      const resp = ss.getSheetByName(sheetName);
      if (!resp) { Logger.log('Antwortblatt ' + sheetName + ' nicht gefunden, überspringe.'); continue; }

      // Find Name column index from headers (row 1)
      const lastCol = Math.max(3, resp.getLastColumn());
      const headers = resp.getRange(1,1,1,lastCol).getValues()[0].map(h => (h||'').toString().trim());
      const nameIdx = headers.findIndex(h => /name/i.test(h));
      if (nameIdx === -1) { Logger.log('Sheet ' + sheetName + ': Name-Spalte nicht gefunden.'); continue; }

      // Read responses to build set of registered normalized names
      const respLast = resp.getLastRow();
      const respData = respLast > 1 ? resp.getRange(2,1,respLast-1,lastCol).getValues() : [];
      const registered = new Set();
      for (let i = 0; i < respData.length; i++) {
        const row = respData[i];
        const pname = (row[nameIdx] || '').toString().trim();
        if (pname) registered.add(normalize(pname));
      }

      // For every contact in Stammdaten not registered, send reminder
      const meetingDateStr = meetingDate ? Utilities.formatDate(meetingDate, Session.getScriptTimeZone(), 'dd.MM.yy') : '';
      for (const key in nameToContact) {
        if (!key) continue;
        if (registered.has(key)) continue; // already registered
        const contact = nameToContact[key];
        if (!contact || !contact.email) continue; // skip lacking email

        const subject = 'Erinnerung: Anmeldung für Moving Dinner am ' + meetingDateStr;
        const display = contact.displayName || contact.email;
        let body = 'Hallo ' + display + ',\n\n';
        body += 'Die Anmeldung für das Moving Dinner am ' + meetingDateStr + ' endet bald (Deadline: ' + Utilities.formatDate(deadline, Session.getScriptTimeZone(), 'dd.MM.yy HH:mm') + ').\n';
        body += 'Möchtest du dich noch anmelden? Falls ja, trage dich bitte über folgenden Link ein:\n' + (meetingLink || '') + '\n\n';
        body += 'Viele Grüße,\nJason';

        try {
          MailApp.sendEmail(contact.email, subject, body);
          Logger.log('Reminder gesendet an ' + contact.email + ' für Treffen ' + sheetName);
        } catch (e) {
          Logger.log('Fehler beim Senden Reminder an ' + contact.email + ': ' + e.message);
        }
      }

    } catch (e) {
      Logger.log('Fehler in Übersicht-Zeile ' + r + ': ' + e.message);
    }
  }
}
