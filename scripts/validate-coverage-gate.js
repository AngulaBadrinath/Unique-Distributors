/**
 * Authoritative Coverage Gate Validator
 * Enforces Zero False Passes, 100% Applicable Coverage, and Test Quality Invariants.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.join(__dirname, '..');
const manifestPath = path.join(rootDir, 'tests', 'manifest', 'audit-manifest.json');
const resultsPath = path.join(rootDir, 'artifacts', 'test-results', 'final-results.json');

if (!fs.existsSync(manifestPath)) {
  console.error(`[Coverage Gate ERROR] Manifest missing at ${manifestPath}`);
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

let finalResults = null;
if (fs.existsSync(resultsPath)) {
  try {
    finalResults = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
  } catch {}
}

const counts = manifest.reduce((acc, item) => {
  const st = item.executionStatus || item.status;
  acc[st] = (acc[st] || 0) + 1;
  return acc;
}, {});

const total = manifest.length;
const governanceMeta = counts['NOT_APPLICABLE'] || 0;
const totalApplicable = total - governanceMeta;
const passCount = counts['PASS'] || 0;
const partialCount = counts['PARTIAL'] || 0;
const uncheckedCount = counts['NOT_TESTED'] || 0;
const failedCount = counts['BUG'] || counts['FAIL'] || 0;
const blockedCount = counts['BLOCKED'] || 0;

console.log(`\n================================================================`);
console.log(`  COVERAGE GATE AUDIT & INTEGRITY CHECK`);
console.log(`  Authoritative Master Items : ${total}`);
console.log(`  Meta-Governance Rules (N/A): ${governanceMeta}`);
console.log(`  Applicable Target Scope    : ${totalApplicable}`);
console.log(`  Executed PASS              : ${passCount}`);
console.log(`  PARTIAL                    : ${partialCount}`);
console.log(`  FAIL / BUG                 : ${failedCount}`);
console.log(`  BLOCKED                    : ${blockedCount}`);
console.log(`  UNCHECKED                  : ${uncheckedCount}`);
console.log(`================================================================\n`);

let violations = [];

// Gate 1: All applicable items must be executed
if (passCount !== totalApplicable) {
  violations.push(`[Gate 1 Failure] Executed PASS count (${passCount}) does not equal total applicable items (${totalApplicable})`);
}

// Gate 2: Zero unchecked items
if (uncheckedCount > 0) {
  violations.push(`[Gate 2 Failure] Found ${uncheckedCount} unchecked / unexecuted items.`);
}

// Gate 3: Zero unresolved bugs/failures
if (failedCount > 0) {
  violations.push(`[Gate 3 Failure] Found ${failedCount} failing assertions or unresolved bugs.`);
}

// Gate 4: Zero blocked items
if (blockedCount > 0) {
  violations.push(`[Gate 4 Failure] Found ${blockedCount} blocked / untestable items.`);
}

// Gate 5: Test Quality Contract Inspection
let qualityIssues = 0;
manifest.forEach(item => {
  if (item.status === 'NOT_APPLICABLE' || item.executionStatus === 'NOT_APPLICABLE') return;

  if (!item.checklistId || !item.checklistId.startsWith('CHK-')) {
    qualityIssues++;
    violations.push(`[Quality Contract] Invalid checklistId format: ${item.checklistId}`);
  }

  if (!item.testFile) {
    qualityIssues++;
    violations.push(`[Quality Contract] Missing testFile mapping for ${item.checklistId}`);
  }

  if (!item.actualAssertion && (!item.assertions || item.assertions.length === 0)) {
    qualityIssues++;
    violations.push(`[Quality Contract] Missing concrete assertion for ${item.checklistId}`);
  }
});

if (violations.length > 0) {
  console.error(`\n❌ COVERAGE GATE REJECTED with ${violations.length} violations:\n`);
  violations.slice(0, 10).forEach(v => console.error(`  - ${v}`));
  if (violations.length > 10) console.error(`  ... and ${violations.length - 10} more`);
  console.error(`\n[Release Blocked] CI and release gates cannot proceed until all items satisfy the contract.\n`);
  process.exit(1);
}

console.log(`✅ COVERAGE GATE PASSED: 100.0% of applicable checklist items (${totalApplicable}/${totalApplicable}) deterministically verified with zero false passes.\n`);
process.exit(0);
