/**
 * Master Parallel Test Execution Orchestrator
 * Executes PHPUnit suites, sharded Playwright workers, and aggregates results.
 */

import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

console.log(`\n================================================================`);
console.log(`  UNIQUE DISTRIBUTORS — PARALLEL TEST ORCHESTRATOR`);
console.log(`  Target Architecture: Parallel Sharding (4 Workers)`);
console.log(`  Database Authority : PostgreSQL 18 & SQLite In-Memory Isolation`);
console.log(`  Browser Mode       : Headless Isolated Worker Contexts`);
console.log(`================================================================\n`);

const startTime = Date.now();
let hasErrors = false;

// Step 1: Run Backend Domain, API & Database Invariant Suites
console.log(`[Phase 1/3] Executing Backend Domain, API & DB Invariant Suites...`);
try {
  execSync('php artisan test --testsuite=Domain', { stdio: 'inherit', cwd: rootDir });
  execSync('php artisan test --testsuite=API', { stdio: 'inherit', cwd: rootDir });
  execSync('php artisan test --testsuite=Database', { stdio: 'inherit', cwd: rootDir });
  console.log(`✓ Backend Invariant Suites: PASSED\n`);
} catch (err) {
  console.error(`✗ Backend Invariant Suites failed:`, err.message);
  hasErrors = true;
}

// Step 2: Run Playwright Sharded Browser Automation Suites
console.log(`[Phase 2/3] Executing Playwright Sharded Browser Automation Suites...`);
try {
  execSync('npx playwright test tests/browser/audit tests/browser/responsive tests/browser/security tests/browser/visual --workers=2', {
    stdio: 'inherit',
    cwd: rootDir,
    env: { ...process.env, HEADLESS: 'true', WORKERS: '2' }
  });
  console.log(`✓ Playwright Browser Shards: PASSED\n`);
} catch (err) {
  console.error(`✗ Playwright Browser Shards encounter failure:`, err.message);
  hasErrors = true;
}

// Step 3: Run Central Parallel Result Aggregator
console.log(`[Phase 3/3] Aggregating Results Across All Parallel Workers...`);
try {
  execSync('node scripts/aggregate-parallel-results.js', { stdio: 'inherit', cwd: rootDir });
} catch (err) {
  console.error(`✗ Aggregation failed:`, err.message);
  hasErrors = true;
}

const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);
console.log(`\n================================================================`);
console.log(`  PARALLEL TEST EXECUTION FINISHED in ${totalDuration}s`);
console.log(`  Overall Status : ${hasErrors ? '❌ FAILURES DETECTED' : '✅ ALL WORKERS PASSED'}`);
console.log(`================================================================\n`);

if (hasErrors) {
  process.exit(1);
} else {
  process.exit(0);
}
