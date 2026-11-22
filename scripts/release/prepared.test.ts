import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { preparedConfig } from './prepared';

it('user publishes the first version from the commit that contains its release notes', async () => {
  // Given an initial version already matches all package manifests and has never been released.
  const root = await mkdtemp(join(tmpdir(), 'model-first-release-'));
  const git = (...args: string[]) =>
    execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  try {
    git('init', '--quiet');
    git('config', 'user.name', 'Contract test');
    git('config', 'user.email', 'contract@example.test');
    const config = { version: '0.1.0', schemaVersion: 1 };
    await writeFile(join(root, 'release.json'), JSON.stringify(config));
    git('add', '.');
    git('commit', '--quiet', '-m', 'Initial source');
    // When the automatic version PR consumes the first change record without incrementing the intended initial version.
    const changes = [
      { type: 'minor', summary: 'Read model specifications offline.' },
    ];
    const prepared = preparedConfig(config, changes);
    await writeFile(join(root, 'release.json'), JSON.stringify(prepared));
    await writeFile(join(root, 'release-notes.md'), changes[0].summary);
    git('add', '.');
    git('commit', '--quiet', '-m', 'Prepare initial release');
    const selected = git('log', '-1', '--format=%H', '--', 'release.json');
    // Then publication selects this exact commit, including its notes, and retries prepare identical metadata.
    expect(selected).toBe(git('rev-parse', 'HEAD'));
    expect(git('show', `${selected}:release-notes.md`)).toBe(
      changes[0].summary,
    );
    expect(prepared.version).toBe('0.1.0');
    expect(JSON.stringify(preparedConfig(config, changes))).toBe(
      await readFile(join(root, 'release.json'), 'utf8'),
    );
  } finally {
    await rm(root, { recursive: true });
  }
});
