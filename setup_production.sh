#!/bin/bash

################################################################################
# Moving Dinner - Production Setup Script
# 
# Dieses Skript richtet die Production-Umgebung auf einem Server ein.
# NICHT für Development verwenden!
#
# Verwendung: bash setup_production.sh
################################################################################

################################################################################
# ROOT CHECK - MUST RUN AS NON-ROOT USER
################################################################################
if [ "$(id -u)" -eq 0 ] || [ "$(whoami)" = "root" ]; then
    echo ""
    echo -e "\033[0;31m[ERROR] Bitte dieses Skript NICHT als root ausführen!\033[0m"
    echo ""
    echo "  Du führst dieses Skript als root User aus."
    echo "  Das ist ein Sicherheitsrisiko und wird nicht unterstützt."
    echo ""
    echo "  Lösung: Erstelle einen normalen User und führe das Skript damit aus:"
    echo ""
    echo "    # Als root ausführen:"
    echo "    adduser movingdinner"
    echo "    usermod -aG docker movingdinner"
    echo "    su - movingdinner"
    echo "    cd ~/moving_dinner"
    echo "    bash setup_production.sh"
    echo ""
    exit 1
else
    echo -e "\033[0;32m[OK] Root-Check bestanden (User: $(whoami))\033[0m"
    echo "  Skript wird als normaler User ausgeführt - sicher!"
    echo ""
fi

set -e  # Bei Fehlern abbrechen

# Farben für Ausgabe
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

################################################################################
# Helper Functions
################################################################################

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[OK]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_root() {
    # Multiple checks to ensure we're not running as root
    if [ "$EUID" -eq 0 ] || [ "$(id -u)" -eq 0 ] || [ "$(whoami)" = "root" ]; then
        log_error "Bitte dieses Skript NICHT als root ausführen!"
        log_info "Führe es als normaler User aus, der Docker-Berechtigung hat."
        log_info "Falls nötig: sudo usermod -aG docker \$USER && neu einloggen"
        exit 1
    fi
}

check_docker_permission() {
    # Test if current user can run docker without sudo
    if ! docker info &> /dev/null; then
        log_error "Keine Docker-Berechtigung!"
        echo ""
        echo "  Dein User '$(whoami)' kann Docker nicht ausführen."
        echo ""
        echo "  Lösung (als root ausführen):"
        echo "    sudo usermod -aG docker $(whoami)"
        echo "    sudo systemctl restart docker"
        echo ""
        echo "  Danach neu einloggen oder:"
        echo "    newgrp docker"
        echo ""
        exit 1
    fi
}

check_sudo_user() {
    # Warn if user is commonly used for sudo but not recommended
    if [ "$(whoami)" = "admin" ] || [ "$(whoami)" = "ubuntu" ] || [ "$(whoami)" = "deploy" ]; then
        log_warning "User '$(whoami)' wird verwendet."
        log_info "Stelle sicher, dass dieser User persistiert und nicht nur temporär ist."
    fi
}

check_command() {
    if ! command -v "$1" &> /dev/null; then
        log_error "$1 ist nicht installiert. Bitte zuerst installieren."
        exit 1
    fi
}

################################################################################
# Pre-flight Checks
################################################################################

echo ""
echo "=========================================="
echo "  Moving Dinner Production Setup"
echo "=========================================="
echo ""

check_root

log_info "Führe Pre-flight Checks durch..."

# Check Docker permissions FIRST (before checking commands)
check_docker_permission
log_success "Docker-Berechtigung vorhanden (User: $(whoami))"

# Check if using a recommended user
check_sudo_user

# Check required commands
check_command docker
check_command docker-compose

# Check docker is running (already tested in check_docker_permission, but be explicit)
if ! docker info &> /dev/null; then
    log_error "Docker ist nicht laufend. Bitte starte Docker."
    exit 1
fi

log_success "Docker ist installiert und laufend"

# Check if running in project directory
if [ ! -f "docker-compose.yml" ]; then
    log_error "docker-compose.yml nicht gefunden. Bitte Skript im Projektverzeichnis ausführen."
    exit 1
fi

log_success "Projektverzeichnis korrekt"

################################################################################
# Environment Configuration
################################################################################

echo ""
log_info "Erstelle .env Datei für Production..."

