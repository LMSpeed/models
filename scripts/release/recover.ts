import { readdir } from 'node:fs/promises';
import { api, run } from '../lib/process';
import { recoverableEcosystems, stateFromBody } from './state';

const repo = process.env.GITHUB_REPOSITORY ?? 'LMSpeed/models';
const active = api<{ workflow_runs: Array<{ status: string }> }>(
  `repos/${repo}/actions/workflows/release-sdks.yml/runs?per_page=30`,
).workflow_runs.some((item) => item.status !== 'completed');
if (active) {
  process.stdout.write(
    'An SDK release is already running; recovery was not started.\n',
  );
  process.exit(0);
}
const releases = api<Array<{ draft: boolean; body: string }>>(
  `repos/${repo}/releases?per_page=100`,
);
const recoverable = releases
  .filter((item) => item.draft && item.body.includes('lmspeed-release-state'))
  .some((item) => {
    const state = stateFromBody(item.body);
    return (
      recoverableEcosystems(state, process.env.SDK_PUBLISH_ECOSYSTEMS).length >
      0
    );
  });
const changes = (await readdir('.changes')).some((name) =>
  name.endsWith('.json'),
);
if (recoverable || changes) {
  run('gh', [
    'workflow',
    'run',
    'release-sdks.yml',
    '--repo',
    repo,
    '--ref',
    'main',
  ]);
  process.stdout.write(
    'Recovery dispatched the release workflow with its own trusted publishing identity.\n',
  );
}
