/**
 * Human-Readable Test Dashboard Report Generator
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.join(__dirname, '..');
const resultsPath = path.join(rootDir, 'artifacts', 'test-results', 'final-results.json');
const coveragePath = path.join(rootDir, 'artifacts', 'test-results', 'coverage-summary.json');

if (!fs.existsSync(resultsPath)) {
  console.log(`[Report] No test results found. Run 'npm run test:parallel' first.`);
  process.exit(1);
}

const results = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
const coverage = fs.existsSync(coveragePath) ? JSON.parse(fs.readFileSync(coveragePath, 'utf8')) : results.summary;

console.log(`\n================================================================`);
console.log(`  UNIQUE DISTRIBUTORS — TEST EXECUTION DASHBOARD`);
console.log(`================================================================`);
console.log(`  Run ID           : ${results.runId}`);
console.log(`  Git SHA          : ${results.gitSha}`);
console.log(`  Timestamp        : ${results.timestamp}`);
console.log(`  Browser Runtime  : ${results.browser}`);
console.log(`  Parallel Workers : ${results.parallelism?.workers || 4} Workers (${results.parallelism?.shards || 4} Shards)`);
console.log(`----------------------------------------------------------------`);
console.log(`  Total Enumerated : ${results.summary.totalEnumerated}`);
console.log(`  Meta Governance  : ${results.summary.governanceMeta} (N/A)`);
console.log(`  Applicable Scope : ${results.summary.totalApplicable}`);
console.log(`  PASS             : ${results.summary.directPass} (${results.summary.coveragePercentage}%)`);
console.log(`  FAIL / BUG       : ${results.summary.failed}`);
console.log(`  BLOCKED          : ${results.summary.blocked}`);
console.log(`  PARTIAL          : ${results.summary.partial}`);
console.log(`  UNCHECKED        : ${results.summary.unchecked}`);
console.log(`----------------------------------------------------------------`);
console.log(`  SUITE BREAKDOWN:`);
results.suites.forEach(s => {
  console.log(`    ✓ ${s.suite.padEnd(45)} [${s.status}]`);
});
console.log(`================================================================`);
console.log(`  FINAL VERDICT    : ${results.summary.directPass === results.summary.totalApplicable && results.summary.failed === 0 ? '✅ 100% PASS — RELEASE READY' : '❌ GAPS / FAILURES DETECTED'}`);
console.log(`================================================================\n`);
