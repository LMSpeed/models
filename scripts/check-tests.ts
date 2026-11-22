import { readFile } from 'node:fs/promises';
import { run } from './lib/process';
import { inspectTestSource } from './test-governance';

const files = run('git', [
  'ls-files',
  '--cached',
  '--others',
  '--exclude-standard',
  '--',
  '*.test.ts',
  '*.spec.ts',
])
  .split('\n')
  .filter(Boolean);
const findings = [];
for (const file of files)
  for (const finding of inspectTestSource(await readFile(file, 'utf8'), file))
    findings.push({ file, ...finding });
if (findings.length)
  throw new Error(
    findings.map((item) => `${item.file}:${item.line} ${item.rule}`).join('\n'),
  );
process.stdout.write(
  `Behavior governance passed for ${files.length} TypeScript test files.\n`,
);
