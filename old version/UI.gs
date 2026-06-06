/**
 * Menüeintrag und Dialog-Launcher für "Neues Treffen".
 * - Fügt beim Öffnen ein Menü hinzu, um das Dialog-HTML zu öffnen.
 * - `showNeuesTreffenDialog` zeigt ein Modal, von dem aus `createAndLinkForm()` aufgerufen wird.
 */
function onOpen() {
  try {
    SpreadsheetApp.getUi().createMenu('MovingDinner')
      .addItem('Neues Treffen erstellen', 'showNeuesTreffenDialog')
      .addToUi();
  } catch (e) {
    Logger.log('onOpen: ' + e.message);
  }
}

function showNeuesTreffenDialog() {
  const html = HtmlService.createHtmlOutputFromFile('NeuesTreffenUI')
    .setWidth(420)
    .setHeight(240);
  SpreadsheetApp.getUi().showModalDialog(html, 'Neues Treffen erstellen');
}

// Optional: allow direct web-app access (doGet) for testing
function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('NeuesTreffenUI');
}