if [ -f ".env" ]; then
    log_warning ".env Datei existiert bereits!"
    echo ""
    echo "  Aktuelle Konfiguration:"
    if grep -q "BASE_URL" .env; then
        echo "    BASE_URL: $(grep BASE_URL .env | cut -d'=' -f2)"
    fi
    if grep -q "SMTP_HOST" .env; then
        echo "    SMTP_HOST: $(grep SMTP_HOST .env | cut -d'=' -f2)"
    fi
    echo ""
    read -p "Möchtest du sie überschreiben? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Überspringe .env Erstellung - verwende existierende Konfiguration"
        # Load existing values safely (grep instead of source to avoid shell issues)
        DOMAIN=$(grep "^BASE_URL=" .env | cut -d'=' -f2 | sed 's|https://||')
        SKIP_ENV_CREATION=true
    else
        mv .env .env.backup.$(date +%Y%m%d-%H%M%S)
        log_success "Alte .env gesichert"
        SKIP_ENV_CREATION=false
    fi
else
    SKIP_ENV_CREATION=false
fi

# Generate JWT Secret (only if not skipping)
if [ "$SKIP_ENV_CREATION" = false ]; then
    log_info "Generiere sicheres JWT Secret..."
    JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))" 2>/dev/null || openssl rand -hex 32)

    # Collect user input
    echo ""
    echo "=========================================="
    echo "  Production Konfiguration"
    echo "=========================================="
    echo ""

    # Domain
    read -p "Deine Domain (z.B. moving-dinner.example.com): " DOMAIN
    if [ -z "$DOMAIN" ]; then
        log_error "Domain ist erforderlich!"
        exit 1
    fi
    BASE_URL="https://${DOMAIN}"
else
    # Use existing BASE_URL
    BASE_URL="${BASE_URL:-https://${DOMAIN}}"
fi

# Email Provider (only if not skipping)
if [ "$SKIP_ENV_CREATION" = false ]; then
    echo ""
    log_info "Wähle Email Provider:"
    echo "  1) Resend (100 Emails/Monat gratis, einfach)"
    echo "  2) Brevo (300 Emails/Tag gratis, EU-Server)"
    echo "  3) SendGrid (100 Emails/Tag gratis)"
    echo "  4) Anderer SMTP Provider"
    echo "  5) Keine Emails (nur Testing)"
    read -p "Auswahl (1-5): " EMAIL_CHOICE

    case $EMAIL_CHOICE in
        1)
            SMTP_HOST="smtp.resend.com"
            SMTP_PORT="587"
            SMTP_SECURE="false"
            SMTP_USER="resend"
            read -p "Resend API Key (beginnt mit re_): " SMTP_PASS
            read -p "Absender E-Mail (z.B. noreply@${DOMAIN}): " SMTP_FROM
            ;;
        2)
            SMTP_HOST="smtp-relay.brevo.com"
            SMTP_PORT="587"
            SMTP_SECURE="false"
            read -p "Brevo SMTP Login: " SMTP_USER
            read -p "Brevo SMTP Password: " SMTP_PASS
            read -p "Absender E-Mail: " SMTP_FROM
            ;;
        3)
            SMTP_HOST="smtp.sendgrid.net"
            SMTP_PORT="587"
            SMTP_SECURE="false"
            SMTP_USER="apikey"
            read -p "SendGrid API Key: " SMTP_PASS
            read -p "Absender E-Mail: " SMTP_FROM
            ;;
        4)
            read -p "SMTP Host: " SMTP_HOST
            read -p "SMTP Port (587): " SMTP_PORT
            SMTP_PORT=${SMTP_PORT:-587}
            read -p "SMTP Secure (true/false): " SMTP_SECURE
            SMTP_SECURE=${SMTP_SECURE:-false}
            read -p "SMTP User: " SMTP_USER
            read -p "SMTP Password: " SMTP_PASS
            read -p "Absender E-Mail: " SMTP_FROM
            ;;
        5)
            SMTP_HOST="smtp.example.com"
            SMTP_PORT="587"
            SMTP_SECURE="false"
            SMTP_USER=""
            SMTP_PASS=""
            SMTP_FROM="noreply@localhost"
            log_warning "Email-Versand deaktiviert!"
            ;;
        *)
            log_error "Ungültige Auswahl"
            exit 1
            ;;
    esac

    # Database Password
    echo ""
    log_info "Datenbank Konfiguration..."
    read -p "PostgreSQL Passwort (leer lassen für automatisch generiertes): " DB_PASSWORD
    if [ -z "$DB_PASSWORD" ]; then
        DB_PASSWORD=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 24)
        log_success "Generiertes Datenbank-Passwort: ${DB_PASSWORD}"
    fi

    # Create .env file
    cat > .env << EOF
