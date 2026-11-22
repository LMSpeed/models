import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { api, run } from './lib/process';

const root = process.cwd();
const commit = run('git', ['rev-parse', 'HEAD']);
const config = JSON.parse(await readFile('data/manifest.json', 'utf8')) as {
  revision: number;
  sha256: string;
};
const repository = process.env.GITHUB_REPOSITORY ?? 'LMSpeed/models';
const head = api<{ object: { sha: string } }>(
  `repos/${repository}/git/ref/heads/main`,
).object.sha;
if (head !== commit)
  throw new Error('A newer main commit superseded this deployment');
const dist = join(root, 'apps/site/dist');
async function digest(path: string): Promise<string> {
  const hash = createHash('sha256');
  async function visit(dir: string) {
    for (const entry of (await readdir(dir, { withFileTypes: true })).sort(
      (a, b) => a.name.localeCompare(b.name, 'en'),
    )) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) await visit(full);
      else {
        hash.update(full.slice(dist.length));
        hash.update(await readFile(full));
      }
    }
  }
  await visit(path);
  return hash.digest('hex');
}
const artifactHash = await digest(dist);
const metadata = JSON.parse(
  await readFile(join(dist, 'deployment.json'), 'utf8'),
) as { commit: string; revision: number; sha256: string };
if (
  metadata.commit !== commit ||
  metadata.sha256 !== config.sha256 ||
  metadata.revision !== config.revision
)
  throw new Error('Static artifact does not belong to this commit and dataset');
const prod = 'https://models.lmspeed.net';
const live = await fetch(`${prod}/deployment.json`, {
  signal: AbortSignal.timeout(30000),
}).catch(() => undefined);
if (live?.ok) {
  const value = (await live.json()) as typeof metadata;
  if (value.revision > config.revision)
    throw new Error('Production contains newer data');
  if (value.revision === config.revision && value.sha256 !== config.sha256)
    throw new Error('Production revision hash mismatch');
  if (value.commit !== 'development') {
    run('git', ['merge-base', '--is-ancestor', value.commit, commit]);
  }
}
const wrangler = (args: string[]) =>
  run('pnpm', ['--dir', 'apps/site', 'exec', 'wrangler', ...args], {
    timeout: 600000,
  });
await mkdir('.deploy', { recursive: true });
let old: string | undefined;
try {
  const text = wrangler(['deployments', 'list', '--json']);
  const deployments = JSON.parse(text) as Array<{
    versions: Array<{ version_id: string }>;
  }>;
  old = deployments[0]?.versions[0]?.version_id;
} catch (error) {
  if (live?.ok) throw error;
}
wrangler([
  'deploy',
  '--env',
  'preview',
  '--message',
  `commit=${commit} revision=${config.revision} artifact=${artifactHash}`,
]);
run('pnpm', [
  'exec',
  'tsx',
  'scripts/smoke.ts',
  'https://models-preview.lmspeed.net',
]);
const preview = (await (
  await fetch('https://models-preview.lmspeed.net/deployment.json', {
    signal: AbortSignal.timeout(30000),
  })
).json()) as typeof metadata;
if (preview.commit !== commit || preview.sha256 !== config.sha256)
  throw new Error('Preview served another artifact');
if ((await digest(dist)) !== artifactHash)
  throw new Error('Static artifact changed after preview verification');
if (
  api<{ object: { sha: string } }>(`repos/${repository}/git/ref/heads/main`)
    .object.sha !== commit
)
  throw new Error('A newer commit superseded preview');
try {
  wrangler([
    'deploy',
    '--message',
    `commit=${commit} revision=${config.revision} artifact=${artifactHash}`,
  ]);
  run('pnpm', ['exec', 'tsx', 'scripts/smoke.ts', prod]);
  const current = (await (
    await fetch(`${prod}/deployment.json`, {
      signal: AbortSignal.timeout(30000),
    })
  ).json()) as typeof metadata;
  if (current.commit !== commit || current.sha256 !== config.sha256)
    throw new Error('Production served another artifact');
  await writeFile(
    '.deploy/result.json',
    JSON.stringify(
      {
        commit,
        revision: config.revision,
        sha256: config.sha256,
        artifactHash,
        previousVersion: old,
        status: 'verified',
        checkedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
} catch (error) {
  if (old) {
    wrangler([
      'rollback',
      old,
      '--message',
      `Automatic rollback after failed smoke for ${commit}`,
    ]);
    run('pnpm', ['exec', 'tsx', 'scripts/smoke.ts', prod]);
  }
  await writeFile(
    '.deploy/result.json',
    JSON.stringify({
      commit,
      previousVersion: old,
      status: old ? 'rolled_back' : 'failed_initial_deployment',
      error: String(error),
    }),
  );
  throw error;
}
