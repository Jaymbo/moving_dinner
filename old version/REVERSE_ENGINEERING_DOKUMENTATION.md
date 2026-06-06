# Moving Dinner – Reverse-Engineering-Dokumentation (Google Sheets Version)

## 1. Datenmodell (Sheets / Tabellen)

### 1.1 Stammdaten
| Spalte | Feld | Beschreibung |
|--------|------|-------------|
| A | (ID/Zeile) | – |
| B | Name | Teilnehmername (eindeutig, Normalisierung: trim+lowercase) |
| C | Adresse | Wohnadresse für Host-Zuweisung |
| D | MaxGäste | Maximale Gäste-Kapazität (Zahl) |
| E | Notizen | Optionale Notizen |
| F | Email | E-Mail-Adresse |
| G | Essensgewohnheit | Vegetarisch/Vegan/etc. |

### 1.2 Treffen-Übersicht
| Spalte | Feld | Beschreibung |
|--------|------|-------------|
| A | Datum | Datum des Treffens (Date) |
| B | Link | Google Forms Edit-URL des zugehörigen Formulars |
| C | Deadline | Anmeldeschluss (Date) |
| D | Freze | Boolean – TRUE = abgeschlossen/nach Deadline verarbeitet |
| E | Blattname | Name des Antwortblatts (z.B. `Treffen_2025_06_15`) |

### 1.3 Treffen_yyyy_MM_dd (Antwortblatt pro Treffen)
| Spalte | Feld | Beschreibung |
|--------|------|-------------|
| A | Zeitstempel | Google Forms Auto-Timestamp |
| B | Name | Dropdown-Auswahl aus Stammdaten |
| C | Host-Wunsch | Dropdown: "Kann nicht hosten" / "Will hosten" |
| D | Host/Gast | **Zugewiesener Host-Name** oder `"hosted"` (wird vom Algorithmus geschrieben) |

### 1.4 Masterblatt (Score-Tracking)
| Spalte | Feld | Beschreibung |
|--------|------|-------------|
| A | Name | – |
| B | Teilnahmen | Anzahl vergangener Teilnahmen |
| C | Hostings | Anzahl wie oft gehostet |
| D | Gehostete Gäste | Summe der Gäste bei eigenen Hostings |
| E | Score | `(Teilnahmen - Gehostete - Hostings) / MaxGäste` |

### 1.5 Treffen-Matrix
N×N-Matrix (N = Anzahl Stammdaten-Namen). Zeilen/Spalten = Namen.
Wert = Wie oft Person A und Person B **in derselben Host-Gruppe** waren (nur gefreezte Treffen).
Wird genutzt vom Host-Zuweisungsalgorithmus um wiederkehrende Gruppen zu vermeiden.

---

## 2. Trigger & Zeitsteuerung

| # | Ereignis | Funktion | Beschreibung |
|---|----------|----------|-------------|
| 1 | Formular-Übermittlung | `updateNameDropdown` | Aktualisiert Name-Dropdown in allen offenen Formularen |
| 2 | Bei Änderung (Sheet) | `notifyAfterDeadline` | Prüft ob Deadlines abgelaufen → verschickt Zuweisungs-Mails |
| 3 | Zeitbasiert (täglich) | `sendPreDeadlineRemindersDaily` | Erinnerung 1 Tag vor Deadline an Unangemeldete |
| 4 | Bei Änderung (Sheet) | `findAndRenameResponseSheet` | Bennet Antwortblatt um nach Form-Erstellung |
| 5 | Bei Änderung (Sheet) | `updateNameDropdown` | Bei Stammdaten-Änderung → Dropdowns aktualisieren |
| 6 | Zeitbasiert | `notifyAfterDeadline` | Zeitbasierte Fallback-Prüfung auf abgelaufene Deadlines |
| 7 | Formular-Übermittlung | `updateCurrentTreffen` | Neu-Berechnung der Host-Zuweisung |
| 8 | Bei Änderung (Sheet) | `updateCurrentTreffen` | Neu-Berechnung bei Datenänderung |

---

## 3. Workflows (chronologisch)

### 3.1 Neues Treffen erstellen
1. **UI aufrufen** → Menü "MovingDinner > Neues Treffen erstellen" öffnet `NeuesTreffenUI.html`
2. **Datum & Deadline wählen** → Default: Deadline = Datum - 3 Tage
3. **`createAndLinkFormFromUI(dateIso, deadlineIso)`** aufgerufen:
   - Neue Zeile in `Treffen-Übersicht` (A=Datum, C=Deadline, D=FALSE)
   - Google Form erstellen:
     - Frage 1: Name (ListItem / Dropdown)
     - Frage 2: "Kann nicht hosten / Will hosten" (ListItem)
     - Verstecktes Token-Feld (TextItem) → wird nach Zuordnung wieder gelöscht
   - Form verknüpft sich automatisch mit Spreadsheet → neues Antwortblatt entsteht
   - Script-Properties zwischenspeichern: `lastFormToken`, `lastFormId`, `lastMeetingName`, `lastRow`
   - Edit-URL in Übersicht Spalte B