# Moving Dinner Production Configuration
# Generated: $(date -Iseconds)
# ACHTUNG: Diese Datei enthält sensible Daten! Nicht committen!

# JWT Security (für User Sessions)
JWT_SECRET=${JWT_SECRET}

# Production URL
BASE_URL=${BASE_URL}
NODE_ENV=production

# Database
POSTGRES_USER=movingdinner
POSTGRES_PASSWORD=${DB_PASSWORD}
POSTGRES_DB=movingdinner
DATABASE_URL=postgresql://movingdinner:${DB_PASSWORD}@db:5432/movingdinner?schema=public

# SMTP Email Configuration
SMTP_HOST=${SMTP_HOST}
SMTP_PORT=${SMTP_PORT}
SMTP_SECURE=${SMTP_SECURE}
SMTP_USER=${SMTP_USER}
SMTP_PASS=${SMTP_PASS}
SMTP_FROM=${SMTP_FROM}

# Backend Configuration
PORT=3001
EOF

    log_success ".env Datei erstellt"

    # Secure .env file
    chmod 600 .env
    log_success ".env Berechtigungen gesetzt (nur Owner kann lesen)"
else
    # Load existing values from .env safely
    log_info "Verwende existierende .env Konfiguration"
    DOMAIN=$(grep "^BASE_URL=" .env | cut -d'=' -f2 | sed 's|https://||')
fi

################################################################################
# Docker Compose Configuration
################################################################################

echo ""
log_info "Konfiguriere Docker Compose für Production..."

# Check if override file exists
if [ -f "docker-compose.override.yml" ]; then
    log_success "docker-compose.override.yml vorhanden"
else
    log_warning "docker-compose.override.yml nicht gefunden!"
    log_info "Erstelle Production-Override..."
    
    cat > docker-compose.override.yml << 'EOF'
# Production Resource Limits & Optimizations
services:
  db:
    command: >
      postgres
      -c shared_preload_libraries=pg_stat_statements
      -c pg_stat_statements.max=10000
      -c pg_stat_statements.track=all
      -c work_mem=16MB
      -c maintenance_work_mem=128MB
      -c effective_cache_size=1GB
      -c max_connections=100
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
        reservations:
          cpus: '0.25'
          memory: 256M

  backend:
    environment:
      NODE_ENV: production
      NODE_OPTIONS: "--max-old-space-size=256"
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 256M
        reservations:
          cpus: '0.1'
          memory: 128M

  frontend:
    deploy:
      resources:
        limits:
          cpus: '0.25'
          memory: 64M
        reservations:
          cpus: '0.05'
          memory: 32M
EOF
    
    log_success "docker-compose.override.yml erstellt"
fi

################################################################################
# Build and Deploy
################################################################################

echo ""
log_info "Baue Docker Images..."

docker compose -f docker-compose.yml -f docker-compose.override.yml build

echo ""
log_info "Starte Services..."

docker compose -f docker-compose.yml -f docker-compose.override.yml up -d

# Wait for services to be ready
echo ""
log_info "Warte auf Services (max 60 Sekunden)..."

for i in {1..12}; do
    if docker compose ps | grep -q "healthy\|running"; then
        log_success "Services sind bereit"
        break
    fi
    sleep 5
done

################################################################################
# Health Checks
################################################################################

echo ""
log_info "Führe Health Checks durch..."

# Wait for backend
sleep 10

# Check backend health
if curl -s http://localhost:3002/api/health &> /dev/null; then
    log_success "Backend Health Check OK"
else
    log_warning "Backend Health Check fehlgeschlagen (wird evtl. noch gestartet)"
fi

# Show running containers
echo ""
log_info "Laufende Container:"
docker compose ps

################################################################################
# SSL/HTTPS Setup (Optional)
################################################################################

echo ""
echo "=========================================="
echo "  SSL/HTTPS Konfiguration"
echo "=========================================="
echo ""

