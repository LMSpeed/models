import { readFile } from 'node:fs/promises';
import { api, run } from './lib/process';

const event = JSON.parse(
  await readFile(process.env.GITHUB_EVENT_PATH ?? '', 'utf8'),
) as {
  workflow_run: {
    conclusion: string;
    head_sha: string;
    head_branch: string;
    head_repository: { full_name: string };
  };
};
const result = event.workflow_run;
const repo = process.env.GITHUB_REPOSITORY ?? 'LMSpeed/models';
if (
  result.conclusion !== 'success' ||
  result.head_repository.full_name !== repo
)
  process.exit(0);
const prs = api<
  Array<{
    number: number;
    body: string;
    user: { login: string };
    head: { sha: string };
    mergeable_state: string;
  }>
>(
  `repos/${repo}/pulls?state=open&head=${repo.split('/')[0]}:${result.head_branch}`,
);
for (const candidate of prs) {
  if (candidate.head.sha !== result.head_sha) continue;
  const automated =
    candidate.user.login === 'github-actions[bot]' &&
    /^automation\/(specs-\d+|sdk-version)$/.test(result.head_branch);
  const dependency = candidate.user.login === 'dependabot[bot]';
  if (!automated && !dependency) continue;
  if (candidate.body.includes('requires manual review')) continue;
  if (dependency) {
    const files = api<Array<{ filename: string }>>(
      `repos/${repo}/pulls/${candidate.number}/files?per_page=100`,
    );
    if (
      !files.every((file) =>
        [
          'pnpm-lock.yaml',
          'package.json',
          'apps/site/package.json',
          'packages/publish/package.json',
        ].includes(file.filename),
      )
    )
      continue;
  }
  const pr = api<typeof candidate>(`repos/${repo}/pulls/${candidate.number}`);
  if (pr.head.sha !== result.head_sha)
    throw new Error('PR changed since validation');
  if (pr.mergeable_state === 'behind') {
    const match = /<!-- validation-refresh:(\d+) -->/.exec(pr.body);
    const attempts = Number(match?.[1] ?? 0);
    if (attempts >= 3) throw new Error('Base update retry budget exhausted');
    api(`repos/${repo}/pulls/${pr.number}`, 'PATCH', {
      body:
        pr.body.replace(/\n?<!-- validation-refresh:\d+ -->/, '') +
        `\n<!-- validation-refresh:${attempts + 1} -->`,
    });
    api(`repos/${repo}/pulls/${pr.number}/update-branch`, 'PUT', {
      expected_head_sha: result.head_sha,
    });
    run('gh', [
      'workflow',
      'run',
      'validate.yml',
      '--repo',
      repo,
      '--ref',
      result.head_branch,
    ]);
    continue;
  }
  const merged = api<{ merged: boolean }>(
    `repos/${repo}/pulls/${pr.number}/merge`,
    'PUT',
    { sha: result.head_sha, merge_method: 'squash' },
  );
  if (!merged.merged) throw new Error('Validated candidate was not merged');
  for (const workflow of ['deploy.yml', 'release-sdks.yml'])
    run('gh', ['workflow', 'run', workflow, '--repo', repo, '--ref', 'main']);
}
