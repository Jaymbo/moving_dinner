/**
 * Erzeugt eine Treffhäufigkeits-Matrix zwischen allen Personen in `Stammdaten`.
 * - Liest nur Treffen aus `Treffen-Übersicht`, bei denen `Freze` = TRUE ist.
 * - Für jedes solche Treffen werden alle Teilnehmer (Namen aus dem Antwortblatt)
 *   als anwesend betrachtet. Für jedes Paar (A,B) wird die Häufigkeit erhöht.
 * - Die Matrix wird in einem Sheet `Treffen-Matrix` ausgegeben (erstes Feld leer,
 *   erste Zeile/erste Spalte enthalten die Namen aus `Stammdaten`, Reihen/Spalten
 *   sind in gleicher Reihenfolge).
 * - Nur Personen, die in `Stammdaten` vorhanden sind, werden in der Matrix berücksichtigt.
 */
function createMeetupMatrix() {
  const ss = SpreadsheetApp.getActive();
  const overview = ss.getSheetByName('Treffen-Übersicht');
  const stammdaten = ss.getSheetByName('Stammdaten');
  if (!overview) { Logger.log('Treffen-Übersicht nicht gefunden. Abbruch.'); return; }
  if (!stammdaten) { Logger.log('Stammdaten nicht gefunden. Abbruch.'); return; }

  // Load names from Stammdaten (column B)
  const sdLast = stammdaten.getLastRow();
  const names = sdLast > 1 ? stammdaten.getRange(2, 2, sdLast - 1, 1).getValues().map(r => (r[0] || '').toString().trim()).filter(n => n) : [];
  const N = names.length;
  if (N === 0) { Logger.log('Keine Namen in Stammdaten gefunden.'); return; }

  // Map normalized name -> index in names array
  const nameIndex = {};
  for (let i = 0; i < names.length; i++) nameIndex[normalize(names[i])] = i;

  // Initialize NxN zero matrix
  const matrix = [];
  for (let i = 0; i < N; i++) {
    matrix.push(Array(N).fill(0));
  }

  // Iterate over overview rows and process only rows with Freze = TRUE
  const oLast = overview.getLastRow();
  for (let r = 2; r <= oLast; r++) {
    try {
      const freze = overview.getRange(r, 4).getValue(); // D
      if (String(freze).toUpperCase() !== 'TRUE') continue; // ignore non-TRUE
      const sheetName = (overview.getRange(r, 5).getValue() || '').toString().trim(); // E
      if (!sheetName) { Logger.log('Zeile ' + r + ': Blattname fehlt, überspringe.'); continue; }
      const sh = ss.getSheetByName(sheetName);
      if (!sh) { Logger.log('Zeile ' + r + ': Antwortblatt ' + sheetName + ' nicht gefunden.'); continue; }

      const lastCol = Math.max(3, sh.getLastColumn());
      const headers = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(h => (h || '').toString().trim());
      const nameIdx = headers.findIndex(h => /name/i.test(h));
      if (nameIdx === -1) { Logger.log('Sheet ' + sheetName + ': Name-Spalte nicht gefunden.'); continue; }

      const data = sh.getRange(2, 1, Math.max(0, sh.getLastRow() - 1), lastCol).getValues();

      // Build participant objects with indices into the master `names` array
      const participants = []; // { name, idx, hostVal }
      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const pname = (row[nameIdx] || '').toString().trim();
        if (!pname) continue;
        const idx = nameIndex[normalize(pname)];
        if (typeof idx === 'undefined') continue; // ignore people not in Stammdaten
        const hostVal = (row.length > 3 ? (row[3] || '').toString().trim() : ''); // column D
        participants.push({ name: pname, idx: idx, hostVal: hostVal });
      }

      if (participants.length === 0) continue;

      // Map normalized participant name -> participant obj
      const pnameMap = {};
      participants.forEach(p => { pnameMap[normalize(p.name)] = p; });

      // Identify hosts and build host->guest index lists
      const assignedMap = {}; // hostName -> Set of indices (guest indices)

      // Host marker regex (covers some German/English variants like "will hosten","host","hosted")
      const hostMarkerRe = /\b(will hosten|will host|hosten|host|hosted|ich hoste|ich werde hosten|ich werde hosten|ich wuerde hosten|ich würde hosten|ich würde gerne hosten|ich würde gern hosten|ich hoste gern|ich hoste gerne)\b/i;

      // First, ensure explicit hosts are present as keys
      participants.forEach(p => {
        if (p.hostVal && hostMarkerRe.test(p.hostVal)) {
          assignedMap[p.name] = assignedMap[p.name] || new Set();
        }
      });

      // Then, for each participant who listed a host name in column D, add them as guest
      participants.forEach(p => {
        const hv = (p.hostVal || '').toString().trim();
        if (!hv) return; // no assignment
        const normHv = normalize(hv);
        // If hv matches a participant name, treat that as the host
        if (pnameMap[normHv]) {
          const hostName = pnameMap[normHv].name;
          assignedMap[hostName] = assignedMap[hostName] || new Set();
          assignedMap[hostName].add(p.idx);
        }
      });

      // Now, for each host key in assignedMap, include the host's own index and increment pairs within that group
      Object.keys(assignedMap).forEach(hostName => {
        const hostObj = pnameMap[normalize(hostName)];
        if (!hostObj) return; // defensive
        const groupSet = new Set(assignedMap[hostName]);
        groupSet.add(hostObj.idx);
        const group = Array.from(groupSet);
        // For each unordered pair within group, increment both entries
        for (let a = 0; a < group.length; a++) {
          for (let b = a + 1; b < group.length; b++) {
            const iA = group[a];
            const iB = group[b];
            matrix[iA][iB] = (matrix[iA][iB] || 0) + 1;
            matrix[iB][iA] = (matrix[iB][iA] || 0) + 1;
          }
        }
      });

      // Note: participants without a host assignment or not referenced as host are ignored for this meeting,
      // because we only trust column D to determine host/guest grouping.

    } catch (e) {
      Logger.log('Fehler beim Verarbeiten von Übersicht Zeile ' + r + ': ' + e.message);
    }
  }

  // Write matrix to sheet 'Treffen-Matrix'
  const outName = 'Treffen-Matrix';
  let out = ss.getSheetByName(outName);
  if (!out) out = ss.insertSheet(outName);
  out.clear();

  // Prepare output array: first row header, then rows with name + counts
  const output = [];
  const header = [''].concat(names);
  output.push(header);
  for (let i = 0; i < N; i++) {
    const row = [names[i]].concat(matrix[i].map(v => v || 0));
    output.push(row);
  }

  out.getRange(1, 1, output.length, output[0].length).setValues(output);
  Logger.log('Treffen-Matrix erstellt in Blatt "' + outName + '" mit ' + N + ' Personen.');
}
