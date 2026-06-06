# Moving Dinner – Datenpipeline (alte Version)

Legende:
- `[ENTITÄT]` = Datenquelle/Senke
- `→` = Datenfluss
- `⟶` = Trigger/Aufruf
- `⚙` = Transformation/Logik
- `✉` = E-Mail
- `🔍` = Lesen
- `✏` = Schreiben

---

## Pipeline 1: Neues Treffen erstellen

```
UI (Datum, Deadline)
  → createAndLinkFormFromUI()
      🔍 [Stammdaten] → nicht direkt gelesen hier
      ✏ [Treffen-Übersicht] +1 Zeile: (Datum, "", Deadline, FALSE, "")
      ⚙ Google Forms API: Form erstellen
          - Frage 1: Name (ListItem, leer)
          - Frage 2: Host-Wunsch (ListItem: "Kann nicht hosten" / "Will hosten")
          - Frage 3: Token (TextItem, versteckt)
      ✏ Form.setDestination → Spreadsheet
          → Google erstellt automatisch neues Blatt "Formularantworten X"
      ✏ [ScriptProps] lastFormToken, lastFormId, lastMeetingName, lastRow
      ✏ [Treffen-Übersicht] Spalte B = Edit-URL

  ⟶ findAndRenameResponseSheet() (Trigger: bei Änderung)
      🔍 [ScriptProps] lastFormToken
      🔍 Alle Sheets → Header durchsuchen nach Token
      ⚙ Fallback: Sheet finden via Name-Pattern "Formularantworten*"
      ✏ [Antwortblatt] Name → "Treffen_yyyy_MM_dd"
      ✏ [Antwortblatt] D1 = "Host/Gast"
      ✏ [Antwortblatt] Position verschieben (hinter Nicht-Treffen-Blätter)
      ✏ [Treffen-Übersicht] Spalte E = Blattname
      ✏ [Treffen-Übersicht] Spalte D = FALSE
      ⚙ Form API: Token-Feld aus Formular löschen
      ✏ [ScriptProps] alle lastForm*-Keys löschen

      ⟶ notifyAllNewMeeting()
          🔍 [Stammdaten] Spalte B (Name), Spalte F (Email)
          ✉ an jeden Kontakt: "Neues Moving Dinner am DD.MM.YY" + Link
```

### Datenfluss-Zusammenfassung P1:
```
Input:  {datum, deadline}
Output: [Treffen-Übersicht] neue Zeile
        [Antwortblatt] "Treffen_yyyy_MM_dd" (leeres Formular-Ziel)
        ✉ an alle Stammdaten-Kontakte
```

---

## Pipeline 2: Anmeldephase (jede Formularübermittlung)

```
Google Forms Übermittlung
  → neue Zeile in [Antwortblatt]: (Zeitstempel, Name, Host-Wunsch, "")

  ⟶ updateNameDropdown() (Trigger: bei Formularübermittlung + bei Änderung)
      🔍 [Stammdaten] Spalte B → alle Namen
      🔍 [Treffen-Übersicht] alle Zeilen mit Freze = FALSE
      Für jede offene Zeile:
          🔍 Form-URL → Form-ID extrahieren
          ⚙ Form API: erstes ListItem aktualisieren mit aktuellen Namen
      ✏ [Formulare] Dropdown-Optionen = aktuelle Stammdaten-Namen

  ⟶ updateCurrentTreffen() (Trigger: bei Formularübermittlung + bei Änderung)
      🔍 [Treffen-Übersicht] → nächstes offenes Treffen (Freze≠TRUE, sortiert nach Datum)
      🔍 [Antwortblatt] → alle Zeilen: (Name, Host-Wunsch, Spalte D)
      🔍 [Stammdaten] → Name → MaxGäste
      🔍 [Masterblatt] → Name → Score
      🔍 [Treffen-Matrix] → N×N Matrix (kann null sein wenn nicht existiert)

      ⚙ HOST-SELEKTION:
          Für jeden Teilnehmer:
              score = Masterblatt-Score
              if "Will hosten"     → score = 1e9 + score
              if "Kann nicht hosten" → score = -1e9 + score
              if MaxGäste ≤ 0      → score = -1e9 + score
          Sortieren absteigend, Tie-Break: djb2(Name)
          Iterativ Hosts nehmen bis: Σ MaxGäste ≥ (Teilnehmer - #Hosts)
          "Will hosten" mit MaxGäste=0 → MaxGäste=2 (DEFAULT)
          FairShare: MaxGäste max(alt, ⌈Gäste/Hosts⌉)

      ⚙ QUOTEN:
          minQuota  = ⌊Gäste/Hosts⌋  (begrenzt auf Kapazität, Rest round-robin)
          targetQuota = ⌈Gäste/Hosts⌉ (begrenzt auf Kapazität, Rest round-robin)

      ⚙ GAST-VERTEILUNG (2-Phasen, matrix-gestützt):
          Phase 1: Jeder Host bekommt mindestens minQuota Gäste
          Phase 2: Rest bis targetQuota verteilen
          Scoring pro (Gast, Host):
              score = Matrix[Gast][Host] + avg(Matrix[Gast][Mitgäste])
              → niedriger = besser (weniger vergangene Begegnungen)
          Fallback (keine Matrix): Round-Robin

      ✏ [Antwortblatt] Spalte D: Host-Name für Gäste, "hosted" für Hosts
```

