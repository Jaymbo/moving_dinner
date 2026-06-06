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
**Hinweis:** `indifferent` = Default, User muss aktiv `will_host` oder `cannot_host` wählen. Algorithmus: `will_host` → Score-Bonus, `cannot_host` → Score-Malus, `indifferent` → normaler Score.

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
| Treffen-Matrix als Sheet | `meetup_matrix` Tabelle | Normalisierte Relation |

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
PUT    /api/meetings/:id/assignment      – Manuelle Zuweisung überschreiben {responses: [{user_id, assigned_host}]} (nur vor Freeze)
```

### 3.9 Admin-Aktionen
```
POST   /api/meetings/:id/freeze          – Treffen abschließen (Mails + Freeze)
POST   /api/meetings/:id/remind          – Manuell Erinnerung auslösen
POST   /api/admin/recalculate-scores     – Scores + Matrix neu berechnen
```

### 3.10 Public (für Gäste & Unangemeldete)
```
GET    /api/public/meetings/active       – Offene Treffen (für Anmelde-Link)
POST   /api/public/meetings/:id/register – Selbst-Anmeldung als Gast {name, email, host_wish, diet}
```

---

## 4. Pipelines (neu)

### P1: Neues Treffen erstellen
```
Admin → POST /api/meetings {date, deadline}
  → DB: meetings-Zeile anlegen (frozen=false)
  → Cron/Background: notifyAllNewMeeting()
       → DB: users.email
       → SMTP: E-Mail an alle mit Link zur Anmeldeseite
```
**Vereinfachung:** Kein Formular, kein Token, kein Sheet-Umbenennen. Nur eine DB-Zeile.

### P2: Anmeldephase (bei jeder Anmeldung)
```
User → POST /api/public/meetings/:id/register {user_id, host_wish}
  → DB: responses-Zeile anlegen (UNIQUE constraint verhindert Duplikate)
  → Background: assignHosts(meeting_id)
       → DB: responses + users + scores + meetup_matrix lesen
       → Algorithmus (identisch wie alt, siehe §4 alte Doku)
       → DB: responses.assigned_host zurückschreiben
```
**Vereinfachung:** Kein Dropdown-Sync nötig (User wählt aus User-Tabelle). Assignment läuft automatisch nach jeder Anmeldung.

### P3: Deadline-Erinnerung (täglich, Cron)
```
Cron (täglich 09:00) → sendPreDeadlineReminders()
  → DB: meetings WHERE frozen=false AND deadline BETWEEN now AND now+24h
  → Für jedes: DB: responses WHERE meeting_id (bereits angemeldete user_ids)
  → DB: users WHERE id NOT IN (angemeldete)
  → SMTP: Erinnerung an fehlende User
```
**Vereinfachung:** Eine SQL-Query statt Sheet-Zeilen-Iteration.

### P4: Nach Deadline (Abschluss)
```
Cron (alle 30min) → processDeadlines()
  → DB: meetings WHERE frozen=false AND deadline <= now
  → Für jedes abgelaufene Treffen:
      → DB: responses + users lesen
      → Mails aufbauen (Hosts: Gästeliste+Diät, Gäste: Host+Adresse)
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

---

## 5. Cron-Jobs

| Job | Intervall | Funktion |
|-----|-----------|----------|
| Deadline-Erinnerung | Täglich 09:00 | `sendPreDeadlineReminders()` |
| Deadline-Verarbeitung | Alle 30 Min | `processDeadlines()` → Freeze + Mails + Recalc |
| *(optional) Assignment-Recalc* | Täglich 03:00 | Alle offenen Treffen neu zuweisen (falls Daten korrigiert wurden) |

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
│   │   │   ├── AdminUsers.tsx       # Stammdaten pflegen
│   │   │   ├── AdminScores.tsx      # Score-Board
│   │   │   └── PublicRegister.tsx   # Teilnehmer-Anmeldung
│   │   └── api/                    # API-Client
│   └── vite.config.ts
├── backend/                   # Container 2
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── index.ts                 # Express + Cron Setup
│   │   ├── db/
│   │   │   ├── migrations/          # SQL Migrationen
│   │   │   ├── client.ts            # pg-Pool
│   │   │   └── queries/             # SQL Queries
│   │   ├── routes/
│   │   │   ├── users.ts
│   │   │   ├── meetings.ts
│   │   │   ├── responses.ts
│   │   │   ├── assignment.ts
│   │   │   └── public.ts
│   │   ├── services/
│   │   │   ├── assignment.ts        # Host-Zuweisungsalgorithmus
│   │   │   ├── scoring.ts           # Score-Berechnung
│   │   │   ├── matrix.ts            # Meetup-Matrix
│   │   │   └── email.ts             # SMTP Versand
│   │   └── jobs/
│   │       ├── deadlineReminder.ts  # P3
│   │       └── deadlineProcessor.ts # P4
│   └── drizzle.config.ts           # (oder Prisma/Knex)
└── db/                        # Container 3 (oder managed)
    └── (PostgreSQL Data Volume)
```

---

## 7. Was sich fundamental ändert

| Aspekt | Alt (Sheets) | Neu (Server) |
|--------|-------------|--------------|
| Datenhaltung | 5 Tabellenblätter, kein Schema-Enforcement | PostgreSQL mit FK, UNIQUE, CHECK |
| Formular | Google Forms (extern, Token-Trick) | Eigene API + Frontend |
| Zuweisung | Bei Änderung (Trigger, fehleranfällig) | Bei Anmeldung (API-Call, transaktional) |
| Matrix-Update | Nur nach Freeze (veraltet für Algorithmus) | Nach jedem Freeze (DB-Query) |
| E-Mail | MailApp, kein Retry | Nodemailer + Logging + Retry-Queue |
| Dropdown-Sync | Komplett eigener Workflow | Entfällt (User wählt aus DB) |
| Sheet-Umbenennung | Token-basiert, fragil | Entfällt (FK meeting_id) |
| Race Conditions | Mehrere Trigger gleichzeitig | Transaktionen mit Row-Locking |
| Auth | Keine (jeder mit Sheet-Zugriff) | Cloudflare Zero Trust |
| Audit | Sheet-Versionierung | DB-Timestamps, Logging |

---

## 8. Offene Entscheidungen (für dich)

1. **ORM?** Raw SQL (`pg`), Query-Builder (`knex`), oder ORM (`drizzle`/`prisma`)?
2. **E-Mail-Provider?** SMTP (eigener Server) oder Transactional-Email (Resend, SendGrid)?
3. **Public-Anmeldung**: Soll ein neuer User sich selbst registrieren können, oder nur Admins legen User an?
4. **Host-Wunsch erweitern?** Drei Optionen (`will_host` / `can_host` / `cannot_host`) statt zwei?
5. **Assignment manuell überschreiben?** Sollen Admins die automatische Zuweisung manuell anpassen können?
6. **Frontend-UI**: Simple Tables oder komplexere UI (Drag&Drop für Zuweisung)?