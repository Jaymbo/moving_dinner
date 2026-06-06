/**
 * Prüft in `Treffen-Übersicht` Deadlines und versendet nach Ablauf E-Mails an Teilnehmer.
 * - Übersicht: A=Datum, B=Link, C=Deadline, D=Freze, E=Blattname
 * - Stammdaten: B=Name, C=Adresse, F=Email
 * Für jede Zeile mit Deadline <= now und Freze != TRUE: liest das Antwortblatt,
 * liest aus spalte D wer host und wer Gast ist 
 * schreibt Emails aus `Stammdaten` und
 * sendet personalisierte Benachrichtigungen. Anschließend setzt es Freze=TRUE.
 */
function notifyAfterDeadline() {
  const ss = SpreadsheetApp.getActive();
  const overview = ss.getSheetByName('Treffen-Übersicht');
  const stammdaten = ss.getSheetByName('Stammdaten');
  if (!overview) { Logger.log('Treffen-Übersicht nicht gefunden. Abbruch.'); return; }
  if (!stammdaten) { Logger.log('Stammdaten nicht gefunden. Abbruch.'); return; }

  // Load Stammdaten into map: name -> {email, address}
  const sdLast = stammdaten.getLastRow();
  // Read one more column (G) to include 'essensgewohnheit'
  const sdValues = sdLast > 1 ? stammdaten.getRange(2,1,sdLast-1,7).getValues() : [];
  const nameToContact = {};
  for (let i = 0; i < sdValues.length; i++) {
    const row = sdValues[i];
    const name = (row[1] || '').toString().trim(); // B
    const address = (row[2] || '').toString().trim(); // C
    const notes = (row[4] || '').toString().trim(); // E (optional notes in Stammdaten)
    const email = (row[5] || '').toString().trim(); // F
    const diet = (row[6] || '').toString().trim(); // G (essensgewohnheit)
    if (name) nameToContact[normalize(name)] = { email: email, address: address, notes: notes, diet: diet };
  }

  // Helper: robust contact lookup by name: exact normalized, then substring matches
  function findContactByName(rawName) {
    if (!rawName) return null;
    const n = normalize(rawName);
    if (nameToContact[n]) return nameToContact[n];
    // try fuzzy contains (either direction)
    for (const key in nameToContact) {
      if (!key) continue;
      if (key.indexOf(n) !== -1 || n.indexOf(key) !== -1) return nameToContact[key];
    }
    return null;
  }

  const now = new Date();
  const lastRow = overview.getLastRow();
  if (lastRow < 2) { Logger.log('Keine Einträge in Treffen-Übersicht.'); return; }

  let somethingChanged = false;
  for (let r = 2; r <= lastRow; r++) {
    try {
      const deadline = overview.getRange(r, 3).getValue(); // C
      const freze = overview.getRange(r, 4).getValue(); // D
      const sheetName = (overview.getRange(r, 5).getValue() || '').toString().trim(); // E
      const meetingDate = overview.getRange(r, 1).getValue(); // A
      const meetingLink = (overview.getRange(r, 2).getValue() || '').toString().trim(); // B

      if (!deadline || !(deadline instanceof Date)) continue;
      const frezeIsTrue = String(freze).toUpperCase() === 'TRUE';
      if (frezeIsTrue) continue; // already processed
      if (deadline > now) continue; // not yet due

      if (!sheetName) {
        Logger.log('Zeile ' + r + ': Blattname fehlt, überspringe.');
        continue;
      }

      const sh = ss.getSheetByName(sheetName);
      if (!sh) { Logger.log('Zeile ' + r + ': Antwortblatt ' + sheetName + ' nicht gefunden.'); continue; }

      // Read header and find columns for Name and host-choice
      const lastCol = Math.max(3, sh.getLastColumn());
      const headers = sh.getRange(1,1,1,lastCol).getValues()[0].map(h => (h||'').toString().trim());
      const nameIdx = headers.findIndex(h => /name/i.test(h));

      if (nameIdx === -1) { Logger.log('Sheet ' + sheetName + ': Name-Spalte nicht gefunden.'); continue; }

      // Read responses and host column (D)
      const data = sh.getRange(2, 1, Math.max(0, sh.getLastRow() - 1), lastCol).getValues();
      const hostGastIdx = lastCol >= 4 ? 3 : -1; // index for column D

      const participants = [];
      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const pname = (row[nameIdx] || '').toString().trim();
        const hostVal = hostGastIdx >= 0 ? (row[hostGastIdx] || '').toString().trim() : '';
        if (pname) participants.push({ name: pname, hostVal: hostVal });
      }

      if (participants.length === 0) { Logger.log('Sheet ' + sheetName + ': keine Teilnehmer gefunden.'); }

      // Note: we now use the full free-text from Stammdaten column G (`diet`) instead of heuristic extraction.

      // Build assigned hosts map directly from column D values only.
      // Column D contains either 'hosted' for hosts or the host's name for guests.
      const assignedMap = {}; // hostName -> [guestNames]
      participants.forEach(p => {
        const hv = (p.hostVal || '').toString().trim();
        if (!hv) return;
        // if hv is 'hosted' we treat the participant as a host (handled below)
        if (/hosted/i.test(hv)) return;
        // otherwise hv is the host name as provided in column D; add guest to that host's list
        assignedMap[hv] = assignedMap[hv] || [];
        assignedMap[hv].push(p.name);
      });

      // Build notifications solely from assignedMap and explicit 'Will hosten' markers in column D.
      // No heuristic inference beyond column D.
      const hostNotifications = {}; // hostName -> { hostContact, guests: [{name,address,notes}] , vegetarianGuests: [] }

      // From assignedMap
      Object.keys(assignedMap).forEach(hostName => {
        const guestNames = assignedMap[hostName];
        const hostContact = findContactByName(hostName);
        const guests = guestNames.map(gn => {
          const contact = findContactByName(gn);
          const dietaryText = (contact && contact.diet) ? (contact.diet.toString().trim()) : '';
          return { name: gn, contact: contact, dietaryText: dietaryText };
        });
        hostNotifications[hostName] = {
          hostContact: hostContact,
          guests: guests,
          dietaryGuests: guests.filter(g => g.dietaryText && g.dietaryText.length > 0).map(g => ({ name: g.name, diet: g.dietaryText }))
        };
      });

      // Ensure participants who explicitly marked "Will hosten" in column D are included as hosts
      // Include participants who set 'hosted' in column D as hosts
      participants.forEach(p => {
        if (/hosted/i.test(p.hostVal)) {
          if (!hostNotifications[p.name]) {
            hostNotifications[p.name] = { hostContact: findContactByName(p.name), guests: [], vegetarianGuests: [] };
          }
        }
      });
      
      // Send notifications to guests: include host info if available
      participants.forEach(p => {
        const contact = findContactByName(p.name);
        if (!contact || !contact.email) { Logger.log('Kein Email für ' + p.name + ' gefunden, überspringe.'); return; }
        const to = contact.email;
        const subject = 'Moving Dinner ' + (meetingDate ? meetingDate.toLocaleDateString() : '');
        let body = 'Hallo ' + p.name + ',\n\n';

        // Determine host for this participant
        let hostForThis = null;
        // If participant himself declared host, inform accordingly
        if (/hosted/i.test(p.hostVal)) {
          body += 'Du wurdest als Host zugeteilt. Danke!\n\n';
          // also include list of guests if computed above
          const hn = p.name;
          const notif = hostNotifications[hn];
              if (notif && notif.guests && notif.guests.length > 0) {
              body += 'Die folgenden Personen kommen zu dir:\n';
              notif.guests.forEach(function(g) {
                const hintText = (g.dietaryText && g.dietaryText.length) ? ' (' + g.dietaryText + ')' : '';
                body += '- ' + g.name + hintText + '\n';
              });
              body += '\n';
              }
        } else {
          // Check assigned host via hostVal containing a host name (only use explicit assignments from column D)
          if (p.hostVal && !/hosted/i.test(p.hostVal)) {
            hostForThis = p.hostVal;
          }
          if (hostForThis) {
            const hostContact = findContactByName(hostForThis);
            body += 'Du bist Gast. Dein Host ist: ' + hostForThis + '.\n';
            body += 'Adresse: ' + (hostContact && hostContact.address ? hostContact.address : 'Keine Adresse in Stammdaten gefunden') + '\n\n';
          } else {
            body += 'Für dieses Treffen ist noch kein Host eindeutig zugeordnet.\n\n';
          }
        }

        // Use Stammdaten column G (diet) if available
        const contactDiet = (contact && contact.diet) || '';
        const dietText = contactDiet;
          if (!/hosted/i.test(p.hostVal) && dietText && dietText.length > 0) {
            body += 'Dein Host wurde darüber informiert, dass du folgende Ernährungsangaben gemacht hast: ' + dietText + '\n\n';
        }

        body += 'Viele Grüße,\n Jason';
        try {
          MailApp.sendEmail(to, subject, body);
          Logger.log('E-Mail gesendet an ' + to + ' für Treffen ' + sheetName);
        } catch (e) {
          Logger.log('Fehler beim Senden an ' + to + ': ' + e.message);
        }
      });

      // After sending, set Freze = TRUE so we don't send again
      try {
        overview.getRange(r, 4).setValue('TRUE');
        somethingChanged = true;
      } catch (e) {
        Logger.log('Konnte Freze für Zeile ' + r + ' nicht setzen: ' + e.message);
      }


    } catch (e) {
      Logger.log('Fehler in Zeile ' + r + ': ' + e.message);
    }
  }

  // If any Treffen were frozen/updated, refresh Master and Treffen-Matrix once
  if (somethingChanged) {
    try {
      if (typeof updateMaster === 'function') {
        updateMaster();
      } else {
        Logger.log('updateMaster nicht gefunden; bitte sicherstellen, dass Master.gs geladen ist.');
      }
    } catch (e) {
      Logger.log('Fehler beim Aufruf von updateMaster: ' + e.message);
    }

    try {
      if (typeof createMeetupMatrix === 'function') {
        createMeetupMatrix();
      } else {
        Logger.log('createMeetupMatrix nicht gefunden; bitte sicherstellen, dass Meetups.gs geladen ist.');
      }
    } catch (e) {
      Logger.log('Fehler beim Aufruf von createMeetupMatrix: ' + e.message);
    }
  }
}

function normalize(s) {
  return (s || '').toString().trim().toLowerCase();
}