4. **`findAndRenameResponseSheet()`** (Trigger: bei Änderung):
   - Findet neues Antwortblatt via Token-Suche in Headers oder Default-Name-Pattern
   - Bennet es um zu `Treffen_yyyy_MM_dd`
   - Setzt Header D1 = "Host/Gast"
   - Verschiebt Blatt hinter alle Nicht-Treffen-Blätter
   - Trägt Blattname in Übersicht Spalte E ein
   - Löscht Token-Feld aus Formular
   - Ruft `notifyAllNewMeeting()` auf → E-Mail an alle Stammdaten-Kontakte

### 3.2 Anmeldephase (vor Deadline)
- **Bei jeder Formularübermittlung oder Änderung:**
  - `updateNameDropdown()`: Aktualisiert Dropdown in allen offenen (Freze≠TRUE) Formularen mit aktuellen Stammdaten-Namen
  - `updateCurrentTreffen()`: **Berechnet Host-Zuweisung neu** und schreibt Ergebnis in Spalte D (siehe Algorithmus §4)
- **1 Tag vor Deadline (zeitbasiert):**
  - `sendPreDeadlineRemindersDaily()`: Findet alle offenen Treffen deren Deadline in [Deadline-24h, Deadline) liegt
  - Ermittelt bereits angemeldete Namen aus Antwortblatt
  - Sendet Erinnerungs-Mail an alle **nicht angemeldeten** Stammdaten-Kontakte

### 3.3 Nach Deadline (Abschluss)
- `notifyAfterDeadline()` (Trigger: bei Änderung + zeitbasiert):
  1. Findet alle Zeilen in Übersicht mit `Deadline ≤ now` UND `Freze ≠ TRUE`
  2. Liest Antwortblatt: Teilnehmer + Spalte D (Host-Zuweisung)
  3. **E-Mail an Hosts**: Liste der zugewiesenen Gäste mit Essensgewohnheiten
  4. **E-Mail an Gäste**: Name + Adresse ihres Hosts
  5. Setzt `Freze = TRUE`
  6. Ruft `updateMaster()` und `createMeetupMatrix()` auf

### 3.4 Score & Matrix Update (nach Freeze)
- `updateMaster()`:
  - Iteriert alle gefreezten Treffen-Blätter
  - Zählt pro Name: Teilnahmen, Hostings (Spalte D = "hosted"), Gehostete Gäste
  - Score = `(Teilnahmen - Hostings - Gehostete) / MaxGäste`
  - Schreibt in Masterblatt
- `createMeetupMatrix()`:
  - Iteriert alle gefreezten Treffen-Blätter
  - Pro Treffen: Gruppiert nach Host (Spalte D)
  - Für jedes Paar (A,B) in gleicher Host-Gruppe: Matrix[A][B] += 1
  - Schreibt N×N-Matrix in Blatt "Treffen-Matrix"

---

## 4. Host-Zuweisungsalgorithmus (`updateCurrentTreffen`)

### 4.1 Host-Selektion
1. Nächstes offenes Treffen (Freze≠TRUE, sortiert nach Datum) ermitteln
2. Für jeden Teilnehmer **Score berechnen**:
   - "Will hosten" → `HIGH_SCORE (1e9) + masterScore`
   - "Kann nicht hosten" → `LOW_SCORE (-1e9) + masterScore`
   - MaxGäste ≤ 0 → `LOW_SCORE + masterScore`
   - Sonst → `masterScore` (aus Masterblatt)
3. **Sortierung**: Absteigend nach Score; bei Gleichstand: deterministischer Hash (`djb2`)
4. **Iterative Selektion** bis Gesamtkapazität ≥ Anzahl Gäste:
   - Hosts mit MaxGäste=0 werden übersprungen (außer "Will hosten")
   - "Will hosten" mit MaxGäste=0 bekommt `DEFAULT_MAX_GUESTS = 2`
5. **FairShare-Anpassung**: Wenn `MaxGäste < ⌈Gäste/Hosts⌉` → MaxGäste erhöhen

### 4.2 Quoten-Berechnung
- **minQuota** = `⌊Gäste/Hosts⌋`, auf Kapazität begrenzt, Rest round-robin verteilt
- **targetQuota** = `⌈Gäste/Hosts⌉`, auf Kapazität begrenzt, Rest round-robin verteilt

