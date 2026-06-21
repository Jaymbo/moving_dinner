# Repository Overview

## Project Description

**Moving Dinner** is a web application for organizing "moving dinner" events: participants meet for a multi-course meal where each course is hosted at a different home. The system coordinates groups, meetings, RSVPs, host assignments, scoring, and email notifications.

- **Main purpose:** Coordinate group dinners, collect host preferences, assign guests to hosts fairly, and notify participants via email.
- **Key technologies:**
  - **Frontend:** React 18 + TypeScript + Vite
  - **Backend:** Node.js 20 + Express + TypeScript (ESM)
  - **Database:** PostgreSQL 16
  - **ORM:** Prisma 6
  - **Validation:** Zod
  - **Email:** Nodemailer via SMTP relay (e.g., Resend)
  - **Containerization:** Docker Compose (frontend + backend + database)
  - **Testing:** Vitest (backend Node env, frontend jsdom + React Testing Library)

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

- **Frontend (`frontend/`):** Single-page React app with client-side routing (`react-router-dom`). Uses a central API client in `src/api/client.ts`, shared types in `src/types/api.ts`, and an `AuthContext` for authentication state.
- **Backend (`backend/`):** REST API built with Express. Routes are grouped by domain (`auth`, `users`, `groups`, `meetings`, `responses`, `rsvp`, `assignment`, `admin`, `public`, `feature-requests`, `join`).
- **Database (`backend/prisma/schema.prisma`):** Relational PostgreSQL schema with Prisma migrations. Core entities: `User`, `Group`, `GroupMember`, `GroupInvitation`, `Meeting`, `Response`, `RsvpToken`, `Score`, `MeetupMatrix`, `FeatureRequest`, `PasswordResetToken`.
- **Services (`backend/src/services/`):** Business logic including scoring (`scoring.ts`), assignment algorithm (`assignment.ts`), RSVP handling (`rsvp.ts`), email (`email.ts`), and meetup matrix (`matrix.ts`).
- **Middleware (`backend/src/middleware/`):** JWT auth (`auth.ts`), group-based authorization (`groupAuth.ts`), input validation with Zod (`validate.ts`), security hardening (`security.ts`), async error wrapping (`asyncHandler.ts`), and centralized error handling (`errorHandler.ts`).
- **Validation (`backend/src/validation/`):** Shared Zod schemas (`schemas.ts`, `common.ts`) used by route handlers.
- **Jobs (`backend/src/jobs/`):** Cron jobs for deadline reminders, deadline processing/freezing, and expired token cleanup.

### Data Flow

1. Users authenticate via JWT (`/api/auth/login` or `/api/auth/register`).
2. Frontend stores token in `localStorage` and sends it in `Authorization: Bearer <token>` headers.
3. Middleware validates JWT and enforces role/group permissions.
4. Routes use Prisma to read/write data.
5. Cron jobs periodically process deadlines, send reminders, and clean up tokens.
6. After RSVPs or deadline processing, `assignHosts()` computes fair host assignments and writes `assignedHost` to responses.

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
│   │   ├── middleware/           # Auth, validation, security, errors
│   │   ├── validation/           # Zod schemas
│   │   ├── utils/                # Logger, helpers
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
│   │   ├── types/api.ts          # Shared API/frontend types
│   │   ├── context/AuthContext.tsx # Auth state
│   │   ├── pages/                # Route components
│   │   ├── components/           # Shared UI components
│   │   └── test/setup.ts         # Vitest setup
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
- **Prisma schema:** `backend/prisma/schema.prisma`
- **API client:** `frontend/src/api/client.ts`
- **Shared types:** `frontend/src/types/api.ts`

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
npm run dev              # tsx watch on src/index.ts (port 3001)
npm run build            # tsc -> dist/
npm run start            # node dist/index.js
npm run lint             # ESLint --max-warnings=0
npm run lint:fix         # ESLint with auto-fix
npm run format           # Prettier
npm run test             # Vitest
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
npm run lint             # ESLint --max-warnings=0
npm run lint:fix         # ESLint with auto-fix
npm run format           # Prettier
npm run format:check     # Prettier check
npm run test             # Vitest + jsdom + React Testing Library
```

Full stack with Docker Compose:

```bash
docker compose up -d     # start all services
docker compose down      # stop
```

### Testing

- **Backend:** Vitest with Node environment. Example test under `backend/src/utils/logger.test.ts`.
- **Frontend:** Vitest + jsdom + React Testing Library. Setup in `frontend/src/test/setup.ts`.

There are no integration tests yet; new business logic and critical routes should be covered.

### Lint and Format

- **Frontend ESLint:** `cd frontend && npm run lint`
  - Config in `frontend/eslint.config.js`
  - Uses `@eslint/js`, `typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`
  - `no-explicit-any` is currently disabled; unused vars warn only.
- **Backend ESLint:** `cd backend && npm run lint`
  - Config in `backend/eslint.config.js`
  - Uses `@eslint/js`, `typescript-eslint`, `globals`
  - `no-explicit-any` warns; unused vars warn only.
- **Formatter:** Prettier is configured per project (`backend/.prettierrc`, `frontend/.prettierrc`), not in the root.

### Important Configuration

- Environment variables are loaded via `backend/src/config.ts`.
- Required backend env vars: `DATABASE_URL`, `JWT_SECRET` (min 32 chars), `SMTP_*`, `BASE_URL`.
- Defaults in `docker-compose.yml` point to local services and placeholder SMTP credentials.
- **Do not commit `.env` or production secrets.** They are excluded in `.gitignore`.

### Common Gotchas

- Backend `tsconfig.json` only includes `src/`. The seed script and import scripts are compiled separately when needed.
- Frontend Vite dev server proxies `/api` to `http://localhost:3002`; production uses nginx to proxy `/api` to the backend container.
- The assignment algorithm is deterministic and ported from a Google Apps Script; it uses a custom tie-breaker hash.
- Super-admins bypass all group-level permission checks.
- JWT tokens expire after 30 days.
- Meeting creation permissions depend on `group.meetingCreation` (`admin` or `all`).
