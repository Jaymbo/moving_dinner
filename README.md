# Moving Dinner

Webanwendung zur Organisation von "Moving Dinner"-Events: Teilnehmende treffen sich zu einem mehrgängigen Menü, bei dem jeder Gang bei einem anderen Gastgeber stattfindet.

## Tech-Stack

| Schicht | Technologie |
|---------|-------------|
| Frontend | React 18 + TypeScript + Vite |
| Backend | Node.js 20 + Express + TypeScript (ESM) |
| Datenbank | PostgreSQL 16 |
| ORM | Prisma |
| E-Mail | Nodemailer über SMTP-Relay (z. B. Resend) |
| Container | Docker Compose |

## Schnellstart

Voraussetzungen: Docker + Docker Compose

```bash
bash setup.sh
```

Danach erreichbar unter:

- Frontend: http://localhost:3003
- Backend: http://localhost:3002
- API Health: http://localhost:3002/api/health

Demo-Accounts (aus `backend/prisma/seed.ts`):

- Admin: `admin@example.com` / `admin123`
- User: `anna@example.com` / `demo123`

## Manuelle Entwicklung

### Backend

```bash
cd backend
npm install
npm run dev        # tsx watch auf src/index.ts (Port 3001)
npm run build      # tsc -> dist/
npm run start      # node dist/index.js
npm run lint       # ESLint
npm run lint:fix   # ESLint mit Auto-Fix
npm run format     # Prettier
npm run test       # Vitest
npm run db:migrate # Prisma migrate dev
npm run db:seed    # Demo-Daten
```

### Frontend

```bash
cd frontend
npm install
npm run dev        # Vite Dev-Server (Port 3000)
npm run build      # TypeScript + Vite Build
npm run lint       # ESLint
npm run lint:fix   # ESLint mit Auto-Fix
npm run format     # Prettier
npm run format:check # Prettier Check
npm run test       # Vitest + jsdom + React Testing Library
```

## Wichtige Konfiguration

Backend-Umgebungsvariablen (mindestens):

```env
DATABASE_URL=postgresql://movingdinner:movingdinner@localhost:5432/movingdinner?schema=public
JWT_SECRET=mindestens-32-zeichen-langer-sicherer-wert
SMTP_HOST=smtp.resend.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=resend
SMTP_PASS=dein-api-key
SMTP_FROM=Moving Dinner <noreply@example.com>
BASE_URL=http://localhost:3000
```

**Wichtig:** `JWT_SECRET` muss mindestens 32 Zeichen lang sein. Im Docker-Compose ist ein Default gesetzt, der für die Entwicklung reicht, aber in Produktion unbedingt geändert werden muss.

## Projektstruktur

```
.
├── backend/
│   ├── src/                 # Express API
│   ├── prisma/              # Schema, Migrations, Seed
│   ├── prisma.config.ts     # Prisma-Konfiguration
│   ├── eslint.config.js     # ESLint (Flat Config)
│   └── vitest.config.ts     # Testkonfiguration
├── frontend/
│   ├── src/                 # React App
│   ├── vite.config.ts       # Vite + Vitest Konfiguration
│   └── eslint.config.js     # ESLint (Flat Config)
├── docker-compose.yml
└── ARCHITEKTUR.md           # Detaillierte Architektur (deutsch)
```

## Formatierung & Linting

Beide Projekte verwenden:

- **Prettier** mit identischer Konfiguration (`.prettierrc`)
- **ESLint** mit TypeScript-Support

Prettier-Konfiguration liegt jeweils im Projektordner (`backend/.prettierrc`, `frontend/.prettierrc`), nicht im Root.

## Tests

- **Backend:** Vitest mit Node-Umgebung. Beispieltest unter `backend/src/utils/logger.test.ts`.
- **Frontend:** Vitest + jsdom + React Testing Library. Beispieltest unter `frontend/src/components/ui/Card.test.tsx`.

## Sicherheit

Das Backend verwendet:

- `helmet` für Security-Header
- `express-rate-limit` für Rate-Limiting (verschärft auf Auth-Routen)
- `cors` mit konfigurierbaren Origins
- Zentrale Fehlerbehandlung via `errorHandler`-Middleware
- Eingabevalidierung mit Zod

## Lizenz

Privates Projekt – keine öffentliche Lizenz.
