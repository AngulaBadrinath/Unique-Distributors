# Pre-Production Free-Tier Reality Check & Architecture Limitations Report

**Document Version:** 1.0  
**Effective Date:** September 2026  
**Application:** Unique Distributors Wholesale Distribution Management System  
**Target Pre-Production Architecture:** Render (Free Web Service) + Neon PostgreSQL 18 (Free Tier) + Upstash Redis (Free Tier) + AWS S3 (Existing Private Bucket)

---

## 1. Executive Summary

This report provides an unvarnished, engineering-grade assessment of the capabilities and operational limitations of hosting the Unique Distributors pre-production environment on free and managed serverless tiers.

While this topology provides a high-fidelity replica of database behaviors (PostgreSQL 18 PL/pgSQL triggers, transactional locking, row-level immutability) and storage security (private S3 presigned URLs, S3 SSE-256), **free hosting tiers impose hard operational constraints**. They must never be conflated with the full production AWS architecture.

---

## 2. Comprehensive Capability Matrix

| System Component / Capability | Pre-Production Status | Operational Constraint / Free-Tier Reality | Pre-Production Safe Workaround | Production AWS Target Recommendation |
|---|---|---|---|---|
| **Web Service (HTTP / HTTPS)** | `Supported with Limitations` | Render free instances spin down after 15 minutes of inbound inactivity. Cold start latency: 30–50 seconds. Max request timeout: 100s. | Operators / testers must expect initial cold start delay on first request after inactivity. Health check pings can minimize cold starts during active testing sessions. | AWS ECS Fargate or EKS with minimum 2 running tasks behind an Application Load Balancer (ALB), auto-scaling enabled. |
| **Relational Database** | `Supported with Limitations` | Neon free tier provides 0.5 GB storage, connection pooling, and compute auto-suspend after 5 minutes of inactivity. | Compute resumes within 500ms–2s on connection. Connection string must use pooled endpoint (`-pooler` suffix) with `DB_SSLMODE=require`. | AWS RDS PostgreSQL 16/17 Multi-AZ with dedicated read replicas and automated daily snapshots. |
| **In-Memory Cache & Key-Value** | `Supported with Limitations` | Upstash free tier restricts throughput to 10,000 commands/day and 256MB memory. Max connection count is capped. | Set `CACHE_PREFIX` to prevent key collisions; use standard session lifetimes (120m) and monitor daily request count. | AWS ElastiCache for Redis (Cluster Mode with Multi-AZ replication). |
| **Asynchronous Queue Worker** | `Limited / On-Demand` | Render free web services **do not provide background daemon workers**. If queue worker is not running continuously, queued jobs remain in Redis. | In pre-production, high-priority jobs execute synchronously (`QUEUE_CONNECTION=sync`) OR an on-demand worker is dispatched via Render One-Off Job / cron ping (`php artisan queue:work --stop-when-empty`). | Dedicated AWS ECS Fargate background worker service running `php artisan queue:work --tries=3 --timeout=90`. |
| **Scheduled Tasks / Cron** | `Limited / External Trigger Required` | Render free tier does not natively run continuous `php artisan schedule:work` alongside the web process. | Scheduled operations (e.g. statement generation, aging recalculation) can be triggered manually via Artisan or via external HTTP cron service calling a secured health/scheduler webhook. | AWS EventBridge Scheduler invoking ECS run-task `php artisan schedule:run` every minute. |
| **File Storage (S3)** | `Fully Supported (Production-Equivalent)` | Private AWS S3 bucket provides authoritative, persistent storage for all business evidence (payment cheques, delivery signatures, invoices, return photos). | Persistent files are stored directly on S3 with presigned URLs. No reliance on ephemeral Render disk. | Same S3 bucket architecture with AWS S3 Object Lock, KMS customer-managed keys (CMK), and S3 Intelligent-Tiering. |
| **Real-Time WebSockets** | `Not Required for V1` | Laravel Echo / WebSockets not used in core transactional flow (uses standard Inertia polling and notifications feed). | No WebSocket infrastructure needed. | AWS API Gateway WebSocket or AWS ECS Pusher/Soketi if real-time push added in future phases. |
| **Outbound Email** | `Sandboxed / Logged` | Pre-production must prevent accidental transmission of real customer emails or invoices to real email addresses. | Set `MAIL_MAILER=log` or route to a sandbox provider (Mailtrap / Mailpit) with hardcoded recipient traps. | AWS Simple Email Service (SES) with dedicated DKIM/SPF domain verification and dedicated IP pool. |

---

## 3. Subsystem Breakdown & Risk Analysis

### A. Render Ephemeral Disk vs. AWS S3
- **The Risk:** Render containers are ephemeral; any files written to local disk are permanently destroyed upon container restart, redeploy, or spin-down.
- **The Defense:** The application enforces `FILESYSTEM_DISK=s3`. Product catalogue images, payment cheques, delivery signatures, invoice PDFs, and inspection photos are saved directly to S3 via `StorageManagerService`.
- **Verification:** Run `php artisan storage:audit --disk=s3` to ensure 100% of database file references exist in S3.

### B. Neon Compute Auto-Suspend
- **The Reality:** Neon scales compute to zero when idle for more than 5 minutes.
- **The Impact:** The first HTTP request after idle may experience an additional 1.5–3.0 seconds latency as Neon resumes compute.
- **The Defense:** Neon resumes automatically without connection termination. The `HealthCheckController` and `DeployVerifyCommand` gracefully handle connection initialization.

### C. Upstash Command Throttling
- **The Reality:** Upstash free tier enforces a ceiling of 10,000 commands/day. If exceeded, commands are rate-limited or rejected with `ERR max daily request limit exceeded`.
- **The Defense:** Pre-production uses Redis primarily for active session storage and lightweight cache. High-frequency queries leverage database-level indexing. If Upstash threshold is reached, `SESSION_DRIVER=database` and `CACHE_STORE=database` serve as an instant zero-cost fallback without code changes.

---

## 4. Pre-Production Decision & Classification

Based on rigorous evaluation of the target stack against the system requirements:

**CLASSIFICATION:**  
### `PRE-PRODUCTION READY WITH LIMITATIONS`

**Justification:**
1. Core business integrity, transactions, and security boundaries are 100% identical to production.
2. PostgreSQL 18 immutability triggers, foreign keys, and ACID transactions are 100% operational on Neon.
3. Private S3 file persistence and presigned URL access are 100% operational on AWS.
4. Limitations are strictly operational constraints of free-tier hosting (idle spin-down, 10k daily Redis commands, no continuous background worker), with documented operational workarounds.
