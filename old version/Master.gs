function updateMaster() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const masterSheetName = "Masterblatt";
  const stammdatenName = "Stammdaten";
  const overviewSheetName = "Treffen-Übersicht";
  const treffenPrefix = "Treffen_";

  const masterSheet = ss.getSheetByName(masterSheetName);
  const stammdatenSheet = ss.getSheetByName(stammdatenName);
  const overviewSheet = ss.getSheetByName(overviewSheetName);

  // Stammdaten auslesen
  const stammdaten = stammdatenSheet.getDataRange().getValues().slice(1); // ohne Header

  // Übersicht auslesen
  const overviewData = overviewSheet.getDataRange().getValues().slice(1); // ohne Header
  // Nur gefreezte Treffen
  const frozenSheets = overviewData.filter(r => r[3] === true).map(r => r[4]); // Blattname Spalte 5

  // Master vorbereiten
  masterSheet.clearContents();
  masterSheet.appendRow(["Name", "Teilnahmen", "Hostings", "Gehostete Gäste", "Score"]);

  // Alle historischen Daten sammeln
  let histData = {}; // Name -> {Teilnahmen, Hostings, Gehostete}
  frozenSheets.forEach(sheetName => {
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) return;

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return; // keine Daten
    const data = sheet.getRange(2, 2, lastRow-1, 3).getValues(); // B:C Name + Host-Wunsch, D Zugewiesen

    data.forEach((row, i) => {
      const name = row[0];
      if (!name) return;
      if (!histData[name]) histData[name] = {Teilnahmen:0, Hostings:0, Gehostete:0};

      histData[name].Teilnahmen += 1;
      if (row[2] === "hosted") {
        histData[name].Hostings += 1;
        // Anzahl Gäste zählen, die zu diesem Host gehören
        const guests = sheet.getRange(2, 4, lastRow-1).getValues().filter(r => r[0] === name).length;
        histData[name].Gehostete += guests;
      }
    });
  });

  // Stammdaten durchgehen und Master füllen
  stammdaten.forEach(sd => {
    const name = sd[1]; // Spalte B
    const td = histData[name] || {Teilnahmen:0, Hostings:0, Gehostete:0};
    const score = td.Teilnahmen - td.Gehostete - td.Hostings;
    const maxGuests = Number(sd[3]) || 0; // Stammdaten Spalte D
    // wenn maxGuests > 0, Score durch maxGuests teilen, sonst unverändert lassen
    const adjustedScore = (maxGuests > 0) ? (score / maxGuests) : score;
    masterSheet.appendRow([name, td.Teilnahmen, td.Hostings, td.Gehostete, adjustedScore]);
  });

  SpreadsheetApp.flush();
}
