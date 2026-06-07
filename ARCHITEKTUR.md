# Moving Dinner – Neue Architektur

## 1. Tech-Stack

| Schicht | Technologie | Zweck |
|---------|-------------|-------|
| Frontend | React + TypeScript + Vite | Admin-UI, Teilnehmer-Anmeldung, Gruppen-UI |
| Backend | Node.js + Express + TypeScript | REST-API, Business-Logik, Cron-Jobs |
| Datenbank | PostgreSQL | Relationale Datenhaltung |
| ORM | Prisma | Schema-Management, Migrations, Queries |
| E-Mail | Nodemailer (SMTP, eigener Server) | Benachrichtigungen, RSVP-Links |
| Hosting | Docker Compose (3 Container) | frontend + backend + db |
| Auth | Cloudflare Zero Trust | SSO/Tunnel – nicht Teil dieses Projekts |

---

## 2. Datenmodell (PostgreSQL)

### 2.1 users (Stammdaten + Gäste)
```sql
CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(255) NOT NULL,
  password_hash TEXT,              -- NULL für Gäste (kein Login)
  address       TEXT,
  max_guests    INTEGER DEFAULT 0,
  notes         TEXT,
  diet          TEXT,
  is_guest      BOOLEAN DEFAULT FALSE,  -- TRUE = Einmal-Gast, kann zum User konvertiert werden
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(email)                     -- Ein Account pro E-Mail
);
```
**Hinweis:** Gäste und reguläre User teilen dieselbe Tabelle. Gäste haben `is_guest=TRUE` und `password_hash=NULL`. Konvertierung = Flag umsetzen + Passwort setzen + Profil ergänzen. So bleibt die `responses`-Tabelle sauber (nur `user_id`), und Gäste können bei Treffen registriert werden, ohne ein separates Gästesystem zu benötigen.

