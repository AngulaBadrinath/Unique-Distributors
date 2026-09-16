# Client Super Administrator Credentials & Access Handoff

## Unique Distributors Wholesale Distribution Management System
**Document Version:** 1.0  
**Effective Date:** September 2026  
**Target Environment:** Pre-Production (Render / Neon PostgreSQL / Upstash Redis) & Production

---

## 1. Executive Summary

This document establishes the dedicated, independent **Client Super Administrator** account for Unique Distributors. 

This account is completely decoupled from technical/developer administrative accounts, ensuring full operational sovereignty, independent Multi-Factor Authentication (MFA), and enterprise-grade security governance.

---

## 2. Administrator Accounts Directory

| Account Type | Identity / Email | Assigned Role | Account Status | MFA Security | Purpose & Scope |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Client Super Administrator** | `client.admin@uniquedistributors.com` | `SUPER_ADMIN` | `ACTIVE` | **Mandatory** (Client Device) | Primary business owner & client administrative sovereignty |
| **Developer / Technical Super Admin** | `admin@uniquedistributors.com` | `SUPER_ADMIN` | `ACTIVE` | **Mandatory** (Technical Team) | Deployment maintenance, infrastructure verification, DevOps |
| **QA Automated Super Admin** | `superadmin.qa@example.test` | `SUPER_ADMIN` | `ACTIVE` | **Mandatory** (QA Suite) | Automated test suite execution & regression audits |

---

## 3. Client Super Administrator Specification

### A. Account Details
- **Email / Login Identifier:** `client.admin@uniquedistributors.com`
- **Full Display Name:** `Client Super Administrator`
- **System Role:** `SUPER_ADMIN`
- **Account Lifecycle Status:** `ACTIVE`
- **Privilege Level:** Unrestricted platform authority (catalog, pricing, accounting, ledger, orders, users, roles, audit logs, and system configuration).

### B. Credential Storage & Delivery Policy
> [!IMPORTANT]
> **Zero Plaintext Secrets in Repository Policy**
> - The temporary password for this account is generated securely with high entropy (24+ characters) and hashed using bcrypt (`$2y$...`) before storage in the database.
> - Plaintext passwords and MFA secrets are **NEVER committed to Git, stored in source code, or printed in application logs**.
> - The initial temporary password is transmitted directly to the authorized client stakeholder through a secure, encrypted one-time password-sharing channel (or secure out-of-band communication).

---

## 4. First-Time Login & MFA Enrollment Guide

Follow these steps to complete initial access and enroll your personal authenticator device:

```text
Step 1: Navigate to the Application Login Portal (https://[YOUR_APP_DOMAIN]/login)
Step 2: Enter Email (client.admin@uniquedistributors.com) and Temporary Password
Step 3: Submit Login Form → System initiates MFA Setup Challenge
Step 4: Open Authenticator App (Google Authenticator, Microsoft Authenticator, 1Password, etc.)
Step 5: Scan the secure on-screen QR Code or enter the manual Setup Key
Step 6: Enter the 6-digit Time-Based One-Time Password (TOTP) from your device
Step 7: Download and store the Emergency Recovery Codes in a secure password manager
Step 8: Authenticated successfully into Executive Command Center (/dashboard)
```

---

## 5. Security & Account Governance Rules

1. **Password Rotation:** The client administrator should update their password upon first successful login via **My Profile & Security** → **Password Settings**.
2. **Authenticator Protection:** Do not share MFA authenticator codes or backup recovery codes over email or chat.
3. **Session Revocation:** Active sessions can be audited and terminated on demand under **My Profile & Security** → **Active Sessions** (`/security/sessions`).
4. **Independent Identity:** The Client Super Administrator account is completely independent of the developer/QA accounts. Changes to passwords or MFA keys on this account will never affect other administrator identities.

---

## 6. Password Reset / Recovery Procedure

If the Client Super Administrator password needs to be reset:
1. Use the self-service **Forgot Password** link on the login page (`/forgot-password`).
2. Alternatively, an authorized technical operator can execute the non-destructive console command from the secure hosting environment:
   ```bash
   php artisan auth:provision-client-admin --email=client.admin@uniquedistributors.com
   ```
