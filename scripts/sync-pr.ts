import { readFile } from 'node:fs/promises';
import { api, run } from './lib/process';

const repo = process.env.GITHUB_REPOSITORY ?? 'LMSpeed/models';
const status = run('git', [
  'status',
  '--porcelain',
  '--',
  'data',
  'coverage/models-dev.json',
]);
if (!status) process.exit(0);
const revision = (
  JSON.parse(await readFile('data/manifest.json', 'utf8')) as {
    revision: number;
  }
).revision;
const review = process.env.REVIEW_REQUIRED === 'true';
const branch = `automation/specs-${revision}`;
run('git', ['switch', '-C', branch]);
run('git', ['add', 'data', 'coverage/models-dev.json']);
run('git', [
  '-c',
  'user.name=LMSpeed data bot',
  '-c',
  'user.email=bot@lmspeed.net',
  'commit',
  '-m',
  `data: source revision ${revision}`,
]);
run('git', ['push', '--force-with-lease', 'origin', branch]);
const prs = api<Array<{ number: number }>>(
  `repos/${repo}/pulls?state=open&head=${repo.split('/')[0]}:${branch}`,
);
if (!prs[0])
  api<{ number: number }>(`repos/${repo}/pulls`, 'POST', {
    title: `Model specifications revision ${revision}${review ? ' (identity review required)' : ''}`,
    head: branch,
    base: 'main',
    body: `Validated LMSpeed source snapshot revision ${revision}. SDK versions are unchanged. ${review ? 'This candidate includes deletion, withdrawal, merge or identity changes and requires manual review.' : 'Normal additions and specification updates are eligible for automatic merge after required checks.'}`,
  });
run('gh', ['workflow', 'run', 'validate.yml', '--repo', repo, '--ref', branch]);
