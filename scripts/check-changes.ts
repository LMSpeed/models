import { readdir, readFile } from 'node:fs/promises';
import { run } from './lib/process';

const base = process.env.CI_BASE;
const files =
  base && !/^0+$/.test(base)
    ? run('git', [
        'diff',
        '--name-only',
        base,
        process.env.CI_HEAD ?? 'HEAD',
      ]).split('\n')
    : [];
const records = (await readdir('.changes')).filter((file) =>
  file.endsWith('.json'),
);
for (const file of records) {
  const value = JSON.parse(await readFile(`.changes/${file}`, 'utf8'));
  if (
    !['patch', 'minor', 'major'].includes(value.type) ||
    typeof value.summary !== 'string' ||
    value.summary.length < 10
  )
    throw new Error(`Invalid change record: ${file}`);
}
if (
  files.some(
    (file) =>
      /^sdk\/.*\.(ts|py|rs|go)$|^packages\/core\/src\//.test(file) &&
      !/(test|types\.(py|rs|go))/.test(file),
  ) &&
  !files.includes('release.json') &&
  !records.some((file) => files.includes(`.changes/${file}`))
)
  throw new Error('Public SDK behavior changes require a .changes JSON record');
