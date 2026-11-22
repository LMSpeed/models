import { readdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { api, run } from '../lib/process';
import { nextVersion, pythonVersion } from './state';

const repository = process.env.GITHUB_REPOSITORY ?? 'LMSpeed/models';
const config = JSON.parse(await readFile('release.json', 'utf8')) as {
  version: string;
  schemaVersion: number;
  [key: string]: unknown;
};
const files = (await readdir('.changes'))
  .filter((file) => file.endsWith('.json'))
  .sort();
if (!files.length) process.exit(0);
const changes = await Promise.all(
  files.map(
    async (file) =>
      JSON.parse(await readFile(`.changes/${file}`, 'utf8')) as {
        type: 'patch' | 'minor' | 'major';
        summary: string;
      },
  ),
);
const releases = api<Array<{ tag_name: string }>>(
  `repos/${repository}/releases?per_page=100`,
);
const version = releases.some((release) => release.tag_name.startsWith('sdk-v'))
  ? nextVersion(config.version, changes)
  : config.version;
const branch = 'automation/sdk-version';
run('git', ['switch', '-C', branch]);
await writeFile(
  'release.json',
  JSON.stringify({ ...config, version }, null, 2) + '\n',
);
const edits: [string, (text: string) => string][] = [
  [
    'sdk/javascript/package.json',
    (text) => JSON.stringify({ ...JSON.parse(text), version }, null, 2) + '\n',
  ],
  [
    'sdk/javascript/src/index.ts',
    (text) =>
      text.replace(/SDK_VERSION = '[^']+'/, `SDK_VERSION = '${version}'`),
  ],
  [
    'sdk/python/pyproject.toml',
    (text) =>
      text.replace(
        /^version = "[^"]+"/m,
        `version = "${pythonVersion(version)}"`,
      ),
  ],
  [
    'sdk/python/src/lmspeed_models/__init__.py',
    (text) =>
      text.replace(
        /__version__ = "[^"]+"/,
        `__version__ = "${pythonVersion(version)}"`,
      ),
  ],
  [
    'sdk/rust/Cargo.toml',
    (text) => text.replace(/^version = "[^"]+"/m, `version = "${version}"`),
  ],
  [
    'sdk/rust/src/lib.rs',
    (text) =>
      text.replace(/VERSION: &str = "[^"]+"/, `VERSION: &str = "${version}"`),
  ],
  [
    'sdk/go/models.go',
    (text) =>
      text.replace(/const Version = "[^"]+"/, `const Version = "${version}"`),
  ],
];
for (const [path, edit] of edits)
  await writeFile(path, edit(await readFile(path, 'utf8')));
run('uv', ['lock', '--project', 'sdk/python']);
run('cargo', [
  'update',
  '--workspace',
  '--manifest-path',
  'sdk/rust/Cargo.toml',
]);
let previous = '';
try {
  previous = await readFile('CHANGELOG.md', 'utf8');
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
}
const notes = `## ${version}\n\n${changes.map((change) => `- ${change.summary}`).join('\n')}\n\n`;
await writeFile('CHANGELOG.md', notes + previous);
await writeFile('release-notes.md', notes);
for (const file of files) await unlink(`.changes/${file}`);
run('git', [
  'add',
  'release.json',
  'release-notes.md',
  'CHANGELOG.md',
  '.changes',
  'sdk',
]);
if (!run('git', ['diff', '--cached', '--name-only'])) process.exit(0);
run('git', [
  '-c',
  'user.name=LMSpeed release bot',
  '-c',
  'user.email=release@lmspeed.net',
  'commit',
  '-m',
  `release: SDK ${version}`,
]);
run('git', ['push', '--force-with-lease', 'origin', branch]);
const prs = api<Array<{ number: number }>>(
  `repos/${repository}/pulls?state=open&head=${repository.split('/')[0]}:${branch}`,
);
let number = prs[0]?.number;
if (!number) {
  const pr = api<{ number: number }>(`repos/${repository}/pulls`, 'POST', {
    title: `Release SDK ${version}`,
    head: branch,
    base: 'main',
    body: `${notes}All four packages share schema major ${config.schemaVersion}. Publishing is bound to this PR's merged commit and immutable artifact manifest.`,
  });
  number = pr.number;
}
run('gh', [
  'workflow',
  'run',
  'validate.yml',
  '--repo',
  repository,
  '--ref',
  branch,
]);
