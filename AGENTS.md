# Repository Overview

## Project Description

**Moving Dinner** is a web application for organizing "moving dinner" events: participants meet for a multi-course meal where each course is hosted at a different home. The system manages groups, meetings, RSVPs, host assignments, scoring, and email notifications.

- **Main purpose:** Coordinate group dinners, collect host preferences, assign guests to hosts fairly, and notify participants via email.
- **Key technologies:**
  - **Frontend:** React 18 + TypeScript + Vite
  - **Backend:** Node.js + Express + TypeScript
  - **Database:** PostgreSQL 16
  - **ORM:** Prisma
  - **Email:** Nodemailer via SMTP relay (e.g., Resend)
  - **Containerization:** Docker Compose (frontend + backend + database)

## Architecture Overview

```
┌─────────────┐      /api/*       ┌────────────────┐      SQL       ┌──────────┐
│   React     │ ─────────────────> │ Express +      │ <────────────> │ PostgreSQL│
│  (Vite)     │                    │ Prisma backend │                │   16      │
└─────────────┘                    └────────────────┘                └──────────┘
        │                                  │
        │ nginx (prod)                     │ node-cron jobs
        └──────────────────────────────────┘ deadline reminders, freeze,
                                             token cleanup
```

### Main Components

- **Frontend (`frontend/`):** Single-page React app with client-side routing (`react-router-dom`). Uses a central API client in `src/api/client.ts` and an `AuthContext` for authentication state.
- **Backend (`backend/`):** REST API built with Express. Routes are grouped by domain (`auth`, `users`, `groups`, `meetings`, `rsvp`, `assignment`, `admin`, `feature-requests`).
- **Database (`backend/prisma/schema.prisma`):** Relational PostgreSQL schema with Prisma migrations. Core entities: `User`, `Group`, `GroupMember`, `Meeting`, `Response`, `RsvpToken`, `Score`, `MeetupMatrix`, `FeatureRequest`, `PasswordResetToken`.
- **Services (`backend/src/services/`):** Business logic including scoring (`scoring.ts`), assignment algorithm (`assignment.ts`), RSVP handling (`rsvp.ts`), email (`email.ts`), and meetup matrix (`matrix.ts`).
- **Jobs (`backend/src/jobs/`):** Cron jobs for deadline reminders, deadline processing/freezing, and expired RSVP-token cleanup.

### Data Flow

1. Users authenticate via JWT (`/api/auth/login` or `/api/auth/register`).
2. Frontend stores token in `localStorage` and sends it in `Authorization: Bearer <token>` headers.
3. Middleware validates JWT and enforces role/group permissions.
4. Routes use Prisma to read/write data.
5. Cron jobs periodically process deadlines, send reminders, and clean up tokens.

## Directory Structure

```
.
├── backend/
│   ├── src/
│   │   ├── index.ts              # Express app setup, route mounting
│   │   ├── config.ts             # Environment-based configuration
│   │   ├── db.ts                 # PrismaClient singleton
│   │   ├── routes/               # Express route handlers
│   │   ├── services/             # Core business logic
│   │   ├── middleware/           # Auth and group-auth middleware
│   │   └── jobs/                 # Cron job definitions
│   ├── prisma/
│   │   ├── schema.prisma         # Database schema
│   │   ├── migrations/           # Prisma migrations
│   │   └── seed.ts               # Demo/seed data
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.tsx               # Router + layout
│   │   ├── main.tsx              # React entry point
│   │   ├── api/client.ts         # HTTP client + API methods
│   │   ├── context/AuthContext.tsx # Auth state
│   │   ├── pages/                # Route components
│   │   ├── components/           # Shared UI components
│   │   └── index.css             # Global styles
│   ├── Dockerfile
│   ├── nginx.conf                # Production nginx config
│   └── package.json
├── docker-compose.yml            # Full stack orchestration
├── setup.sh                      # One-command local setup
└── ARCHITEKTUR.md                # Detailed German architecture notes
```

### Key Entry Points

- **Backend dev:** `backend/src/index.ts`
- **Backend prod:** `backend/dist/index.js`
- **Frontend dev:** `frontend/src/main.tsx`
- **Frontend prod:** nginx serves `frontend/dist`

## Development Workflow

### Quick Start

Run the full stack locally:

```bash
bash setup.sh
```

This builds Docker images, starts containers, waits for the database, runs migrations and seeds, and installs local `node_modules` for IDE support.

After setup:

- Frontend: http://localhost:3003
- Backend: http://localhost:3002
- DB: `postgresql://movingdinner:movingdinner@localhost:5432/movingdinner`

Demo accounts (from seed):

- Admin: `admin@example.com` / `admin123` (SuperAdmin)
- User: `anna@example.com` / `demo123`

### Manual Commands

Backend:

```bash
cd backend
npm install
npm run dev              # tsx watch on src/index.ts
npm run build            # tsc -> dist/
npm run db:migrate       # prisma migrate dev
npm run db:seed          # run seed script
npx prisma studio        # open Prisma Studio
```

Frontend:

```bash
cd frontend
npm install
npm run dev              # Vite dev server on port 3000
npm run build            # tsc + vite build
npm run preview          # preview production build
```

Full stack with Docker Compose:

```bash
docker compose up -d     # start all services
docker compose down      # stop
```

### Testing

There are currently **no automated tests** configured in this repository. When adding tests, prefer:

- **Backend:** Vitest or Jest for unit tests, `prisma` test helpers for integration tests.
- **Frontend:** Vitest + React Testing Library (React Testing Library is not installed yet).

### Lint and Format

- **Frontend ESLint:** `cd frontend && npx eslint src --ext .ts,.tsx`
  - Config in `frontend/eslint.config.js`
  - Uses `@eslint/js`, `typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`
  - `no-explicit-any` is currently disabled; unused vars warn only.
- **Backend ESLint:** not configured.
- **Formatter:** Prettier is not configured. Consider adding a shared Prettier config.

### Important Configuration

- Environment variables are loaded via `backend/src/config.ts`.
- Required backend env vars: `DATABASE_URL`, `JWT_SECRET`, `SMTP_*`, `BASE_URL`.
- Defaults in `docker-compose.yml` point to local services and placeholder SMTP credentials.
- **Do not commit `.env` or production secrets.** They are excluded in `.gitignore`.

### Common Gotchas

- Backend `tsconfig.json` only includes `src/`. The seed script and import scripts are compiled separately when needed.
- Frontend Vite dev server proxies `/api` to `http://localhost:3002`; production uses nginx to proxy `/api` to the backend container.
- The assignment algorithm is deterministic and ported from a Google Apps Script; it uses a custom tie-breaker hash.
- Super-admins bypass all group-level permission checks.
