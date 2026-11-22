import { execFileSync } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';

const files = execFileSync('git', ['ls-files'], { encoding: 'utf8' })
  .trim()
  .split('\n')
  .filter(Boolean);
if (
  files.some((path) =>
    /(^|\/)\.env(?:\.|$)|(^|\/)\.npmrc$|credentials\.toml$|\.pypirc$/.test(
      path,
    ),
  )
)
  throw new Error('Private configuration must not be committed');
for (const file of [
  'README.md',
  'CONTRIBUTING.md',
  'LICENSE',
  'data/LICENSE',
  'data/NOTICE.md',
  'logos/NOTICE.md',
]) {
  if ((await readFile(file, 'utf8')).length < 30)
    throw new Error(`Incomplete documentation: ${file}`);
}
for (const file of [
  'sdk/javascript/README.md',
  'sdk/python/README.md',
  'sdk/rust/README.md',
  'sdk/go/README.md',
])
  await stat(file);
process.stdout.write(
  'Documentation, attribution and tracked configuration checks passed.\n',
);
