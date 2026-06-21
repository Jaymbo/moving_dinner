#!/bin/bash

################################################################################
# Moving Dinner - Database Backup Script
#
# Erstellt ein komprimiertes PostgreSQL-Backup und rotiert alte Backups lokal.
# Optional kann ein Remote-Ziel (rsync, SSH, S3-kompatibel) konfiguriert werden.
#
# Verwendung:
#   ./backup.sh                 # Normales Backup
#   ./backup.sh verify          # Letztes Backup auf Integrität prüfen
#   ./backup.sh restore FILE    # Backup in die laufende DB restoren (VORSICHT!)
#
# Cronjob-Beispiel (täglich um 3:00 Uhr):
#   0 3 * * * cd /pfad/zu/moving_dinner && ./backup.sh >> logs/backup.log 2>&1
################################################################################

set -euo pipefail

# -----------------------------------------------------------------------------
# Konfiguration
# -----------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="${SCRIPT_DIR}/backups"
LOG_DIR="${SCRIPT_DIR}/logs"
CONFIG_FILE="${SCRIPT_DIR}/backup.config"
RETENTION_DAYS=14
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_NAME="backup-${TIMESTAMP}.sql.gz"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_NAME}"

mkdir -p "${BACKUP_DIR}" "${LOG_DIR}"

LOG_FILE="${LOG_DIR}/backup-${TIMESTAMP}.log"
exec > >(tee -a "${LOG_FILE}") 2>&1

# -----------------------------------------------------------------------------
# Helper Functions
# -----------------------------------------------------------------------------
log_info() {
    echo "[$(date -Iseconds)] [INFO] $1"
}

log_warn() {
    echo "[$(date -Iseconds)] [WARN] $1"
}

log_error() {
    echo "[$(date -Iseconds)] [ERROR] $1"
}

# Load optional backup config
if [ -f "${CONFIG_FILE}" ]; then
    # shellcheck source=/dev/null
    source "${CONFIG_FILE}"
    log_info "Konfiguration geladen: ${CONFIG_FILE}"
fi

# Determine compose command (v2 preferred)
if docker compose version &>/dev/null; then
    COMPOSE_CMD="docker compose"
elif docker-compose version &>/dev/null; then
    COMPOSE_CMD="docker-compose"
else
    log_error "Docker Compose nicht gefunden."
    exit 1
fi

# Determine database container name (robust against service name changes)
DB_CONTAINER=$(${COMPOSE_CMD} ps -q db 2>/dev/null | head -n 1)
if [ -z "${DB_CONTAINER}" ]; then
    log_error "Datenbank-Container 'db' nicht gefunden. Laufen die Services?"
    exit 1
fi

DB_USER="${POSTGRES_USER:-movingdinner}"
DB_NAME="${POSTGRES_DB:-movingdinner}"

# -----------------------------------------------------------------------------
# Verify Command
# -----------------------------------------------------------------------------
verify_backup() {
    local target_file="${1:-}"

    if [ -z "${target_file}" ]; then
        target_file=$(ls -t "${BACKUP_DIR}"/*.sql.gz 2>/dev/null | head -n 1)
        if [ -z "${target_file}" ]; then
            log_error "Kein Backup zur Verifikation gefunden."
            exit 1
        fi
    fi

    log_info "Prüfe Backup-Integrität: ${target_file}"

    if [ ! -f "${target_file}" ]; then
        log_error "Datei nicht gefunden: ${target_file}"
        exit 1
    fi

    if ! gzip -t "${target_file}"; then
        log_error "Backup ist beschädigt oder ungültig: ${target_file}"
        exit 1
    fi

    # Quick parse test: count tables/entries
    local table_count
    table_count=$(gzip -dc "${target_file}" | grep -c "^CREATE TABLE" || true)
    log_info "Backup OK. Enthält ca. ${table_count} CREATE TABLE Statements."
}

# -----------------------------------------------------------------------------
# Restore Command
# -----------------------------------------------------------------------------
restore_backup() {
    local target_file="${1:-}"

    if [ -z "${target_file}" ] || [ ! -f "${target_file}" ]; then
        log_error "Gültige Backup-Datei angeben. Verwendung: ./backup.sh restore <datei.sql.gz>"
        exit 1
    fi

    log_warn "Dies überschreibt die aktuelle Datenbank '${DB_NAME}'!"
    read -r -p "Wirklich fortfahren? (ja/NEIN): " confirm
    if [ "${confirm}" != "ja" ]; then
        log_info "Restore abgebrochen."
        exit 0
    fi

    log_info "Starte Restore aus ${target_file}..."

    # Stop backend to avoid concurrent writes during restore
    ${COMPOSE_CMD} stop backend || log_warn "Backend konnte nicht gestoppt werden."

    gzip -dc "${target_file}" | ${COMPOSE_CMD} exec -T db psql -U "${DB_USER}" -d "${DB_NAME}"

    ${COMPOSE_CMD} start backend || log_warn "Backend konnte nicht gestartet werden."

    log_info "Restore abgeschlossen."
}

# -----------------------------------------------------------------------------
# Backup Command
# -----------------------------------------------------------------------------
run_backup() {
    log_info "Starte Datenbank-Backup: ${BACKUP_NAME}"

    ${COMPOSE_CMD} exec -T db pg_dump -U "${DB_USER}" "${DB_NAME}" | gzip > "${BACKUP_PATH}"

    local size
    size=$(du -h "${BACKUP_PATH}" | cut -f1)
    log_info "Backup erstellt: ${BACKUP_PATH} (${size})"

    verify_backup "${BACKUP_PATH}"

    # Remote sync (optional)
    if [ -n "${REMOTE_SYNC_TARGET:-}" ]; then
        log_info "Kopiere Backup zu Remote-Ziel: ${REMOTE_SYNC_TARGET}"
        rsync -avz --delete "${BACKUP_PATH}" "${REMOTE_SYNC_TARGET}/" || log_warn "Remote-Sync fehlgeschlagen"
    fi

    if [ -n "${S3_ENDPOINT:-}" ] && [ -n "${S3_BUCKET:-}" ] && command -v s3cmd &>/dev/null; then
        log_info "Lade Backup zu S3-Bucket: ${S3_BUCKET}"
        s3cmd put "${BACKUP_PATH}" "s3://${S3_BUCKET}/" || log_warn "S3-Upload fehlgeschlagen"
    fi

    # Rotate old local backups
    log_info "Rotiere lokale Backups (behalte letzte ${RETENTION_DAYS} Tage)..."
    find "${BACKUP_DIR}" -type f -name 'backup-*.sql.gz' -mtime +${RETENTION_DAYS} -delete || true

    local backup_count
    backup_count=$(find "${BACKUP_DIR}" -type f -name 'backup-*.sql.gz' | wc -l)
    log_info "Backup abgeschlossen. Aktuell vorhanden: ${backup_count} lokale Backups."
}

# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------
case "${1:-backup}" in
    backup)
        run_backup
        ;;
    verify)
        verify_backup "${2:-}"
        ;;
    restore)
        restore_backup "${2:-}"
        ;;
    *)
        echo "Verwendung: $0 [backup|verify|restore DATEI]"
        exit 1
        ;;
esac
