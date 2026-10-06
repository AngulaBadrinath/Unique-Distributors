#!/usr/bin/env bash
# ==============================================================================
# Unique Jersey Wholesale (UJW) — Production Deployment Script
# Target: AWS EC2 (/var/www/ujw)
# Invocation: SSM Run Command via GitHub Actions CD
# ==============================================================================

set -euo pipefail

TARGET_SHA="${1:-}"

if [[ -z "$TARGET_SHA" ]]; then
    echo "[ERROR] Target commit SHA must be supplied as first argument." >&2
    exit 1
fi

APP_DIR="/var/www/ujw"

echo "================================================================="
echo "Starting UJW Production Deployment"
echo "Timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo "Target Commit SHA: ${TARGET_SHA}"
echo "Application Directory: ${APP_DIR}"
echo "Executing User: $(whoami)"
echo "================================================================="

# Verify application directory exists
if [[ ! -d "$APP_DIR" ]]; then
    echo "[ERROR] Target directory ${APP_DIR} does not exist." >&2
    exit 1
fi

cd "$APP_DIR"

# 1. Verify Git Repository State
if [[ ! -d ".git" ]]; then
    echo "[ERROR] ${APP_DIR} is not a valid Git repository." >&2
    exit 1
fi

# Ensure working tree is clean (reconcile any script filemode differences first)
git checkout -- scripts/deploy-production.sh scripts/run-ssm-deployment.sh 2>/dev/null || true
DIRTY_FILES=$(git status --porcelain)
if [[ -n "$DIRTY_FILES" ]]; then
    echo "[ERROR] Working tree is dirty. Refusing deployment to prevent data loss." >&2
    echo "$DIRTY_FILES" >&2
    exit 1
fi

# Verify current branch is main
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [[ "$CURRENT_BRANCH" != "main" ]]; then
    echo "[ERROR] Current branch is '${CURRENT_BRANCH}', expected 'main'. Aborting." >&2
    exit 1
fi

# 2. Fetch Origin and Validate Target SHA
echo "Fetching latest changes from origin..."
git fetch origin main --tags

# Verify target commit exists in repository
if ! git cat-file -e "${TARGET_SHA}^{commit}" 2>/dev/null; then
    echo "[ERROR] Target commit SHA ${TARGET_SHA} not found in repository." >&2
    exit 1
fi

# Verify fast-forward safety (target SHA must be a descendant of or equal to HEAD)
if ! git merge-base --is-ancestor HEAD "${TARGET_SHA}"; then
    echo "[ERROR] Target commit ${TARGET_SHA} is not a direct descendant of HEAD ($(git rev-parse HEAD)). Refusing non-fast-forward deployment." >&2
    exit 1
fi

# Fast-forward to target commit
echo "Fast-forwarding repository to ${TARGET_SHA}..."
git merge --ff-only "${TARGET_SHA}"

DEPLOYED_SHA=$(git rev-parse HEAD)
echo "Repository successfully updated to SHA: ${DEPLOYED_SHA}"

# 3. Backend Dependencies
echo "Installing backend dependencies (Composer)..."
composer install --no-dev --prefer-dist --optimize-autoloader --no-interaction

# 4. Frontend Dependencies & Build
echo "Installing frontend dependencies (npm ci)..."
npm ci --no-audit --prefer-offline

echo "Building frontend production assets (Vite)..."
npm run build

# 5. Database Migrations
echo "Applying database migrations (php artisan migrate --force)..."
php artisan migrate --force

# 6. Rebuild Laravel Caches
echo "Clearing and rebuilding application caches..."
php artisan optimize:clear
php artisan config:cache
php artisan route:cache
php artisan view:cache

# 7. Queue Worker Recycling
echo "Restarting Laravel queue workers..."
php artisan queue:restart

# 8. Post-Deployment Health & Readiness Checks
echo "Performing local health and readiness verification..."
sleep 2

HEALTH_RESPONSE=$(curl -fsS --max-time 15 https://uniquejerseywholesale.com/health || curl -fsS --max-time 15 -H "Host: uniquejerseywholesale.com" http://127.0.0.1/health || {
    echo "[ERROR] /health check failed." >&2
    exit 1
})
echo "Health Check OK: ${HEALTH_RESPONSE}"

READY_RESPONSE=$(curl -fsS --max-time 15 https://uniquejerseywholesale.com/ready || curl -fsS --max-time 15 -H "Host: uniquejerseywholesale.com" http://127.0.0.1/ready || {
    echo "[ERROR] /ready check failed (PostgreSQL/Redis/Storage degraded)." >&2
    exit 1
})
echo "Readiness Check OK: ${READY_RESPONSE}"

echo "================================================================="
echo "UJW Production Deployment COMPLETED SUCCESSFULLY"
echo "Deployed SHA: ${DEPLOYED_SHA}"
echo "Finished at: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo "================================================================="
