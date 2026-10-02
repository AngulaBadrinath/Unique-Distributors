#!/usr/bin/env bash
# ==============================================================================
# Unique Jersey Wholesale — Automated Database Backup Script (DEPLOY-004)
# ==============================================================================
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/tmp/backups}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILENAME="ujw_db_backup_${TIMESTAMP}.sql.gz"
BACKUP_FILEPATH="${BACKUP_DIR}/${BACKUP_FILENAME}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

mkdir -p "${BACKUP_DIR}"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting automated database backup..."

# Execute pg_dump with compression
PGPASSWORD="${DB_PASSWORD}" pg_dump \
  -h "${DB_HOST}" \
  -p "${DB_PORT:-5432}" \
  -U "${DB_USERNAME}" \
  -d "${DB_DATABASE}" \
  --format=plain \
  --no-owner \
  --no-acl \
  | gzip -9 > "${BACKUP_FILEPATH}"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Local backup created: ${BACKUP_FILEPATH}"

# Sync to private S3 bucket if configured
if [ -n "${AWS_BACKUP_BUCKET:-}" ]; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Uploading backup to S3 bucket: s3://${AWS_BACKUP_BUCKET}/backups/postgres/${BACKUP_FILENAME}"
  aws s3 cp "${BACKUP_FILEPATH}" "s3://${AWS_BACKUP_BUCKET}/backups/postgres/${BACKUP_FILENAME}" --sse AES256
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] S3 upload complete."
fi

# Cleanup local backups older than RETENTION_DAYS
find "${BACKUP_DIR}" -name "ujw_db_backup_*.sql.gz" -type f -mtime +"${RETENTION_DAYS}" -exec rm -f {} +
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Cleanup of backups older than ${RETENTION_DAYS} days complete."
