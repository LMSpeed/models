import { validateSnapshot } from '../packages/core/src/index';
import { validateCoverage } from './coverage-contract';
import { api, run } from './lib/process';
import { readSnapshot } from './sync-lib';

const repository = process.env.GITHUB_REPOSITORY ?? 'LMSpeed/models';
const runs = api<{
  workflow_runs: Array<{ conclusion: string; updated_at: string }>;
}>(
  `repos/${repository}/actions/workflows/sync.yml/runs?status=success&per_page=1`,
).workflow_runs;
if (!runs[0] || Date.now() - Date.parse(runs[0].updated_at) > 12 * 3600 * 1000)
  throw new Error(
    'No successful source check in the last 12 hours; 304 is counted as success',
  );
const snapshot = await validateSnapshot(
  await (
    await fetch('https://models.lmspeed.net/v1/api.json', {
      signal: AbortSignal.timeout(30000),
    })
  ).json(),
);
const expected = await readSnapshot(process.cwd());
if (
  snapshot.revision < expected.revision ||
  (snapshot.revision === expected.revision &&
    snapshot.sha256 !== expected.sha256)
)
  throw new Error('Production has not served the validated Git dataset');
const coverage = await (
  await fetch('https://models.lmspeed.net/coverage/models-dev.json', {
    signal: AbortSignal.timeout(30000),
  })
).json();
validateCoverage(snapshot, coverage);
run('pnpm', ['exec', 'tsx', 'scripts/smoke.ts']);
process.stdout.write(
  JSON.stringify({
    checkedAt: new Date().toISOString(),
    revision: snapshot.revision,
    syncLastSuccess: runs[0].updated_at,
    coverage,
  }) + '\n',
);
