import { api, run } from './lib/process';

const repository = process.env.GITHUB_REPOSITORY ?? 'LMSpeed/models';
const number = Number(process.env.PR_NUMBER);
if (!Number.isSafeInteger(number) || number < 1)
  throw new Error('Invalid dependency PR');
const pr = api<{
  user: { login: string };
  head: { sha: string; repo: { full_name: string } };
  base: { repo: { full_name: string } };
}>(`repos/${repository}/pulls/${number}`);
if (
  pr.user.login !== 'dependabot[bot]' ||
  pr.head.repo.full_name !== repository
)
  throw new Error('Only repository-local Dependabot updates are eligible');
const files = api<Array<{ filename: string }>>(
  `repos/${repository}/pulls/${number}/files?per_page=100`,
);
if (
  !files.every(
    (file) =>
      ['pnpm-lock.yaml', 'apps/site/package.json'].includes(file.filename) ||
      /^(package.json|packages\/publish\/package.json)$/.test(file.filename),
  )
)
  throw new Error('Dependency PR changes unrelated files');
run('gh', [
  'pr',
  'merge',
  String(number),
  '--repo',
  repository,
  '--auto',
  '--squash',
]);
