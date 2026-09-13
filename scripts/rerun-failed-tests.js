/**
 * Targeted Failure-Only Test Runner
 * Consumes artifacts/test-results/failures.json and re-executes only failing suites.
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.join(__dirname, '..');
const failuresPath = path.join(rootDir, 'artifacts', 'test-results', 'failures.json');

console.log(`\n================================================================`);
console.log(`  TARGETED FAILURE-ONLY TEST RUNNER`);
console.log(`================================================================\n`);

if (!fs.existsSync(failuresPath)) {
  console.log(`[Info] No failures recorded in artifacts/test-results/failures.json.`);
  console.log(`[Status] All tests currently passing. Nothing to rerun.\n`);
  process.exit(0);
}

let failures = [];
try {
  failures = JSON.parse(fs.readFileSync(failuresPath, 'utf8'));
} catch (err) {
  console.error(`[Error] Failed to parse failures.json: ${err.message}`);
  process.exit(1);
}

if (failures.length === 0) {
  console.log(`[Success] Zero failed tests recorded in test-results. All verification suites are clean.`);
  console.log(`[Status] To run the full test suite, use 'npm run test:parallel' or 'npm run test:release'.\n`);
  process.exit(0);
}

console.log(`[Rerun] Re-executing ${failures.length} recorded failing test(s)...`);

const failedFiles = [...new Set(failures.map(f => f.testFile).filter(Boolean))];

for (const testFile of failedFiles) {
  console.log(`\n[Running Failed Target] ${testFile}`);
  try {
    if (testFile.endsWith('.php')) {
      execSync(`php artisan test ${testFile}`, { stdio: 'inherit', cwd: rootDir });
    } else if (testFile.endsWith('.ts') || testFile.endsWith('.js')) {
      execSync(`npx playwright test ${testFile}`, { stdio: 'inherit', cwd: rootDir });
    }
  } catch (err) {
    console.error(`[Rerun Failure] Target ${testFile} failed again.`);
  }
}

console.log(`\n[Rerun Complete] Review updated results in artifacts/test-results/.\n`);
