/**
 * Authoritative Full Release Gate Runner
 * Executes complete validation pipeline and strictly blocks release on any gap.
 */

import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

console.log(`\n================================================================`);
console.log(`  UNIQUE DISTRIBUTORS — FULL RELEASE VERIFICATION GATE`);
console.log(`  Zero False Passes — Strict Server Authority Enforcement`);
console.log(`================================================================\n`);

const steps = [
  { name: 'TypeScript Static Analysis', cmd: 'npm run type-check' },
  { name: 'Vite Production Bundle Build', cmd: 'npm run build' },
  { name: 'Parallel Test Execution Suite', cmd: 'node scripts/run-parallel-tests.js' },
  { name: 'Master Checklist 909/909 Coverage Gate', cmd: 'node scripts/validate-coverage-gate.js' },
  { name: 'AI Diagnostic Health Verification', cmd: 'node scripts/ai-failure-triage.js' },
  { name: 'Human-Readable Dashboard Generation', cmd: 'node scripts/generate-dashboard-report.js' }
];

let failed = false;

for (let i = 0; i < steps.length; i++) {
  const step = steps[i];
  console.log(`\n>>> [Step ${i + 1}/${steps.length}] ${step.name}...`);
  try {
    execSync(step.cmd, { stdio: 'inherit', cwd: rootDir });
    console.log(`✓ ${step.name}: PASSED`);
  } catch (err) {
    console.error(`\n❌ [RELEASE GATE BLOCKED] ${step.name} FAILED:`, err.message);
    failed = true;
    break;
  }
}

console.log(`\n================================================================`);
if (failed) {
  console.error(`  RELEASE GATE VERDICT: ❌ REJECTED (Unresolved failures or gaps)`);
  console.error(`================================================================\n`);
  process.exit(1);
} else {
  console.log(`  RELEASE GATE VERDICT: ✅ 100% APPROVED (Production-Ready)`);
  console.log(`================================================================\n`);
  process.exit(0);
}