log_info "Möchtest du HTTPS mit Let's Encrypt einrichten?"
echo "  Dies benötigt:"
echo "  - Domain zeigt auf diesen Server (A Record)"
echo "  - Ports 80 und 443 müssen offen sein"
echo "  - certbot muss installiert sein"
read -p "HTTPS einrichten? (y/N): " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
    if ! command -v certbot &> /dev/null; then
        log_error "certbot ist nicht installiert. Bitte zuerst installieren:"
        echo "  sudo apt-get install certbot python3-certbot-nginx"
        echo "  oder"
        echo "  sudo yum install certbot python3-certbot-nginx"
        exit 1
    fi
    
    log_info "Fordere SSL Zertifikat an..."
    
    # Stop nginx temporarily if running on port 80
    # This is a simplified approach - adjust based on your setup
    
    certbot certonly --standalone -d "${DOMAIN}" -d "www.${DOMAIN}" \
        --email "admin@${DOMAIN}" --agree-tos --non-interactive
    
    if [ $? -eq 0 ]; then
        log_success "SSL Zertifikat erfolgreich installiert!"
        log_info "Zertifikat-Pfad: /etc/letsencrypt/live/${DOMAIN}/"
        log_info ""
        log_info "Nächste Schritte für HTTPS:"
        log_info "  1. Nginx Konfiguration für SSL anpassen"
        log_info "  2. Certbot Renewal Cronjob einrichten:"
        log_info "     sudo certbot renew --dry-run"
    else
        log_error "SSL Einrichtung fehlgeschlagen!"
        log_info "Manuelle Einrichtung erforderlich"
    fi
fi

################################################################################
# Summary
################################################################################

echo ""
echo "=========================================="
echo "  Setup Zusammenfassung"
echo "=========================================="
echo ""
log_success "Production Setup abgeschlossen!"
echo ""
echo "Wichtige Informationen:"
echo "  - Domain: ${BASE_URL}"
echo "  - Backend: http://localhost:3002"
echo "  - Frontend: http://localhost:3003"
echo ""
echo "Nächste Schritte:"
echo "  1. Admin-Account erstellen (über Web-Interface)"
echo "  2. Firewall konfigurieren (Ports 80, 443, 3002, 3003)"
echo "  3. Domain DNS einrichten (A Record auf Server-IP)"
echo "  4. HTTPS einrichten (wenn noch nicht geschehen)"
echo "  5. Backup-Strategie implementieren"
echo ""
echo "Wichtige Befehle:"
echo "  - Logs ansehen:    docker compose logs -f"
echo "  - Services stoppen: docker compose down"
echo "  - Services neustart: docker compose restart"
echo "  - Update:          git pull && docker compose build && docker compose up -d"
echo ""
echo "Sicherheitshinweise:"
echo "  - .env Datei ist geschützt (chmod 600)"
echo "  - Nicht ins Git committen!"
echo "  - Regelmäßig Updates einspielen"
echo "  - Database Backups einrichten"
echo ""

# Create backup script (only if it doesn't exist, to avoid overwriting customizations)
if [ ! -f "backup.sh" ]; then
    if [ -f ".git/HEAD" ] && git ls-files --error-unmatch backup.sh &>/dev/null; then
        # backup.sh is tracked by git, just ensure it's executable
        chmod +x backup.sh
        log_success "Backup-Skript aus Git aktualisiert (backup.sh)"
    else
        log_error "backup.sh nicht gefunden und nicht in Git verfolgt."
        log_info "Bitte stelle sicher, dass backup.sh im Projektverzeichnis liegt."
        exit 1
    fi
else
    chmod +x backup.sh
    log_success "Backup-Skript vorhanden (backup.sh)"
fi

# Create backup config example if missing
if [ ! -f "backup.config" ]; then
    if [ -f "backup.config.example" ]; then
        cp backup.config.example backup.config
        log_success "Backup-Konfiguration erstellt (backup.config)"
        log_info "Passe backup.config an, um Remote-Backups zu aktivieren."
    else
        log_warning "backup.config.example nicht gefunden."
    fi
else
    log_info "Backup-Konfiguration bereits vorhanden (backup.config)"
fi

log_info "Empfohlen: Backup-Cronjob einrichten"
echo "  Beispiel (täglich um 3:00 Uhr):"
echo "  0 3 * * * cd $(pwd) && ./backup.sh >> logs/backup-cron.log 2>&1"
echo ""
echo "  Manuelles Backup testen:"
echo "    ./backup.sh"
echo "  Backup verifizieren:"
echo "    ./backup.sh verify"
echo "  Backup wiederherstellen (VORSICHT):"
echo "    ./backup.sh restore backups/backup-YYYYMMDD-HHMMSS.sql.gz"

echo ""
log_success "Viel Erfolg mit deiner Moving Dinner Installation! 🎉"
echo ""