### Datenfluss-Zusammenfassung P2:
```
Input:  Formular-Übermittlung → [Antwortblatt] +1 Zeile
Lesen:  [Stammdaten], [Masterblatt], [Treffen-Matrix]
Schreiben: [Antwortblatt] Spalte D (Host-Zuweisung)
           [Formulare] Dropdown-Optionen
```

---

## Pipeline 3: Deadline-Erinnerung (täglich)

```
Zeitbasiert (täglich)
  → sendPreDeadlineRemindersDaily()

      🔍 [Treffen-Übersicht] alle Zeilen
          Filter: Freze ≠ TRUE
                  AND Deadline - 24h ≤ now < Deadline

      Für jedes passende Treffen:
          🔍 [Antwortblatt] → Menge der bereits angemeldeten Namen (normalisiert)
          🔍 [Stammdaten] → alle Kontakte (Name, Email)

          Für jeden Kontakt NICHT in angemeldeten Namen:
              ✉ Erinnerung: "Anmeldung endet bald, Deadline: DD.MM.YY HH:mm" + Form-Link
```

### Datenfluss-Zusammenfassung P3:
```
Input:  (kein User-Input, zeitgesteuert)
Lesen:  [Treffen-Übersicht], [Antwortblatt], [Stammdaten]
Output: ✉ an nicht-angemeldete Kontakte
```

---

## Pipeline 4: Nach Deadline (Abschluss)

```
Trigger: bei Änderung + zeitbasiert
  → notifyAfterDeadline()

      🔍 [Treffen-Übersicht] alle Zeilen
          Filter: Freze ≠ TRUE
                  AND Deadline ≤ now

      Für jedes abgelaufene Treffen:
          🔍 [Antwortblatt] → Teilnehmer + Spalte D (Host-Zuweisung)
          🔍 [Stammdaten] → Name → {Email, Adresse, Essensgewohnheit}

          ⚙ Benachrichtigungen aufbauen:
              Für jeden Host:
                  Gäste-Liste + Essensgewohnheiten
                  ✉ "Du bist Host. Gäste: ..."
              Für jeden Gast:
                  Host-Name + Host-Adresse
                  ✉ "Du bist Gast bei [Host]. Adresse: ..."

          ✏ [Treffen-Übersicht] Spalte D = TRUE (Freze setzen)

      Wenn mindestens ein Treffen gefreezt:
          ⟶ updateMaster()
              🔍 [Treffen-Übersicht] alle Zeilen mit Freze = TRUE
              Für jedes gefreezte Treffen:
                  🔍 [Antwortblatt] → Teilnehmer + Spalte D
                  ⚙ Pro Name kumulieren: Teilnahmen++, Hostings++ (wenn D="hosted"), Gehostete+=Gastanzahl
              🔍 [Stammdaten] → MaxGäste
              ⚙ Score = (Teilnahmen - Hostings - Gehostete) / MaxGäste
              ✏ [Masterblatt] komplett neu schreiben

          ⟶ createMeetupMatrix()
              🔍 [Treffen-Übersicht] alle Zeilen mit Freze = TRUE
              Für jedes gefreezte Treffen:
                  🔍 [Antwortblatt] → Spalte D → Host-Gruppen
                  ⚙ Für jedes Paar (A,B) in gleicher Host-Gruppe: Matrix[A][B] += 1
              ✏ [Treffen-Matrix] komplett neu schreiben
```

