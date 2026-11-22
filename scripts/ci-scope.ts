import { execFileSync } from 'node:child_process';
import { appendFile } from 'node:fs/promises';

const base = process.env.CI_BASE;
const head = process.env.CI_HEAD ?? 'HEAD';
if (base && !/^[a-f0-9]{40}$/.test(base))
  throw new Error('Invalid comparison base');
if (head !== 'HEAD' && !/^[a-f0-9]{40}$/.test(head))
  throw new Error('Invalid comparison head');
const files = (
  base && !/^0+$/.test(base)
    ? execFileSync('git', ['diff', '--name-only', base, head], {
        encoding: 'utf8',
      })
    : execFileSync('git', ['ls-tree', '-r', '--name-only', head], {
        encoding: 'utf8',
      })
)
  .trim()
  .split('\n')
  .filter(Boolean);
const docsOnly =
  files.length > 0 &&
  files.every((file) =>
    /^(README|CONTRIBUTING|LICENSE|docs\/)|\.md$/.test(file),
  );
const sdk = files.some((file) =>
  /^(sdk\/|packages\/core\/|fixtures\/|scripts\/release\/|release.json|\.changes\/)/.test(
    file,
  ),
);
const build = !docsOnly || files.some((file) => file.startsWith('apps/site/'));
const result = {
  docs_only: String(docsOnly),
  sdk: String(sdk),
  data: String(!docsOnly),
  build: String(build),
};
if (process.env.GITHUB_OUTPUT)
  for (const [key, value] of Object.entries(result))
    await appendFile(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
process.stdout.write(JSON.stringify({ files: files.length, ...result }) + '\n');
