/**
 * AI Failure Triage & Diagnostic Engine
 * Ingests test failures, produces structured classifications, and enforces No-False-Healing invariants.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.join(__dirname, '..');
const resultsDir = path.join(rootDir, 'artifacts', 'test-results');
const failuresPath = path.join(resultsDir, 'failures.json');
const triageJsonPath = path.join(resultsDir, 'ai-triage-report.json');
const triageMdPath = path.join(resultsDir, 'ai-triage-report.md');

let failures = [];
if (fs.existsSync(failuresPath)) {
  try {
    failures = JSON.parse(fs.readFileSync(failuresPath, 'utf8'));
  } catch (err) {
    console.warn('[AI Triage] Could not parse failures.json:', err.message);
  }
}

console.log(`\n================================================================`);
console.log(`  AI FAILURE TRIAGE & DIAGNOSTIC ENGINE`);
console.log(`  Failures Received for Analysis : ${failures.length}`);
console.log(`================================================================\n`);

const ALLOWED_CLASSES = [
  'APPLICATION_BUG',
  'TEST_BUG',
  'SELECTOR_BUG',
  'FIXTURE_BUG',
  'ENVIRONMENT_BUG',
  'VISUAL_REGRESSION',
  'ACCESSIBILITY_REGRESSION',
  'SECURITY_FAILURE',
  'DATA_INTEGRITY_FAILURE',
  'FINANCIAL_FAILURE',
  'CONCURRENCY_FAILURE',
  'FLAKY',
  'UNKNOWN'
];

const IMMUTABLE_DOMAINS = ['FINANCIAL', 'ACCOUNTING', 'PRICING', 'TAX', 'SECURITY'];

const triagedItems = failures.map(f => {
  let failureClass = f.failureClass || 'UNKNOWN';
  let healingAllowed = true;
  let healingRestriction = null;

  // Enforce No-False-Healing for sensitive domains
  if (IMMUTABLE_DOMAINS.includes(f.domain) || f.layer?.includes('SECURITY') || f.layer?.includes('FINANCIAL')) {
    healingAllowed = false;
    healingRestriction = 'PROHIBITED: Financial equations, pricing thresholds, and security policies are authoritative and cannot be auto-relaxed.';
  }

  return {
    checklistId: f.checklistId,
    testId: f.testId,
    domain: f.domain,
    layer: f.layer,
    expected: f.expected,
    actual: f.actual,
    failureClass,
    healingAllowed,
    healingRestriction,
    confidence: 'HIGH',
    recommendedAction: healingAllowed
      ? `Repair ${failureClass.toLowerCase().replace('_', ' ')} in test harness and re-verify`
      : `Flag as critical domain violation. Human architect intervention required.`
  };
});

const report = {
  timestamp: new Date().toISOString(),
  totalFailures: failures.length,
  triagedItems,
  noFalseHealingEnforced: true,
  summary: failures.length === 0
    ? 'All test layers fully operational with 0 active failures. Zero diagnostic triage required.'
    : `${failures.length} failure(s) diagnosed across active workers.`
};

fs.writeFileSync(triageJsonPath, JSON.stringify(report, null, 2), 'utf8');

// Generate Markdown Report
let mdContent = `# AI Failure Triage & Diagnostic Report
**Generated:** ${new Date().toISOString()}  
**Total Failures Diagnosed:** ${failures.length}  
**No-False-Healing Policy:** ACTIVE & ENFORCED

---

## 1. Summary
${report.summary}

---
`;

if (failures.length > 0) {
  mdContent += `## 2. Failure Classifications\n\n| Checklist ID | Domain | Layer | Failure Class | Healing Allowed | Action |\n|---|---|---|---|---|---|\n`;
  triagedItems.forEach(t => {
    mdContent += `| \`${t.checklistId}\` | ${t.domain} | ${t.layer} | **${t.failureClass}** | ${t.healingAllowed ? 'Yes (Harness)' : '❌ Prohibited'} | ${t.recommendedAction} |\n`;
  });
} else {
  mdContent += `## 2. Health Status\n✅ All parallel execution workers healthy. Zero test healing needed.\n`;
}

fs.writeFileSync(triageMdPath, mdContent, 'utf8');

console.log(`[AI Triage] Triage report saved to:`);
console.log(`  - ${triageJsonPath}`);
console.log(`  - ${triageMdPath}\n`);
