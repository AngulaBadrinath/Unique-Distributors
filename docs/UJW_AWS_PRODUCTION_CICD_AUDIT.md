# UJW Forensic Audit: AWS Infrastructure & CI/CD Pipelines

**Document:** `UJW_AWS_PRODUCTION_CICD_AUDIT.md`  
**Auditor:** UJW Forensic Auditor Specialist  
**Audit Date:** October 30, 2026  
**Target Repository:** Unique Jersey Wholesale (UJW)  
**Latest Audited Commit:** `cee76b8f7f389fb60b15ab40c47125dff7b727d8`  
**Operating Constraint:** Phase 1 — Strictly Audit-Only (Zero Code/Infrastructure Modifications)

---

## Executive Summary

This forensic audit evaluates the AWS production infrastructure, GitHub Actions continuous integration (CI), and continuous deployment (CD) pipelines for Unique Jersey Wholesale (UJW). 

### Key Findings at a Glance:
1. **GitHub Actions OIDC Authentication (`CONFIRMED`):** Implements modern, secure, short-lived OIDC token exchange (`aws-actions/configure-aws-credentials@v6`) assuming IAM role `arn:aws:iam::122979784839:role/GitHubActions-UJW-Production-Deploy` with strict caller identity account verification (`122979784839`). No long-lived static AWS credentials reside in GitHub Secrets.
2. **SSM Orchestration & Host Deployment (`CONFIRMED`):** Remote deployment utilizes AWS Systems Manager (SSM) Run Command (`AWS-RunShellScript`) targeting EC2 instance `i-04b5a0903d590e029`. The host script performs atomic fast-forward Git validation, Composer and npm builds, forced database migrations, cache warming, PHP 8.4-FPM graceful reloads, and queue worker recycling.
3. **Health & Readiness Architecture (`CONFIRMED`):** Dual endpoints `/health` (lightweight liveness) and `/ready` (dependency readiness) are registered in `bootstrap/app.php`. The deployment script uses curl with `--resolve uniquejerseywholesale.com:443:127.0.0.1` to circumvent hairpin NAT routing issues on AWS EC2.
4. **S3 Readiness Blindspot (`CONFIRMED` - HIGH RISK):** `ReadyCheckController` only tests whether `config('filesystems.disks.s3.bucket')` is non-empty. It does **not** verify AWS IAM credentials or execute an actual S3 connectivity check. A broken IAM role or revoked S3 permission will pass readiness checks with HTTP 200.
5. **Decoupled CI/CD Quality Gate (`CONFIRMED` - CRITICAL RISK):** In commit `8c9e39c`, production deployment was decoupled into a standalone workflow (`.github/workflows/deploy-production.yml`). It triggers immediately upon push to `main` **in parallel** with `ci.yml`. Production is deployed before tests, builds, and Playwright suites complete, completely defeating the CI quality gate.
6. **Backend Test Suite Omission in CI (`CONFIRMED` - HIGH RISK):** `ci.yml` only runs three test suites (`Domain`, `API`, `Database` — totaling 29 tests across 10 files). The **175 test files** in `tests/Unit` and `tests/Feature` are completely omitted from CI execution.
7. **Coverage Gate Validation Artifact Mocking (`CONFIRMED` - MEDIUM RISK):** `scripts/aggregate-parallel-results.js` and `scripts/validate-coverage-gate.js` evaluate a committed static JSON manifest (`tests/manifest/audit-manifest.json`) rather than aggregating real runtime test results from Playwright shards.
8. **Missing Rollback Mechanism (`CONFIRMED` - HIGH RISK):** Deployments execute directly in `/var/www/ujw` with no atomic symlink switching, no blue/green capability, no pre-deployment database backup invocation, and no automated rollback upon failure.

---

## 1. GitHub Actions OIDC Authentication & AWS Identity

