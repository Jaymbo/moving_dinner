function updateNameDropdown() {
  // Lädt die Teilnehmerliste aus `Stammdaten` und aktualisiert alle Formulare,
  // die in `Treffen-Übersicht` gelistet sind und bei denen Spalte D (Freze) = FALSE
  // --- Konfiguration ---
  const sheetName = 'Stammdaten'; // Name der Sheet-Tabelle mit den Teilnehmern
  const nameColumn = 2; // Spalte, in der die Namen stehen (B = 2)
  const overviewName = 'Treffen-Übersicht'; // Übersicht mit Formular-Links
  const linkColumn = 2; // Spalte B = Link
  const frezeColumn = 4; // Spalte D = Freze

  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) { Logger.log('Stammdaten sheet nicht gefunden: ' + sheetName); return; }

  // Teilnehmernamen einlesen
  const lastRowNames = sheet.getLastRow();
  const names = lastRowNames > 1
    ? sheet.getRange(2, nameColumn, Math.max(0, lastRowNames - 1), 1).getValues().flat().filter(String)
    : [];

  if (!names || names.length === 0) {
    Logger.log('Keine Namen in ' + sheetName + ' gefunden. Abbruch.');
    return;
  }

  // Übersicht durchgehen und für alle Zeilen mit Freze = FALSE und vorhandenem Link das Formular aktualisieren
  const overview = ss.getSheetByName(overviewName);
  if (!overview) { Logger.log('Treffen-Übersicht sheet nicht gefunden: ' + overviewName); return; }

  const lastRowOverview = overview.getLastRow();
  if (lastRowOverview < 2) { Logger.log('Keine Daten in ' + overviewName); return; }

  for (let r = 2; r <= lastRowOverview; r++) {
    try {
      const freze = overview.getRange(r, frezeColumn).getValue();
      const link = overview.getRange(r, linkColumn).getValue();

      const isFrezeFalse = (String(freze).toUpperCase() === 'FALSE' || freze === false || freze === 'False');
      const linkEmpty = (link === '' || link === null || link === undefined || String(link).trim() === '');

      if (!isFrezeFalse) continue; // nur Freze = FALSE verarbeiten
      if (linkEmpty) {
        Logger.log('Zeile ' + r + ': Link fehlt, überspringe.');
        continue;
      }

      // Form-ID aus dem Link extrahieren (z.B. https://docs.google.com/forms/d/<FORMID>/edit)
      const linkStr = String(link);
      const match = linkStr.match(/\/d\/([a-zA-Z0-9_-]+)/);
      if (!match || !match[1]) {
        Logger.log('Zeile ' + r + ': Konnte Form-ID aus Link nicht extrahieren: ' + linkStr);
        continue;
      }
      const formId = match[1];

      // Formular öffnen und erstes LIST-Item aktualisieren
      try {
        const form = FormApp.openById(formId);
        const items = form.getItems(FormApp.ItemType.LIST);
        if (!items || items.length === 0) {
          Logger.log('Form ' + formId + ' hat keine LIST Items. Zeile ' + r);
          continue;
        }
        const nameItem = items[0].asListItem();
        nameItem.setChoiceValues(names);
        Logger.log('Form ' + formId + ' aktualisiert (Zeile ' + r + ').');
      } catch (e) {
        Logger.log('Fehler beim Aktualisieren des Formulars ' + formId + ' (Zeile ' + r + '): ' + e.message);
        continue;
      }

    } catch (e) {
      Logger.log('Fehler beim Verarbeiten von Übersicht-Zeile ' + r + ': ' + e.message);
      continue;
    }
  }
}
