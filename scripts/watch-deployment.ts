import { readFile } from 'node:fs/promises';
import { assertDeployment, type Deployment, mainCommit } from './deployment';
import { run } from './lib/process';

const commit = process.env.GITHUB_SHA ?? run('git', ['rev-parse', 'HEAD']);
const manifest = JSON.parse(
  await readFile('data/manifest.json', 'utf8'),
) as Deployment;
const expected = {
  commit,
  revision: manifest.revision,
  sha256: manifest.sha256,
};
const deadline = Date.now() + 15 * 60 * 1000;
let lastError = 'Worker has not served this commit';
while (Date.now() < deadline) {
  if ((await mainCommit()) !== commit) {
    process.stdout.write(
      `Deployment ${commit} superseded by a newer main commit\n`,
    );
    process.exit(0);
  }
  try {
    const response = await fetch('https://models.lmspeed.net/deployment.json', {
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok)
      throw new Error(`Deployment metadata HTTP ${response.status}`);
    const live = (await response.json()) as Deployment;
    assertDeployment(live, expected, commit);
    process.stdout.write(
      `${run('pnpm', ['exec', 'tsx', 'scripts/smoke.ts'])}\n`,
    );
    process.stdout.write(
      JSON.stringify({
        status: 'verified',
        ...expected,
        delivery: 'cloudflare-github-builds-alchemy',
      }) + '\n',
    );
    process.exit(0);
  } catch (error) {
    lastError = String(error);
  }
  await new Promise((resolve) => setTimeout(resolve, 10000));
}
throw new Error(
  `Cloudflare GitHub build did not deploy ${commit}: ${lastError}`,
);