### Datenfluss-Zusammenfassung P4:
```
Input:  (kein User-Input, triggergesteuert)
Lesen:  [Treffen-Übersicht], [Antwortblatt], [Stammdaten]
Schreiben: [Treffen-Übersicht] Freze = TRUE
           [Masterblatt] neu berechnet
           [Treffen-Matrix] neu berechnet
Output: ✉ an alle Teilnehmer (Hosts + Gäste)
```

---

## Gesamtdatenfluss-Übersicht

```
                        ┌──────────────┐
                        │  Stammdaten  │──────────────────────────┐
                        │ (Name, Email,│                          │
                        │  Adresse,    │                          │
                        │  MaxGäste,   │                          │
                        │  Diät)       │                          │
                        └──────┬───────┘                          │
                               │                                  │
          ┌────────────────────┼─────────────────────┐            │
          ▼                    ▼                     ▼            ▼
   P1: Neues           P2: Anmeldung           P3: Deadline    P4: Nach
   Treffen erstellen   (Dropdown+Zuweisung)    Erinnerung      Deadline
          │                    │                     │            │
          ▼                    ▼                     │            ▼
   ┌──────────────┐   ┌──────────────┐               │   ┌──────────────┐
   │Treffen-      │   │Antwortblatt  │◄──────────────┘   │ E-Mails an   │
   │Übersicht     │   │Spalte D      │                   │ Hosts+Gäste  │
   │+ Antwortblatt│   │(Host-Zuweis.)│                   └──────┬───────┘
   └──────────────┘   └──────┬───────┘                          │
          │                  │                                  │
          │         ┌────────┴────────┐                         │
          │         ▼                 ▼                         ▼
          │   ┌──────────┐    ┌──────────────┐         ┌──────────────┐
          │   │Formulare │    │Masterblatt   │◄────────│ Freze=TRUE   │
          │   │Dropdowns │    │(Score/Person)│         │ + Neuberech. │
          │   └──────────┘    └──────┬───────┘         └──────┬───────┘
          │                          │                        │
          │                          ▼                        ▼
          │                  ┌──────────────┐         ┌──────────────┐
          │                  │Treffen-Matrix│◄────────│ createMatrix │
          │                  │(N×N Begegn.) │         └──────┬───────┘
          │                  └──────┬───────┘                │
          │                         │                        │
          └─────────────────────────┼────────────────────────┘
                                    ▼
                          P2 liest Matrix für
                          Host-Zuweisungsalgorithmus
                          (niedriger Score = besser,
                           noch nicht zusammen gewesene
                           Personen bevorzugen)
```

---

## Abhängigkeitskette (was muss worauf warten)

```
Stammdaten existiert
    ↓
Treffen-Übersicht (P1 erstellt Zeile)
    ↓
Formular + Antwortblatt existieren  ← P1 muss abgeschlossen sein
    ↓
Anmeldungen fließen ein             ← Dropdown muss stimmen (P2)
    ↓
Host-Zuweisung wird berechnet       ← braucht Masterblatt + Matrix
    ↓
Deadline abgelaufen                  ← P4 triggered
    ↓
E-Mails versendet + Freze=TRUE      ← braucht Host-Zuweisung in Spalte D
    ↓
Masterblatt + Matrix neu berechnet  ← braucht Freze=TRUE
    ↓
Nächstes Treffen: Matrix ist aktuell für Algorithmus
```