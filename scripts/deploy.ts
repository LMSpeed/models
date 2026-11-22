import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  assertCommitProgression,
  assertDeployment,
  awaitDeployment,
  type Deployment,
  digestDirectory,
  mainCommit,
} from './deployment';
import { run } from './lib/process';

const root = process.cwd();
const commit = run('git', ['rev-parse', 'HEAD']);
const config = JSON.parse(await readFile('data/manifest.json', 'utf8')) as {
  revision: number;
  sha256: string;
};
const previewOnly = process.argv.includes('--preview');
const expected = { commit, revision: config.revision, sha256: config.sha256 };
const dist = join(root, 'apps/site/dist');
const artifactHash = await digestDirectory(dist);
const metadata = JSON.parse(
  await readFile(join(dist, 'deployment.json'), 'utf8'),
) as Deployment;
assertDeployment(metadata, expected, previewOnly ? commit : await mainCommit());
const prod = 'https://models.lmspeed.net';
const live = await fetch(`${prod}/deployment.json`, {
  signal: AbortSignal.timeout(30000),
}).catch(() => undefined);
if (!previewOnly && live?.ok) {
  const value = (await live.json()) as typeof metadata;
  if (value.revision > config.revision)
    throw new Error('Production contains newer data');
  if (value.revision === config.revision && value.sha256 !== config.sha256)
    throw new Error('Production revision hash mismatch');
  if (value.commit !== 'development') {
    assertCommitProgression(value.commit, commit);
  }
}
const wrangler = (args: string[]) =>
  run('pnpm', ['--dir', 'apps/site', 'exec', 'wrangler', ...args], {
    timeout: 600000,
  });
await mkdir('.deploy', { recursive: true });
const alchemy = (stage: string) => {
  const output = run(
    'pnpm',
    ['exec', 'alchemy', 'deploy', '--stage', stage, '--yes'],
    { timeout: 600000 },
  );
  process.stdout.write(`${output}\n`);
};
let old: string | undefined;
if (!previewOnly) {
  try {
    const deployments = JSON.parse(
      wrangler(['deployments', 'list', '--json']),
    ) as Array<{ versions: Array<{ version_id: string }> }>;
    old = deployments[0]?.versions[0]?.version_id;
  } catch (error) {
    if (live?.ok) throw error;
  }
}
alchemy('preview');
await awaitDeployment('https://models-preview.lmspeed.net', expected);
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
if ((await digestDirectory(dist)) !== artifactHash)
  throw new Error('Static artifact changed after preview verification');
if (previewOnly) {
  process.stdout.write(
    JSON.stringify({ status: 'preview_verified', ...expected, artifactHash }) +
      '\n',
  );
  process.exit(0);
}
assertDeployment(metadata, expected, await mainCommit());
try {
  alchemy('production');
  await awaitDeployment(prod, expected);
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
