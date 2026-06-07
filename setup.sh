#!/usr/bin/env bash
set -euo pipefail

# ============================================================
#  Moving Dinner – Setup-Script
#  Frisch nach `git clone` ausführen:  bash setup.sh
# ============================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

info()  { echo -e "${CYAN}ℹ️  $1${NC}"; }
ok()    { echo -e "${GREEN}✅ $1${NC}"; }
warn()  { echo -e "${YELLOW}⚠️  $1${NC}"; }
err()   { echo -e "${RED}❌ $1${NC}"; }

# ----------------------------------------------------------
# 1) Bestehende Container stoppen
# ----------------------------------------------------------
info "Stoppe vorhandene Container …"
docker compose down --remove-orphans 2>/dev/null || true
ok "Container gestoppt"

# ----------------------------------------------------------
# 2) Images neu bauen
# ----------------------------------------------------------
info "Baue Docker-Images (Backend & Frontend) …"
docker compose build
ok "Images gebaut"

# ----------------------------------------------------------
# 3) Services starten
# ----------------------------------------------------------
info "Starte alle Services …"
docker compose up -d
ok "Container gestartet"

# ----------------------------------------------------------
# 4) Warten bis die Datenbank bereit ist
# ----------------------------------------------------------
info "Warte auf Datenbank (Healthcheck) …"
MAX_WAIT=60
WAITED=0
until docker compose exec db pg_isready -U movingdinner > /dev/null 2>&1; do
  WAITED=$((WAITED + 1))
  if [ "$WAITED" -ge "$MAX_WAIT" ]; then
    err "Datenbank ist nach ${MAX_WAIT}s nicht bereit – Abbruch"
    docker compose logs db
    exit 1
  fi
  sleep 1
done
ok "Datenbank ist bereit"

# ----------------------------------------------------------
# 5) Warten bis das Backend migriert & geseedet hat
# ----------------------------------------------------------
info "Warte auf Backend (Migration + Seed) …"
MAX_WAIT=90
WAITED=0
until curl -sf http://localhost:3001/ > /dev/null 2>&1; do
  WAITED=$((WAITED + 1))
  if [ "$WAITED" -ge "$MAX_WAIT" ]; then
    err "Backend antwortet nach ${MAX_WAIT}s nicht – Abbruch"
    docker compose logs backend
    exit 1
  fi
  sleep 1
done
ok "Backend ist bereit"

# ----------------------------------------------------------
# 6) Lokale Abhängigkeiten für IDE-Support installieren
# ----------------------------------------------------------
info "Installiere lokale Abhängigkeiten (Frontend) …"
(cd frontend && npm install)
ok "Frontend-Abhängigkeiten installiert"

info "Installiere lokale Abhängigkeiten (Backend) …"
(cd backend && npm install)
ok "Backend-Abhängigkeiten installiert"

# ----------------------------------------------------------
# 7) Fertig!
# ----------------------------------------------------------
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  🎉  Moving Dinner ist bereit!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  ${CYAN}Frontend:${NC}  http://localhost:3000"
echo -e "  ${CYAN}Backend:${NC}   http://localhost:3001"
echo -e "  ${CYAN}DB:${NC}        postgresql://movingdinner:movingdinner@localhost:5432/movingdinner"
echo -e "  ${CYAN}DB-Dateien:${NC} ./data/db/ (liegen auf dem Host)"
echo ""
echo -e "  ${YELLOW}Demo-Accounts (aus Seed):${NC}"
echo -e "    Admin:  admin@example.com / admin123  (SuperAdmin)"
echo -e "    User:   anna@example.com / demo123"
echo -e "    … usw."
echo ""
echo -e "  ${CYAN}Prisma Studio:${NC}  cd backend && npx prisma studio"
echo ""
echo -e "  ${YELLOW}Datenbank komplett zurücksetzen?${NC}"
echo -e "    docker compose down"
echo -e "    rm -rf ./data/db"
echo -e "    docker compose up -d"
echo ""