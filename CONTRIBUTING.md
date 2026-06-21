# Contributing to Moving Dinner

Danke für dein Interesse, zum Moving Dinner Projekt beizutragen! Dieser Guide hilft dir, effektiv mitzuarbeiten.

## 🚀 Quick Start

```bash
# Repository klonen
git clone https://github.com/Jaymbo/moving_dinner.git
cd moving_dinner

# Setup ausführen (installiert alle Dependencies, startet Docker)
bash setup.sh

# Backend im Dev-Modus starten
cd backend
npm run dev

# Frontend im Dev-Modus starten (neues Terminal)
cd frontend
npm run dev
```

## 📋 Development Workflow

### 1. Branch erstellen

```bash
git checkout -b feature/mein-feature    # Für neue Features
git checkout -b fix/mein-bugfix         # Für Bugfixes
git checkout -b docs/readme-update      # Für Dokumentation
```

### 2. Änderungen machen

- Folge den [lokalen Regeln](./AGENTS.md) im Projekt
- Halte Commits klein und fokussiert
- Schreibe Tests für neue Funktionalität

### 3. Code prüfen

```bash
# Backend
cd backend
npm run lint
npm run test
npm run build

# Frontend
cd frontend
npm run lint
npm run test
npm run build
```

### 4. Commit erstellen

```bash
git add .
git commit -m "type: kurze Beschreibung"

# Types:
# - feat: Neues Feature
# - fix: Bugfix
# - docs: Dokumentation
# - refactor: Code-Refactoring
# - test: Tests hinzufügen/ändern
# - chore: Build/Tooling
```

### 5. Push und Pull Request

```bash
git push origin feature/mein-feature
```

Erstelle dann einen Pull Request auf GitHub mit:
- Klarer Beschreibung des Changes
- Screenshot bei UI-Änderungen
- Verweis auf Issue (falls vorhanden)

## 🏗️ Architektur-Überblick

```
┌─────────────┐      /api/*       ┌────────────────┐      SQL       ┌──────────┐
│   React     │ ─────────────────> │ Express +      │ <────────────> │ PostgreSQL│
│  (Vite)     │                    │ Prisma backend │                │   16      │
└─────────────┘                    └────────────────┘                └──────────┘
```

- **Frontend:** React 18 + TypeScript + Vite
- **Backend:** Node.js 20 + Express + TypeScript (ESM)
- **Datenbank:** PostgreSQL 16 mit Prisma ORM
- **Testing:** Vitest (Backend: Node, Frontend: jsdom + RTL)

Siehe [ARCHITEKTUR.md](./ARCHITEKTUR.md) für Details.

## 🧪 Testing

### Backend Tests

```bash
cd backend
npm run test           # Alle Tests
npm run test:watch     # Watch mode
```

### Frontend Tests

```bash
cd frontend
npm run test           # Alle Tests
npm run test:watch     # Watch mode
```

## 📝 Code Style

- **Linting:** ESLint (automatisch in CI)
- **Formatting:** Prettier (automatisch in CI)
- **TypeScript:** Strict mode (keine `any` Typen)

### Wichtige Regeln

1. **Keine `any` Typen** – Verwende korrekte TypeScript Typen
2. **Error Handling** – Fange und logge Fehler explizit
3. **Validation** – Validiere alle Eingaben mit Zod
4. **Tests** – Neue Features benötigen Tests

## 🔐 Security

- Keine Secrets im Code (`.env` verwenden)
- JWT Secret muss mind. 32 Zeichen lang sein
- Rate Limiting für Auth-Endpoints
- CORS nur für erlaubte Origins

## 📚 Dokumentation

- API-Endpoints in [ARCHITEKTUR.md](./ARCHITEKTUR.md)
- Typen in `frontend/src/types/api.ts`
- Backend-Validierung in `backend/src/validation/schemas.ts`

## ❓ Fragen?

- Öffne ein Issue auf GitHub
- Lies die existierende Dokumentation
- Schaue dir ähnliche Implementationen im Code an

## 🎯 Aktuelle Prioritäten

Siehe [Issues](https://github.com/Jaymbo/moving_dinner/issues) für offene Tasks.

Besonders hilfreich:
- Testabdeckung erhöhen
- Dokumentation verbessern
- Bugfixes
- Performance-Optimierungen

---

**Danke für deinen Beitrag! 🎉**