### 2.2 groups (Gruppen)
```sql
CREATE TABLE groups (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  description TEXT,
  invite_code VARCHAR(20) NOT NULL UNIQUE,  -- Einladungscode, z.B. "ABC123"
  created_by  INTEGER REFERENCES users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

### 2.3 group_members (Gruppen-Zugehörigkeit)
```sql
CREATE TABLE group_members (
  id         SERIAL PRIMARY KEY,
  group_id   INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       VARCHAR(20) DEFAULT 'member' CHECK (role IN ('admin','member')),
  joined_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, user_id)  -- Ein User pro Gruppe nur einmal
);
```
**Hinweis:** Viele-zu-Viele – ein User kann in beliebig vielen Gruppen sein. `admin` kann Termine erstellen, `member` kann sich anmelden. Start: Alle in einer Default-Gruppe.

### 2.4 group_invitations (Einladungslinks)
```sql
CREATE TABLE group_invitations (
  id         SERIAL PRIMARY KEY,
  group_id   INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  code       VARCHAR(20) NOT NULL UNIQUE,  -- Einlöse-Code, z.B. "JOIN-X7K9M2"
  max_uses   INTEGER DEFAULT NULL,          -- NULL = unbegrenzt
  used_count INTEGER DEFAULT 0,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```
**Hinweis:** Einladungscodes können als Link geteilt werden (`/join/JOIN-X7K9M2`). `max_uses` begrenzt die Anzahl der Nutzungen. Code kann auch direkt auf der Gruppe liegen (`groups.invite_code`) für permanenten Beitritt.

### 2.5 meetings (Treffen)
```sql
CREATE TABLE meetings (
  id            SERIAL PRIMARY KEY,
  group_id      INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  date          DATE NOT NULL,
  deadline      TIMESTAMPTZ NOT NULL,
  frozen        BOOLEAN DEFAULT FALSE,
  created_by    INTEGER REFERENCES users(id),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
```
**Hinweis:** Jedes Meeting gehört zu einer Gruppe. Alt: `edit_url` entfällt komplett. User sehen alle Meetings aller Gruppen, in denen sie Mitglied sind.

### 2.6 rsvp_tokens (Persönliche Anmelde-Links)
```sql
CREATE TABLE rsvp_tokens (
  id          SERIAL PRIMARY KEY,
  token       VARCHAR(64) NOT NULL UNIQUE,  -- Kryptografischer Token
  meeting_id  INTEGER NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  used        BOOLEAN DEFAULT FALSE,         -- Wird TRUE wenn RSVP abgeschlossen
  expires_at  TIMESTAMPTZ,                   -- NULL = bis Deadline gültig
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(meeting_id, user_id)  -- Ein Token pro User pro Meeting
);
```
**Hinweis:** Beim Erstellen eines Meetings oder beim Reminder wird für jedes Gruppenmitglied ein Token generiert. Der Link `/rsvp/{token}` authentifiziert den User für genau dieses Meeting – kein Login nötig, 1-Klick-Anmeldung.

### 2.7 responses (Anmeldungen)
```sql
CREATE TABLE responses (
  id            SERIAL PRIMARY KEY,
  meeting_id    INTEGER NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  host_wish     VARCHAR(20) NOT NULL CHECK (host_wish IN ('will_host','indifferent','cannot_host')),
  assigned_host INTEGER REFERENCES users(id),  -- NULL = noch nicht zugewiesen; Selbst-Referenz = ist Host
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(meeting_id, user_id)  -- Eine Anmeldung pro Treffen pro Person
);
```
**Hinweis:** `indifferent` = Default, User muss aktiv `will_host` oder `cannot_host` wählen. Algorithmus: `will_host` -> Score-Bonus, `cannot_host` -> Score-Malus, `indifferent` -> normaler Score.

### 2.8 scores (Masterblatt)
```sql
CREATE TABLE scores (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  participations INTEGER DEFAULT 0,
  hostings       INTEGER DEFAULT 0,
  hosted_guests  INTEGER DEFAULT 0,
  score          NUMERIC DEFAULT 0
);
```

### 2.9 meetup_matrix (Treffen-Matrix)
```sql
CREATE TABLE meetup_matrix (
  user_a_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_b_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  count         INTEGER DEFAULT 0,
  PRIMARY KEY (user_a_id, user_b_id),
  CHECK (user_a_id < user_b_id)  -- immer aufsteigend, kein (B,A) Duplikat
);
```

### Entfallene Alt-Objekte
| Alt | Neu | Warum entfallen |
|-----|-----|----------------|
| Script-Properties | DB-IDs | Fremdschlüssel statt Token-Tricks |
| Formulare (Google Forms) | Eigene API + Frontend | Kein externes Formular nötig |
| Antwortblatt-Header-Token | `meeting_id` FK | Zuordnung über Fremdschlüssel |
| `findAndRenameResponseSheet` | Entfällt komplett | Kein Sheet-Umbenennungs-Trick mehr |
| Treffen-Matrix als Sheet | `meetup_matrix` Tabelle | Normalisierte Relation |
| `edit_url` in meetings | `rsvp_tokens` Tabelle | Persönliche Links statt globaler Edit-URL |

---

## 3. API-Endpoints (Backend)

### 3.1 Auth (später via Cloudflare Zero Trust)
```
GET  /api/me                  – Aktueller User (aus CF Zero Trust Header)
POST /api/auth/register       – Selbst-Registrierung {name, email, password}
POST /api/auth/login          – Login {email, password} → JWT/Session
```
*(vorerst: Admin-Modus ohne echte Auth, später CF Headers auslesen)*

### 3.2 Users (Stammdaten)
```
GET    /api/users             – Alle User (Admin)
GET    /api/users/:id         – Einzelner User
PUT    /api/users/:id         – User bearbeiten (Admin oder eigenes Profil)
DELETE /api/users/:id         – User löschen (Admin)
POST   /api/users/:id/convert – Gast → regulärer User {password, address, max_guests}
```

### 3.3 Groups (Gruppen)
```
GET    /api/groups                      – Alle Gruppen (Admin)
GET    /api/groups/:id                  – Einzelne Gruppe
POST   /api/groups                      – Gruppe erstellen {name, description} (Admin)
PUT    /api/groups/:id                  – Gruppe bearbeiten
DELETE /api/groups/:id                  – Gruppe löschen
GET    /api/groups/my                   – Meine Gruppen (eingeloggter User)
GET    /api/groups/:id/members          – Mitglieder einer Gruppe
POST   /api/groups/:id/members          – Mitglied hinzufügen {user_id} (Admin)
DELETE /api/groups/:id/members/:uid     – Mitglied entfernen
POST   /api/groups/:id/invitations      – Einladungscode erstellen {max_uses, expires_at}
GET    /api/groups/:id/invitations      – Alle Einladungen der Gruppe
```

### 3.4 Group Joins (Beitreten per Code)
```
GET    /api/join/:code                  – Gruppe-Info anzeigen (vor Beitritt)
POST   /api/join/:code                  – Gruppe beitreten (authentifizierter User)
```

### 3.5 Meetings (Treffen)
```
GET    /api/meetings                    – Alle Treffen (Admin, oder ?group_id=X für Gruppe)
GET    /api/groups/:id/meetings         – Alle Treffen einer Gruppe
GET    /api/meetings/my                 – Offene Treffen aus allen meinen Gruppen
POST   /api/groups/:id/meetings         – Neues Treffen erstellen {date, deadline} (Gruppen-Admin)
PUT    /api/meetings/:id                – Bearbeiten (Datum, Deadline)
DELETE /api/meetings/:id               – Löschen (nur wenn nicht gefreezt)
```

### 3.6 Responses (Anmeldungen)
```
GET    /api/meetings/:id/responses       – Alle Anmeldungen für Treffen
POST   /api/meetings/:id/responses       – Anmeldung erstellen {host_wish} (eingeloggter User)
PUT    /api/meetings/:id/responses/me    – Eigene Anmeldung ändern {host_wish}
DELETE /api/meetings/:id/responses/me   – Eigene Anmeldung zurückziehen
```

### 3.7 RSVP (Persönliche Anmelde-Links)
```
GET    /api/rsvp/:token                 – RSVP-Info abrufen (Meeting-Daten + Name)
POST   /api/rsvp/:token                 – RSVP absenden {host_wish} (1-Klick, kein Login nötig)
POST   /api/meetings/:id/send-rsvp      – RSVP-Mails an alle Gruppenmitglieder versenden (Admin)
```

### 3.8 Assignment (Host-Zuweisung)
```
POST   /api/meetings/:id/assign          – Host-Zuweisung automatisch berechnen
GET    /api/meetings/:id/assignment      – Aktuelle Zuweisung abrufen
PUT    /api/meetings/:id/assignment      – Manuelle Zuweisung überschreiben (nur vor Freeze)
```

### 3.9 Admin-Aktionen
```
POST   /api/meetings/:id/freeze          – Treffen abschließen (Mails + Freeze)
POST   /api/meetings/:id/remind          – Manuell Erinnerung auslösen
POST   /api/admin/recalculate-scores     – Scores + Matrix neu berechnen
```

### 3.10 Public (für Gäste und Unangemeldete)
```
GET    /api/public/meetings/active       – Offene Treffen (für Anmelde-Link)
POST   /api/public/meetings/:id/register – Selbst-Anmeldung als Gast {name, email, host_wish, diet}
```

---

## 4. Pipelines (neu)

### P1: Neues Treffen erstellen
```
Gruppen-Admin → POST /api/groups/:id/meetings {date, deadline}
  → DB: meetings-Zeile anlegen (frozen=false, group_id)
  → DB: rsvp_tokens generieren – ein Token pro Gruppenmitglied
       → INSERT rsvp_tokens (token, meeting_id, user_id)
       → Token = crypto.randomBytes(32).toString('hex')
  → Background: notifyGroupNewMeeting(group_id, meeting_id)
       → DB: group_members + users → E-Mails der Gruppenmitglieder
       → SMTP: E-Mail an jedes Mitglied mit persönlichem RSVP-Link
              Link: https://domain/rsvp/{token}
              → 1-Klick: Host-Wunsch wählen, fertig
```
**Neu:** Persönliche RSVP-Links statt globaler Formular-URL. Kein Login nötig für Anmeldung. Gruppenmitglieder bekommen Token, Gäste nutzen den Public-Endpoint.

### P2: Anmeldephase – RSVP-Link (persönlich)
```
User klickt RSVP-Link → GET /api/rsvp/{token}
  → DB: rsvp_tokens JOIN meetings JOIN users → Meeting-Daten + UserName
  → Frontend: zeigt Meeting-Info + Name + 3 Optionen
      ○ Will hosten
      ○ Egal (Default)
      ○ Kann nicht hosten
  User wählt → POST /api/rsvp/{token} {host_wish}
  → DB: rsvp_tokens.used = TRUE
  → DB: responses-Zeile anlegen (user_id aus Token, UNIQUE constraint verhindert Duplikate)
  → Background: assignHosts(meeting_id)
```
**Vorteil:** Kein Login nötig, keine Verwechslung, Token ist persönlicher Beweis. Token verfällt nach Gebrauch oder Deadline.

### P2b: Anmeldephase – Angemeldeter User (ohne RSVP-Link)
```
Eingeloggter User → POST /api/meetings/:id/responses {host_wish}
  → Auth: user_id aus Session/Token
  → DB: responses-Zeile anlegen (UNIQUE constraint)
  → Background: assignHosts(meeting_id)
```

### P2c: Anmeldephase – Gast (ohne Account)
```
Gast → POST /api/public/meetings/:id/register {name, email, host_wish, diet}
  → DB: User anlegen mit is_guest=TRUE, password_hash=NULL
  → DB: responses-Zeile anlegen
  → Background: assignHosts(meeting_id)
  → Optional: E-Mail an Gast mit Bestätigung + "Wollen Sie einen Account?"-Link
```
**Gast-Konvertierung:** Später kann der Gast über `POST /api/users/:id/convert` ein Passwort setzen + Profil ergänzen → `is_guest=FALSE`.

### P3: Manuelle Zuweisung (Admin, vor Freeze)
```
Admin → PUT /api/meetings/:id/assignment {responses: [{user_id, assigned_host}, ...]}
  → Auth: Prüfe Admin-Status
  → DB: Prüfe meeting.frozen = false (sonst 403)
  → DB: responses.assigned_host für jedes angegebene user_id aktualisieren
  → Hintergrund: assignHosts() wird NICHT automatisch getriggert
     (Admin hat manuell überschrieben, Auto-Assignment würde Änderung rückgängig machen)
```
**Wichtig:** Manuelle Zuweisung ist nur vor Freeze möglich. Nach automatischer Zuweisung kann der Admin Gruppen per Drag&Drop anpassen. Danach keine automatische Neuzuweisung mehr für dieses Meeting.

### P4: Deadline-Erinnerung (täglich, Cron)
```
Cron (täglich 09:00) → sendPreDeadlineReminders()
  → DB: meetings WHERE frozen=false AND deadline BETWEEN now AND now+24h
  → Für jedes Meeting:
      → DB: group_members + users → alle Gruppenmitglieder
      → DB: responses WHERE meeting_id → bereits angemeldete user_ids
      → DB: rsvp_tokens WHERE meeting_id AND used=false → noch offene Tokens
      → Für jeden nicht-angemeldeten User:
          SMTP: Erinnerung mit persönlichem RSVP-Link (bestehenden Token oder neuen generieren)
```
**Neu:** Erinnerung enthält RSVP-Link, kein separates Formular. Token wird bei Bedarf neu generiert wenn alter verfallen.

### P5: Nach Deadline (Abschluss)
```
Cron (alle 30min) → processDeadlines()
  → DB: meetings WHERE frozen=false AND deadline <= now
  → Für jedes abgelaufene Treffen:
      → DB: responses + users lesen (inkl. is_guest-User)
      → Falls noch keine Zuweisung: assignHosts(meeting_id) ausführen
      → Mails aufbauen:
          Für Hosts: Gästeliste + Diät + Adresse (Gäste sind bei dir)
          Für Gäste: Host-Name + Host-Adresse
          Für Gast-User: Zusätzlich Hinweis "Account erstellen?" mit Konvertierungs-Link
      → SMTP: Mails versenden
      → DB: meeting.frozen = true
  → Wenn mindestens 1 Treffen gefreezt:
      → recalculateScores()
          → DB: Alle gefreezten meetings + responses aggregieren
          → DB: scores Tabelle neu schreiben
      → recalculateMatrix()
          → DB: Alle gefreezten meetings + responses → Gruppen pro Host
          → DB: meetup_matrix neu schreiben (DELETE + INSERT)
```
**Vereinfachung:** Alles transaktional, keine Race Conditions, keine veraltete Matrix.

### P6: Gruppe beitreten (per Einladungscode)
```
User → GET /api/join/:code → Gruppen-Info sehen
User → POST /api/join/:code → Gruppe beitreten
  → DB: group_invitations WHERE code=:code AND (expires_at IS NULL OR expires_at > now)
  → DB: Prüfe max_uses > used_count (falls max_uses gesetzt)
  → DB: group_members Zeile anlegen (role='member')
  → DB: group_invitations.used_count += 1
  → Ab sofort: User sieht alle offenen Meetings dieser Gruppe
```

### P7: Gast → User konvertieren
```
Gast → POST /api/users/:id/convert {password, address, max_guests}
  → Auth: Prüfe dass requester der User selbst ist (oder Admin)
  → DB: Prüfe user.is_guest = true
  → DB: password_hash setzen, address/max_guests aktualisieren, is_guest = false
  → Ergebnis: User kann sich einloggen, Gruppen beitreten, eigene RSVPs verwalten
```

---

## 5. Cron-Jobs

| Job | Intervall | Funktion |
|-----|-----------|----------|
| Deadline-Erinnerung | Täglich 09:00 | `sendPreDeadlineReminders()` – mit RSVP-Link |
| Deadline-Verarbeitung | Alle 30 Min | `processDeadlines()` → Freeze + Mails + Recalc |
| RSVP-Token Cleanup | Täglich 03:00 | Abgelaufene/verbrauchte Tokens aufräumen |
| *(optional) Assignment-Recalc* | Täglich 04:00 | Offene Treffen neu zuweisen (nur wenn keine manuelle Überschreibung) |
| *(optional) Gast-Reminder* | Wöchentlich | Gäste mit is_guest=TRUE an Account-Erstellung erinnern |

Implementierung: `node-cron` im Backend-Container.

---

## 6. Projektstruktur (Docker Compose)

```
moving-dinner/
├── docker-compose.yml
├── frontend/                  # Container 1
│   ├── Dockerfile
│   ├── package.json
│   ├── src/
│   │   ├── App.tsx
│   │   ├── pages/
│   │   │   ├── AdminMeetings.tsx    # Treffen-Übersicht + erstellen
│   │   │   ├── AdminUsers.tsx       # Stammdaten pflegen (inkl. Gast→User)
│   │   │   ├── AdminScores.tsx      # Score-Board
│   │   │   ├── AdminGroups.tsx      # Gruppen verwalten, Einladungen
│   │   │   ├── AdminAssignment.tsx  # Manuelle Host-Zuweisung (Drag&Drop)
│   │   │   ├── PublicRegister.tsx   # Selbst-Registrierung + Gast-Anmeldung
│   │   │   ├── RsvpPage.tsx         # RSVP-Link Landing Page (1-Klick)
│   │   │   ├── JoinGroup.tsx        # Einladungscode → Gruppe beitreten
│   │   │   ├── MyMeetings.tsx       # Offene Treffen aus meinen Gruppen
│   │   │   └── Profile.tsx          # Eigenes Profil bearbeiten
│   │   └── api/                    # API-Client
│   └── vite.config.ts
├── backend/                   # Container 2
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   ├── prisma/
│   │   └── schema.prisma           # Prisma Schema (alle Tabellen)
│   ├── src/
│   │   ├── index.ts                 # Express + Cron Setup
│   │   ├── middleware/
│   │   │   ├── auth.ts              # Auth-Middleware (CF Zero Trust / JWT)
│   │   │   └── groupAuth.ts         # Gruppen-Admin-Prüfung
│   │   ├── routes/
│   │   │   ├── auth.ts              # Login, Register, Me
│   │   │   ├── users.ts             # CRUD + Gast-Konvertierung
│   │   │   ├── groups.ts            # CRUD, Mitglieder, Einladungen
│   │   │   ├── join.ts              # /api/join/:code
│   │   │   ├── meetings.ts          # CRUD, /my
│   │   │   ├── responses.ts         # RSVP + Anmeldung
│   │   │   ├── rsvp.ts              # /api/rsvp/:token
│   │   │   ├── assignment.ts        # Auto + Manuell
│   │   │   └── public.ts            # Gast-Registrierung
│   │   ├── services/
│   │   │   ├── assignment.ts        # Host-Zuweisungsalgorithmus (unverändert)
│   │   │   ├── scoring.ts           # Score-Berechnung
│   │   │   ├── matrix.ts            # Meetup-Matrix
│   │   │   ├── email.ts             # SMTP Versand
│   │   │   ├── rsvp.ts              # Token-Generierung + Validierung
│   │   │   └── groups.ts            # Gruppen-Logik, Einladungen
│   │   └── jobs/
│   │       ├── deadlineReminder.ts  # P4 – mit RSVP-Links
│   │       ├── deadlineProcessor.ts # P5 – Freeze + Mails + Recalc
│   │       └── tokenCleanup.ts      # RSVP-Token Cleanup
│   └── prisma.config.ts
└── db/                        # Container 3 (oder managed)
    └── (PostgreSQL Data Volume)
```

---

## 7. Was sich fundamental ändert

| Aspekt | Alt (Sheets) | Neu (Server) |
|--------|-------------|--------------|
| Datenhaltung | 5 Tabellenblätter, kein Schema-Enforcement | PostgreSQL mit FK, UNIQUE, CHECK |
| Formular | Google Forms (extern, Token-Trick) | Eigene API + Frontend + RSVP-Links |
| Zuweisung | Bei Änderung (Trigger, fehleranfällig) | Bei Anmeldung (API-Call, transaktional) + manuelle Admin-Überschreibung |
| Matrix-Update | Nur nach Freeze (veraltet für Algorithmus) | Nach jedem Freeze (DB-Query) |
| E-Mail | MailApp, kein Retry | Nodemailer + Logging + Retry-Queue + RSVP-Links |
| Dropdown-Sync | Komplett eigener Workflow | Entfällt (User wählt aus DB) |
| Sheet-Umbenennung | Token-basiert, fragil | Entfällt (FK meeting_id) |
| Race Conditions | Mehrere Trigger gleichzeitig | Transaktionen mit Row-Locking |
| Auth | Keine (jeder mit Sheet-Zugriff) | Cloudflare Zero Trust + JWT + RSVP-Tokens |
| Audit | Sheet-Versionierung | DB-Timestamps, Logging |
| Gruppen | Nicht vorhanden (eine feste Gruppe) | Beliebig viele Gruppen, M:N-Zugehörigkeit |
| Gäste | Nicht möglich | is_guest-Flag auf users, Konvertierung zum Account |
| Anmeldung | Formular-Link (global) | Persönlicher RSVP-Link (1-Klick) + Login-basiert |
| Host-Wunsch | 2 Optionen (will_host / cannot_host) | 3 Optionen (will_host / indifferent / cannot_host) |

---

## 8. Entscheidungen (geschlossen)

| # | Frage | Entscheidung | Begründung |
|---|-------|-------------|------------|
| 1 | ORM? | **Prisma** | Bereits genutzt, Type-Safety, Migrations |
| 2 | E-Mail-Provider? | **SMTP (eigener Server)** | Unabhängig, muss noch eingerichtet werden |
| 3 | Self-Registration? | **Ja** | User können sich selbst registrieren |
| 4 | Host-Wunsch? | **3 Werte** | will_host / indifferent / cannot_host – indifferent ist Default |
| 5 | Manuelle Zuweisung? | **Ja, vor Freeze** | Admin kann automatische Zuweisung überschreiben |
| 6 | Gruppen? | **Ja, M:N** | User können in beliebig vielen Gruppen sein, Einladungscode-System |
| 7 | Gäste? | **Ja, is_guest-Flag** | Gäste als User mit is_guest=TRUE, konvertierbar |
| 8 | RSVP-Links? | **Ja** | Persönlicher Token-basierter Link, kein Login nötig |

---

## 9. Noch offene Fragen

1. **Frontend-UI für Zuweisung**: Simple Tables oder Drag&Drop für manuelle Zuweisung?
2. **Gast-Einschränkungen**: Dürfen Gäste auch hosten? (Aktuell: Ja, wenn sie will_host wählen – aber sie haben evtl. keine Adresse)
3. **Gruppen-Scores**: Scores pro Gruppe oder global? (Aktuell: global – d.h. User der in Gruppe A und B ist, hat einen Score über beide Gruppen hinweg)
4. **RSVP-Token-Gültigkeit**: Bis Deadline oder zeitlich begrenzt (z.B. 7 Tage)?
5. **Einladungscode-Lebensdauer**: Permanent (auf Gruppe) oder mit Ablaufdatum?
6. **Admin-Rollen**: Wer darf Gruppen erstellen? Jeder User oder nur Super-Admins?
7. **Datenmigration**: Sollen bestehende Google Sheets-Daten in die neue DB importiert werden?
