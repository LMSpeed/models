import { appendFile, readdir } from 'node:fs/promises';
import { api, run } from '../lib/process';
import { releaseComplete, stateFromBody } from './state';

const repo = process.env.GITHUB_REPOSITORY ?? 'LMSpeed/models';
let mode = 'none';
let commit = run('git', ['rev-parse', 'HEAD']);
const changes = (await readdir('.changes')).filter((name) =>
  name.endsWith('.json'),
);
const releases = api<Array<{ draft: boolean; body: string }>>(
  `repos/${repo}/releases?per_page=100`,
);
const pending = releases
  .filter((item) => item.draft && item.body.includes('lmspeed-release-state'))
  .map((item) => stateFromBody(item.body))
  .find(
    (state) =>
      !releaseComplete(state) &&
      Object.values(state.ecosystems).some(
        (item) => item.status !== 'verified' && item.attempts < 3,
      ),
  );
if (pending) {
  mode = 'publish';
  commit = pending.commit;
} else if (changes.length) mode = 'prepare';
else if (
  run('git', ['show', '--format=', '--name-only', 'HEAD'])
    .split('\n')
    .includes('release.json')
)
  mode = 'publish';
if (process.env.GITHUB_OUTPUT)
  await appendFile(
    process.env.GITHUB_OUTPUT,
    `mode=${mode}\ncommit=${commit}\n`,
  );
process.stdout.write(JSON.stringify({ mode, commit }) + '\n');
