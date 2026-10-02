#!/usr/bin/env bash
# ==============================================================================
# Unique Jersey Wholesale — Database Restore Verification Script (DEPLOY-004)
# ==============================================================================
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 <path_to_backup_file.sql.gz>"
  echo "Example: $0 /tmp/backups/ujw_db_backup_20261002_120000.sql.gz"
  exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "${BACKUP_FILE}" ]; then
  echo "Error: Backup file does not exist at '${BACKUP_FILE}'"
  exit 1
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting database restore verification from ${BACKUP_FILE}..."

# Decompress and stream to PostgreSQL
gunzip -c "${BACKUP_FILE}" | PGPASSWORD="${DB_PASSWORD}" psql \
  -h "${DB_HOST}" \
  -p "${DB_PORT:-5432}" \
  -U "${DB_USERNAME}" \
  -d "${DB_DATABASE}" \
  --single-transaction \
  --set ON_ERROR_STOP=on

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Database restore completed successfully."
