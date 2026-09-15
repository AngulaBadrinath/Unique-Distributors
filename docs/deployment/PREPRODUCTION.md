# Pre-Production Deployment Runbook

## Unique Distributors Wholesale Distribution Management System
**Target Topology:** Render (Web Service) + Neon (PostgreSQL 18) + Upstash (Redis TLS) + Private AWS S3  
**Document Version:** 1.0  
**Effective Date:** September 2026

---

## 1. High-Level Architecture Diagram

```text
[ Browser / Client ]
        │  HTTPS (Port 443)
        ▼
[ Render Edge Reverse Proxy / TLS Termination ]
        │  Forwarded Headers (X-Forwarded-Proto, X-Forwarded-For)
        ▼
[ Render Web Service: Docker (Apache + PHP 8.3 + Laravel 13) ]
  ├── DocumentRoot: /var/www/html/public
  ├── SecurityHeadersMiddleware (HSTS, CSP, X-Frame-Options)
  ├── Session/CSRF/MFA Validation
  │
  ├───▶ [ Neon PostgreSQL 18 ] (DB_CONNECTION=pgsql, sslmode=require)
  │       ├── Transactional ACID Order/Allocation Locks
  │       ├── Immutable Triggers (Invoices, Audit Logs)
  │       └── GAAP Chart of Accounts & General Ledger
  │
  ├───▶ [ Upstash Redis ] (REDIS_SCHEME=tls, Port 6379)
  │       ├── Authenticated Web Sessions
  │       ├── Rate Limiting Counters
  │       └── Ephemeral Application Cache
  │
  └───▶ [ AWS S3 Private Storage ] (FILESYSTEM_DISK=s3, SSE-256)
          ├── Cheque & Money Order Evidence
          ├── Delivery Signatures & Proof-of-Delivery (POD)
          ├── Return Inspection Photos
          └── Product Catalogue Images
```

---

## 2. Infrastructure Provider Setup

### A. Neon PostgreSQL Setup
1. Create a project in Neon named `unique-distributors-preprod`.
2. Select PostgreSQL version `18` (or highest available, e.g. 17/16).
3. Region: Select `us-east-1` or `us-east-2` (matching AWS S3 proximity).
4. Retrieve the **Pooled Connection String** from the Neon dashboard:
   `postgresql://neondb_owner:[PASSWORD]@[HOST]-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require`
5. Note: Keep the password safe; never commit it to Git.

### B. Upstash Redis Setup
1. Log into Upstash Console and create a new database: `unique-distributors-preprod-redis`.
2. Region: `us-east-1` (same as S3/Neon).
3. Encryption in transit (TLS): **Enabled** (Mandatory).
4. Retrieve connection parameters:
   - Hostname: `[ENDPOINT].upstash.io`
   - Port: `6379`
   - Password: `[UPSTASH_PASSWORD]`
   - Connection URL: `rediss://default:[PASSWORD]@[ENDPOINT].upstash.io:6379`