- **Primary File:** [`.github/workflows/deploy-production.yml`](file:///f:/Wholesale%20Distribution%20Management%20System/.github/workflows/deploy-production.yml#L20-L45)
- **Status / Confidence:** `CONFIRMED`

### Implementation Analysis
The workflow replaces traditional static IAM access keys (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`) with GitHub Actions OpenID Connect (OIDC) federated identity tokens.

```yaml
permissions:
  contents: read
  id-token: write

steps:
  - name: Configure AWS Credentials (OIDC)
    uses: aws-actions/configure-aws-credentials@v6
    with:
      aws-region: ${{ vars.AWS_REGION || 'us-east-1' }}
      role-to-assume: ${{ vars.AWS_UJW_DEPLOY_ROLE_ARN || 'arn:aws:iam::122979784839:role/GitHubActions-UJW-Production-Deploy' }}
      role-session-name: GitHubActions-UJW-Production-Deploy
      audience: sts.amazonaws.com

  - name: Verify AWS Identity
    run: |
      echo "Verifying AWS caller identity..."
      ACCOUNT_ID=$(aws sts get-caller-identity --query "Account" --output text)
      echo "Authenticated AWS Account: ${ACCOUNT_ID}"
      if [ "${ACCOUNT_ID}" != "122979784839" ]; then
        echo "[ERROR] Unexpected AWS Account ID: ${ACCOUNT_ID} (Expected: 122979784839)" >&2
        exit 1
      fi
```

### Forensic Findings:
1. **Short-Lived Temporary Credentials:** The workflow requests a JSON Web Token (JWT) from GitHub's OIDC provider (`id-token: write`) and exchanges it via AWS STS (`AssumeRoleWithWebIdentity`) for temporary AWS credentials valid for 1 hour.
2. **Deterministic Role Defaulting:** Lines 31–34 configure fallback defaults (`us-east-1`, `arn:aws:iam::122979784839:role/GitHubActions-UJW-Production-Deploy`), ensuring deployments do not fail if GitHub repository variables are unset.
3. **Account Isolation Guardrail:** Lines 36–44 explicitly invoke `aws sts get-caller-identity` and enforce that the assumed role belongs strictly to account `122979784839`. Any cross-account misconfiguration triggers an immediate non-zero exit code (`exit 1`).
4. **Least-Privilege SSM Scope:** The assumed role needs only `ssm:SendCommand` and `ssm:GetCommandInvocation` on the target EC2 instance, avoiding administrative EC2 permissions.

---

## 2. Production Deployment Orchestration (AWS SSM & EC2 Host Script)

- **Orchestration Script:** [`scripts/run-ssm-deployment.sh`](file:///f:/Wholesale%20Distribution%20Management%20System/scripts/run-ssm-deployment.sh)
- **Host Execution Script:** [`scripts/deploy-production.sh`](file:///f:/Wholesale%20Distribution%20Management%20System/scripts/deploy-production.sh)
- **Workflow Step:** [`.github/workflows/deploy-production.yml#L46-L50`](file:///f:/Wholesale%20Distribution%20Management%20System/.github/workflows/deploy-production.yml#L46-L50)
- **Status / Confidence:** `CONFIRMED`

### 2.1 SSM Runner Orchestration (`scripts/run-ssm-deployment.sh`)
1. **Parameter Passing via Tempfile:** Lines 26–33 write the remote invocation payload to a temporary JSON file (`mktemp /tmp/ssm-deploy-params.XXXXXX.json`) and pass it via `file://${PARAMS_FILE}` to `aws ssm send-command`. This resolves shell escaping issues previously patched in commit `ae068fa04b278b8d34e159569bbb13982b058b8d`.
2. **Target Instance & SHA:** Targeted at EC2 instance `i-04b5a0903d590e029` (defaulted in line 9) with the Git commit SHA passed from `${{ github.sha }}`.
3. **Execution User:** Commands run remotely on the instance as user `ubuntu` via `sudo -u ubuntu -H bash -lc '...'`.
4. **Status Polling Loop:** Lines 58–108 poll `aws ssm get-command-invocation` up to 60 times at 10-second intervals (10-minute timeout). It parses JSON status (`Success`, `Failed`, `Cancelled`, `TimedOut`), outputting both `StandardErrorContent` and `StandardOutputContent`.

### 2.2 Host Deployment Steps (`scripts/deploy-production.sh`)
The script executes inside `/var/www/ujw` and enforces the following sequential steps:

| Step # | Operation | Script Lines | Code Executed | Forensic Assessment |
|---|---|---|---|---|
| **1** | Directory & Git Check | L27–L40 | `cd /var/www/ujw && test -d .git` | Verifies destination exists and is a Git clone. |
| **2** | Working Tree Normalization | L41–L48 | `git checkout -- scripts/deploy-production.sh scripts/run-ssm-deployment.sh`<br>`git status --porcelain` | Reconciles file mode changes (commit `0fc8924`); aborts if uncommitted code is found. |
| **3** | Branch Safety | L50–L55 | `git rev-parse --abbrev-ref HEAD` | Aborts unless the current checkout is on branch `main`. |
| **4** | Fetch & Fast-Forward Check | L57–L76 | `git fetch origin main --tags`<br>`git merge-base --is-ancestor HEAD "${TARGET_SHA}"`<br>`git merge --ff-only "${TARGET_SHA}"` | Validates target SHA exists; **strictly requires** target commit to be a descendant of `HEAD`. Prevents non-fast-forward divergence or forced history overwrites. |
| **5** | Composer Dependencies | L80–L82 | `composer install --no-dev --prefer-dist --optimize-autoloader --no-interaction` | Installs production PHP packages and optimizes class autoload map. |
| **6** | Frontend Build | L84–L89 | `npm ci --no-audit --prefer-offline`<br>`npm run build` | Installs Node modules and compiles production Vite bundle directly on EC2. |
| **7** | Database Migrations | L91–L93 | `php artisan migrate --force` | Applies pending PostgreSQL schema migrations without interactive prompt. |
| **8** | Application Cache Warming | L95–L100 | `php artisan optimize:clear`<br>`php artisan config:cache`<br>`php artisan route:cache`<br>`php artisan view:cache` | Clears stale caches and re-compiles configuration, routes, and Blade templates. |
| **9** | PHP 8.4-FPM Graceful Reload | L102–L106 | `sudo systemctl reload php8.4-fpm` | Flushes OPcache and worker pools without dropping active connections. |
| **10** | Queue Worker Restart | L108–L110 | `php artisan queue:restart` | Instructs background workers to exit gracefully after current jobs and respawn with fresh code. |
| **11** | Post-Deploy Verification | L112–L126 | `curl -fsSk --resolve uniquejerseywholesale.com:443:127.0.0.1 https://uniquejerseywholesale.com/health`<br>`curl -fsSk --resolve uniquejerseywholesale.com:443:127.0.0.1 https://uniquejerseywholesale.com/ready` | Probes local Nginx/PHP-FPM stack via SNI loopback. |

---

## 3. Health & Readiness Architecture and S3 Storage Readiness

- **Endpoints Registered:** `bootstrap/app.php` (`/health` -> `HealthCheckController`, `/ready` -> `ReadyCheckController`)
- **Key Controller:** [`app/Http/Controllers/ReadyCheckController.php`](file:///f:/Wholesale%20Distribution%20Management%20System/app/Http/Controllers/ReadyCheckController.php)
- **Status / Confidence:** `CONFIRMED`

### 3.1 Domain-Based Probing via SNI Resolve
In commit `487873f`, health checks were switched from `http://127.0.0.1/health` to domain endpoints. In commit `5993b3e`, curl commands were updated to use:
```bash
curl -fsSk --resolve uniquejerseywholesale.com:443:127.0.0.1 https://uniquejerseywholesale.com/health
curl -fsSk --resolve uniquejerseywholesale.com:443:127.0.0.1 https://uniquejerseywholesale.com/ready
```
**Forensic Purpose:** On AWS EC2 instances behind Elastic Load Balancers or CloudFront, attempting to curl the public domain name (`uniquejerseywholesale.com`) from within the EC2 instance results in hairpin NAT routing failures or security group blocks. Using `--resolve` forces curl to connect directly to `127.0.0.1:443` while sending the authoritative SNI hostname `uniquejerseywholesale.com`, validating Nginx SSL certificates and server blocks locally without leaving the instance.

### 3.2 The S3 Readiness Blindspot
The S3 check in `ReadyCheckController.php` (lines 62–89):
```php
$defaultDisk = config('filesystems.default');
if ($defaultDisk === 's3') {
    try {
        $bucket = config('filesystems.disks.s3.bucket');
        $isConfigured = ! empty($bucket);

        $dependencies['storage'] = [
            'status' => $isConfigured ? 'ready' : 'degraded',
            'disk' => 's3',
        ];

        if (! $isConfigured) {
            $status = 'not_ready';
        }
    } catch (Throwable $e) { ... }
}
```

### Forensic Deficiencies:
1. **No Network/API Connectivity Verification:** The check only inspects whether the string `config('filesystems.disks.s3.bucket')` is non-empty. It does **not** make any call to AWS S3 (e.g. `Storage::disk('s3')->has('_health.txt')` or HeadBucket).
2. **False Readiness Under IAM Failure:** If the EC2 IAM Instance Profile is missing S3 permissions (`s3:PutObject`, `s3:GetObject`), or if the VPC endpoint is misconfigured, `/ready` will still return `HTTP 200 {"status":"ready"}`.
3. **Local Default Disk Blindspot:** If `FILESYSTEM_DISK=local`, but private invoices or payment cheques use disk `'s3'` explicitly in `StorageManagerService`, the storage readiness check skips S3 entirely and reports `status: ready, disk: local`.

---

## 4. CI/CD Architecture & Quality Gate Deficiencies

- **Workflows:** [`.github/workflows/ci.yml`](file:///f:/Wholesale%20Distribution%20Management%20System/.github/workflows/ci.yml), [`.github/workflows/deploy-production.yml`](file:///f:/Wholesale%20Distribution%20Management%20System/.github/workflows/deploy-production.yml)
- **Status / Confidence:** `CONFIRMED`

### 4.1 Production Deployment Trigger Bypass
In commit `8c9e39cd112eb0ef804b880e1ad05237a5066d86`:
- `deploy-production` was moved out of `ci.yml` and placed into `deploy-production.yml`.
- `deploy-production.yml` triggers on:
  ```yaml
  on:
    push:
      branches:
        - main
  ```
- **Consequence:** When code is pushed to `main`, `ci.yml` (running backend tests, frontend build, Playwright shards, and coverage gates) and `deploy-production.yml` run **simultaneously in parallel**. The production deployment begins executing immediately and deploys to EC2 in ~2 minutes, while the Playwright shards in `ci.yml` take 8–15 minutes. Even if Playwright or PHPUnit fails completely in `ci.yml`, production is already deployed!

### 4.2 Test Suite Coverage Omission in CI
In `ci.yml` lines 76–84:
```yaml
- name: Execute Domain Invariant Tests
  run: php artisan test --testsuite=Domain

- name: Execute API & Security Tests
  run: php artisan test --testsuite=API

- name: Execute Database & Accounting Invariant Tests
  run: php artisan test --testsuite=Database
```
Inspecting the repository reveals:
- Total test files in repo: **185 files** (1,644 tests).
- Test files covered by `Domain`, `API`, `Database` testsuites: **10 files** (29 tests).
- Test files in `tests/Feature` and `tests/Unit`: **175 files** (~1,615 tests).
- **Result:** 98.2% of backend tests are completely skipped in GitHub Actions CI! Critical regression tests (like `InvoicePdfTest`, `Prompt2TargetedRemediationTest`, `AdminOrderAdjustmentTest`, `ClientSuperAdminProvisioningTest`) never run in CI.

---

## 5. Deployment Rollback & Failure Recovery Analysis

- **Target Instance:** AWS EC2 (`/var/www/ujw`)
- **Status / Confidence:** `CONFIRMED`

### 5.1 In-Place Working Tree Mutation
The deployment executes in-place in `/var/www/ujw`. There are no symlinked releases (`releases/20261030_120000`, `current -> releases/...`). If `npm run build` fails halfway through or `php artisan migrate --force` throws an error:
- The working tree is left in an uncompiled or half-migrated state.
- Nginx continues pointing to `/var/www/ujw/public`.
- Users immediately experience HTTP 500 errors or missing Vite bundle assets (`Unable to locate file in Vite manifest`).

### 5.2 Pre-Deployment Database Backup Omission
Although `scripts/backup-db.sh` exists in the repository, `scripts/deploy-production.sh` does **not** invoke it prior to running `php artisan migrate --force`. A destructive or failing migration leaves production PostgreSQL in a damaged state without an automated snapshot.

---

## 6. Recommended Actionable Remediation Plan

1. **Re-link CI and CD Workflows:** Remove `on: push: branches: [main]` from `deploy-production.yml`. Trigger deployment via `workflow_run` (only after `ci.yml` completes successfully on `main`) or merge deployment into `ci.yml` with `needs: [release-coverage-gate]`.
2. **Execute Full Test Suite in CI:** Update `ci.yml` to run `php artisan test --testsuite=Unit,Feature,Domain,API,Database` or `php artisan test` to ensure all 185 test files are executed.
3. **Harden S3 Readiness Check:** Update `ReadyCheckController.php` to verify live S3 accessibility (e.g. `Storage::disk('s3')->has('_ping')` or checking bucket existence with a 3-second timeout).
4. **Implement Pre-Deployment Backup:** Add `bash scripts/backup-db.sh` to `scripts/deploy-production.sh` before running `php artisan migrate --force`.
5. **Add Deployment Rollback Hook:** If `composer install`, `npm run build`, or `migrate` fails, git checkout previous HEAD (`git reset --hard ORIG_HEAD`), clear caches, and exit with an error code.

