# Pre-Production Safe Deployment Checklist

## Unique Distributors Wholesale Distribution Management System
**Execution Model:** Gate-by-Gate Deployment Verification Protocol  
**Target:** Render + Neon PostgreSQL 18 + Upstash Redis TLS + Private AWS S3

---

```text
       [1. BEFORE DEPLOY]
               │
               ▼
     [2. CONFIGURE SERVICES]
               │
               ▼
        [3. SET SECRETS]
               │
               ▼
           [4. DEPLOY]
               │
               ▼
          [5. MIGRATE]
               │
               ▼
        [6. HEALTH CHECK]
               │
               ▼
         [7. SMOKE TEST]
               │
               ▼
       [8. VERIFY STORAGE / S3]
               │
               ▼
       [9. VERIFY DATABASE]
               │
               ▼
       [10. VERIFY REDIS]
               │
               ▼
       [11. VERIFY AUTH & MFA]
               │
               ▼
       [12. VERIFY COOKIES]
               │
               ▼
       [13. VERIFY LOGGING]
               │
               ▼
      [14. VERIFY MAIL SAFETY]
               │
               ▼
    [15. APPROVE PRE-PRODUCTION]
```

---

## Step 1: Before Deploy (Local Pre-Flight Gates)
- [ ] Working tree clean on Git branch `feature/preproduction-hardening` (or `main` when approved).
- [ ] No real secrets or credentials present in Git commit history or tracked files.
- [ ] `.env` and `.env.*` verified ignored by `.gitignore` (except `.env.example` and `.env.preproduction.example`).
- [ ] `npm run type-check` executed with **0 errors**.
- [ ] `npm run build` executed with **0 errors**.
- [ ] `php artisan test` passing on unit and domain suites.
- [ ] `php artisan config:clear` and `php artisan route:list` execute cleanly.

---

## Step 2: Configure Remote Services
- [ ] **Neon PostgreSQL:** Project created; pooled connection string generated with `sslmode=require`.
- [ ] **Upstash Redis:** Database created; TLS enabled; port 6379; password obtained.
- [ ] **AWS S3:** Dedicated bucket exists (`unq-distributors-files-preprod-...`); Block Public Access enabled; SSE-S3 encryption active.
- [ ] **Render Service:** Web service created from repository blueprint `render.yaml`.

---

## Step 3: Set Secrets in Render Dashboard
- [ ] `APP_KEY` set (random 32-character base64 key).
- [ ] `APP_URL` set to Render assigned HTTPS domain.
- [ ] `DATABASE_URL` set to Neon pooled connection string.
- [ ] `REDIS_URL` set to Upstash TLS connection string (`rediss://...`).
- [ ] `AWS_ACCESS_KEY_ID` & `AWS_SECRET_ACCESS_KEY` entered securely.
- [ ] `AWS_BUCKET` set to target S3 bucket name.
- [ ] `APP_DEBUG` explicitly set to `false`.
- [ ] `APP_ENV` set to `production`.
- [ ] `MAIL_MAILER` set to `log`.

---

## Step 4: Deploy Service
- [ ] Trigger deployment in Render.
- [ ] Monitor Docker build logs (Node 22 asset build, PHP 8.3 Apache configuration).
- [ ] Confirm container starts successfully and binds to `$PORT`.

---

## Step 5: Authoritative Database Migration
- [ ] In Render Shell, execute:
  ```bash
  php artisan migrate --force
  ```
- [ ] Confirm all 45 migrations executed without errors.
- [ ] Confirm PL/pgSQL immutability triggers installed (`protect_invoice_immutability`, `protect_audit_log_immutability`).
- [ ] Seed initial pre-production base data:
  ```bash
  php artisan db:seed --class=Database\\Seeders\\PreproductionSeeder --force
  ```

---

## Step 6: Health Check Gate
- [ ] In browser or curl, verify:
  `GET https://[YOUR_APP].onrender.com/up` → HTTP 200 OK.
- [ ] Verify comprehensive infrastructure health:
  `GET https://[YOUR_APP].onrender.com/health` → HTTP 200 OK:
  ```json
  {"status":"healthy","services":{"application":{"status":"healthy"},"database":{"status":"healthy"},"redis":{"status":"healthy"}}}
  ```
- [ ] Confirm no database credentials or stack traces appear in JSON response.

---

## Step 7: Smoke Test
- [ ] Navigate to `https://[YOUR_APP].onrender.com/login`.
- [ ] Verify login page renders with modern stylesheet and company typography.
- [ ] Log in with initial administrator credentials (`admin@uniquedistributors.com`).
- [ ] Confirm redirection to `/dashboard` succeeds.

---

## Step 8: Verify S3 Storage
- [ ] In Render Shell, run:
  ```bash
  php artisan deploy:verify --s3
  ```
- [ ] Confirm `AWS S3 Storage` reports **PASS**.
- [ ] Upload a test product image or payment cheque through the UI.
- [ ] Confirm asset is written to S3 and previewable via presigned temporary URL.

---

## Step 9: Verify Database Integrity
- [ ] Verify database row created in `audit_logs`.
- [ ] Confirm transaction commit behavior.

---

## Step 10: Verify Redis Session & Cache
- [ ] Verify active user session in Redis (`Upstash Console` keys count > 0).
- [ ] Confirm session persists across page reloads without requiring re-login.

---

## Step 11: Verify Auth & MFA
- [ ] Navigate to `/security/mfa`.
- [ ] Verify 2FA QR code generates properly (SVG / data URL).
- [ ] Verify rate limiting on `/login` (5 attempts per minute max).

---

## Step 12: Verify Cookies & HTTP Security
- [ ] In browser developer tools, inspect session cookie:
  - `HttpOnly`: **True**
  - `Secure`: **True**
  - `SameSite`: **Lax**
- [ ] Inspect HTTP response headers:
  - `Strict-Transport-Security`: `max-age=31536000; includeSubDomains`
  - `X-Content-Type-Options`: `nosniff`
  - `X-Frame-Options`: `SAMEORIGIN`
  - `Content-Security-Policy`: Present and intact.

---

## Step 13: Verify Logging
- [ ] Check Render dashboard logs stream.
- [ ] Confirm logs are written to `stderr` with level `INFO`.
- [ ] Confirm zero sensitive parameters (passwords, tokens, AWS keys) appear in log output.

---

## Step 14: Verify Mail Safety
- [ ] Trigger a password reset from the login page.
- [ ] Confirm email payload is written safely to log (`MAIL_MAILER=log`) and NOT sent to any real external inbox.

---

## Step 15: Approve Pre-Production
- [ ] Record deployment timestamp, Git commit SHA, and operator sign-off.
- [ ] Update [docs/PROJECT_STATUS.md](file:///f:/Wholesale%20Distribution%20Management%20System/docs/PROJECT_STATUS.md) to record pre-production deployment readiness.
