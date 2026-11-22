import { appendFile, readdir, readFile } from 'node:fs/promises';
import { api, run } from '../lib/process';
import { releaseComplete, stateFromBody } from './state';

const repo = process.env.GITHUB_REPOSITORY ?? 'LMSpeed/models';
let mode = 'none';
let commit = run('git', ['rev-parse', 'HEAD']);
const changes = (await readdir('.changes')).filter((name) =>
  name.endsWith('.json'),
);
const releases = api<Array<{ draft: boolean; body: string; tag_name: string }>>(
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
else {
  const config = JSON.parse(await readFile('release.json', 'utf8')) as {
    version: string;
  };
  if (
    !releases.some(
      (item) =>
        (item as { tag_name?: string }).tag_name === `sdk-v${config.version}`,
    )
  ) {
    mode = 'publish';
    commit = run('git', ['log', '-1', '--format=%H', '--', 'release.json']);
  }
}
if (process.env.GITHUB_OUTPUT)
  await appendFile(
    process.env.GITHUB_OUTPUT,
    `mode=${mode}\ncommit=${commit}\n`,
  );
process.stdout.write(JSON.stringify({ mode, commit }) + '\n');