### 4.3 Gast-Verteilung (2-Phasen, matrix-gestützt)
**Phase 1 – minQuota füllen**: Jeder Host muss mindestens minQuota Gäste bekommen.
**Phase 2 – targetQuota füllen**: Rest bis targetQuota verteilen.

**Scoring für (Gast, Host)-Paar** (niedriger = besser):
```
score = Treffen-Matrix[Gast][Host]       # Wie oft war Gast schon bei diesem Host
      + avg(Matrix[Gast][Mitgast])       # Durchschnittliche Vorbegegnung mit bereits zugewiesenen Mitgästen
```
Ziel: **Personen auseinanderhalten**, die sich schon oft getroffen haben.

**Fallback** (keine Matrix): Round-Robin mit minQuota/targetQuota.

### 4.4 Zurückschreiben
- Spalte D des Antwortblatts: Host-Name für Gäste, `"hosted"` für Hosts

---

## 5. E-Mail-Kommunikation

| Trigger | Funktion | Empfänger | Inhalt |
|---------|----------|-----------|--------|
| Neues Treffen | `notifyAllNewMeeting` | Alle Stammdaten-Kontakte | Link zum Formular |
| 1 Tag vor Deadline | `sendPreDeadlineRemindersDaily` | Nur **nicht angemeldete** Kontakte | Erinnerung + Formular-Link |
| Nach Deadline | `notifyAfterDeadline` | Alle Teilnehmer | **Hosts**: Gästeliste + Essensgewohnheiten. **Gäste**: Host-Name + Adresse |

---

## 6. Hilfsfunktionen

| Funktion | Datei | Beschreibung |
|----------|-------|-------------|
| `normalize(s)` | nach Deadline.gs | `trim().toLowerCase()` – Namens-Normalisierung für Matching |
| `hashString(s)` | update Host verteilung.gs | djb2-Hash für deterministischen Tie-Break |
| `findSheetByHeaderToken(ss, token)` | neues Treffen2.gs | Findet Sheet durch Token in Header-Zeile |
| `findResponseSheetByDefaultName(ss)` | neues Treffen2.gs | Findet Sheet durch Name-Pattern (`Formularantworten*`) |
| `moveSheetAfterNonTreffen(ss, sheet)` | neues Treffen2.gs | Sortiert Treffen-Blätter hinter Nicht-Treffen-Blätter |
| `formatDateDDMMYY(d)` | neues Treffen2.gs | Formatiert Datum als `DD.MM.YY` |
| `getOpenMeetingForms()` | neues Treffen.gs | Liefert offene Treffen + Published-URLs für UI |

---

## 7. Script-Properties (Zwischenspeicher)

| Key | Zweck | Lebenszyklus |
|-----|-------|-------------|
| `lastFormToken` | Verstecktes Token im Formular zum Identifizieren des Antwortblatts | Gesetzt bei Form-Erstellung, gelöscht nach `findAndRenameResponseSheet` |
| `lastFormId` | ID des neu erstellten Formulars | Gleich |
| `lastMeetingName` | Ziel-Blattname (`Treffen_yyyy_MM_dd`) | Gleich |
| `lastRow` | Zeilennummer in Treffen-Übersicht | Gleich |
| `TARGET_SPREADSHEET_ID` | Für Web-App-Zugriff ohne aktives Spreadsheet | Permanent |

---

## 8. Identifizierte Probleme / Migrationshinweise

1. **Treffen-Matrix wird nur nach Deadline aktualisiert** – der Algorithmus nutzt sie live, aber sie ist nur für gefreezte Treffen aktuell(gewollt:neues Treffen basiert auf den alten Treffensverteilungen)
2. **`updateCurrentTreffen` hat 100% Fehlerrate** bei einem Trigger – möglicherweise Race-Condition oder Berechtigungsproblem
3. **Keine Transaktionssicherheit** – gleichzeitige Formular-Übermittlungen können zu Konflikten führen
4. **Score-Formel**: `(Teilnahmen - Hostings - Gehostete) / MaxGäste` – wer öfter hostet, sinkt im Score → wird seltener als Gast zugeteilt, aber öfter als Host gewählt (gewollt: Fairness)
5. **Host-Wunsch ist binär** – kein "Kann hosten" Zwischenwert
6. **Essensgewohnheit wird nur nach Deadline kommuniziert**, nicht bei der Zuweisung berücksichtigt
7. **E-Mail über MailApp** – keine Logging/Retry-Mechanik, Fehler werden nur geloggt