### C. AWS S3 Setup
1. Dedicated private bucket: `unq-distributors-files-preprod-537124933486-us-east-1-an` (or existing dev bucket `unq-distributors-files-537124933486-us-east-1-an`).
2. Block Public Access: All 4 settings **ON**.
3. Default encryption: **SSE-S3 (AES-256)**.
4. Prepare IAM User / Role credentials with least-privilege policy (see [PRE_PRODUCTION_SETUP.md](file:///f:/Wholesale%20Distribution%20Management%20System/docs/deployment/PRE_PRODUCTION_SETUP.md)).

---

## 3. Render Service Configuration

### Deploying via Blueprint (`render.yaml`)
1. In Render Dashboard, select **New +** → **Blueprint**.
2. Connect the GitHub repository: `AngulaBadrinath/Wholesale-Distribution-`.
3. Select branch: `feature/preproduction-hardening` (or `main` when merged).
4. Render detects `render.yaml` and initializes service `unique-distributors-wdms`.
5. Under Environment Variables, supply the `sync: false` secrets manually:
   - `APP_KEY`: 32-character base64 key generated via `php artisan key:generate --show`.
   - `APP_URL`: Render public URL (e.g. `https://unique-distributors-wdms.onrender.com`).
   - `DATABASE_URL`: Neon pooled connection URL.
   - `REDIS_URL`: Upstash `rediss://...` connection URL.
   - `AWS_ACCESS_KEY_ID`: IAM user key.
   - `AWS_SECRET_ACCESS_KEY`: IAM user secret key.
   - `AWS_BUCKET`: Target S3 bucket name.

---

## 4. Build, Start, and Migration Commands

- **Build Command (Handled automatically by Dockerfile):**
  Multi-stage Docker build compiles frontend via Node 22 (`npm ci && npm run build`) and bootstraps PHP 8.3 Apache with Composer production dependencies (`composer install --no-dev --optimize-autoloader`).
- **Start Command (Handled automatically by Dockerfile entrypoint):**
  `apache2-foreground` listening dynamically on the `$PORT` provided by Render.
- **First Deployment Database Migration Command:**
  Run via Render Shell or Render One-Off Job:
  ```bash
  php artisan migrate --force
  ```
  *(Never run `migrate:fresh` or `db:wipe` in any non-local environment).*

---

## 5. Seed Strategy for Pre-Production
Run the non-destructive pre-production base seeder:
```bash
php artisan db:seed --class=Database\\Seeders\\PreproductionSeeder --force
```
This safely provisions:
1. Central Distribution Warehouse (`WH-MAIN`)
2. Standard VAT/GST Tax Profiles (10%, 5%, 0% exempt)
3. Standard Wholesale Categories (Beverages, Dry Groceries, Canned Goods, Confectionery)
4. Initial Super Administrator (`admin@uniquedistributors.com`)

---

## 6. Pre-Production Verification & Smoke Test

### A. Automated Diagnostic Tool
From Render Shell, execute:
```bash
php artisan deploy:verify --s3
```
Expected output:
- `Environment & Security`: **PASS** (`APP_DEBUG=false`, `APP_ENV=production`)
- `PostgreSQL Database`: **PASS** (PostgreSQL 18 connection verified)
- `Redis Cache / State`: **PASS** (Ping PONG over TLS)
- `AWS S3 Storage`: **PASS** (Read/Write/Delete verified on private S3 bucket)

### B. Health Check Endpoints
- **Liveness Ping:** `GET /up` (HTTP 200 OK)
- **Comprehensive Infrastructure Health:** `GET /health`
  ```json
  {
    "status": "healthy",
    "timestamp": "2026-09-15T19:00:00Z",
    "services": {
      "application": {"status": "healthy", "environment": "production"},
      "database": {"status": "healthy", "driver": "pgsql"},
      "redis": {"status": "healthy"}
    }
  }
  ```

---

## 7. Rollback Plan

If a deployment defect is detected in pre-production:

1. **Application Code Rollback:**
   - In Render Dashboard → Deploy History → Click **Rollback** on the previous working deployment.
2. **Database Rollback Considerations:**
   - If the new release did not run new migrations, no DB rollback is needed.
   - If a rollback migration is required, inspect `down()` method in the specific migration and run:
     `php artisan migrate:rollback --step=1 --force`
   - *Never run `migrate:fresh` or drop production tables.*
3. **Session & Cache Invalidation:**
   - Run `php artisan cache:clear` to purge potentially stale serialized objects.
4. **S3 Preservation:**
   - S3 objects are versioned; rolling back application code will not delete S3 files.

---

## 8. AWS Production Migration Path

When ready to transition from Render/Neon/Upstash to AWS:
1. **Container:** The same `Dockerfile` deploys seamlessly to AWS ECS Fargate or EKS.
2. **Database:** Neon database transfers to AWS RDS PostgreSQL via `pg_dump` / `pg_restore` or AWS DMS.
3. **Cache:** Upstash Redis migrates to AWS ElastiCache for Redis (Cluster Mode).
4. **Storage:** S3 configuration is already 100% native AWS S3.
5. **Secrets:** Replace Render environment settings with AWS Secrets Manager / Parameter Store.
