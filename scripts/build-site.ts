import { execFileSync } from 'node:child_process';

const commit = execFileSync('git', ['rev-parse', 'HEAD'], {
  encoding: 'utf8',
}).trim();
for (const args of [
  ['validate'],
  ['build'],
  ['exec', 'tsx', 'scripts/validate-artifacts.ts'],
])
  execFileSync('pnpm', args, {
    stdio: 'inherit',
    env: { ...process.env, MODELS_BUILD_COMMIT: commit },
  });
