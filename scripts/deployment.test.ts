import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import {
  assertCommitProgression,
  assertDeployment,
  digestDirectory,
} from './deployment';

it('user deploys a newer commit from a shallow build checkout while older commits remain rejected', async () => {
  // Given a real repository and the depth-one checkout used by Workers Builds.
  const root = await mkdtemp(join(tmpdir(), 'model-shallow-deploy-'));
  const source = join(root, 'source');
  const checkout = join(root, 'build');
  const git = (cwd: string, ...args: string[]) =>
    execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
  try {
    git(root, 'init', '--quiet', '--initial-branch=main', source);
    git(source, 'config', 'user.name', 'Deployment test');
    git(source, 'config', 'user.email', 'deployment@example.test');
    await writeFile(join(source, 'spec.json'), '{"revision":1}');
    git(source, 'add', '.');
    git(source, 'commit', '--quiet', '-m', 'Published version');
    const published = git(source, 'rev-parse', 'HEAD');
    await writeFile(join(source, 'spec.json'), '{"revision":2}');
    git(source, 'commit', '--quiet', '-am', 'Next version');
    const next = git(source, 'rev-parse', 'HEAD');
    git(root, 'clone', '--quiet', '--depth=1', `file://${source}`, checkout);
    expect(git(checkout, 'rev-parse', '--is-shallow-repository')).toBe('true');
    // When deployment checks whether the currently served commit precedes the candidate.
    assertCommitProgression(published, next, checkout);
    // Then a valid forward deployment succeeds without allowing a rollback to pass as a new deployment.
    expect(git(checkout, 'rev-parse', '--is-shallow-repository')).toBe('false');
    expect(() => assertCommitProgression(next, published, checkout)).toThrow();
  } finally {
    await rm(root, { recursive: true });
  }
});

it('user cannot deploy a stale commit, mismatched artifact or older dataset', () => {
  // Given a validated artifact and an existing production dataset.
  const expected = {
    commit: 'a'.repeat(40),
    revision: 7,
    sha256: 'b'.repeat(64),
  };
  // When deployment checks the exact branch head, artifact and production revision.
  assertDeployment(expected, expected, expected.commit, expected);
  const stale = () => assertDeployment(expected, expected, 'c'.repeat(40));
  const wrong = () =>
    assertDeployment({ ...expected, revision: 6 }, expected, expected.commit);
  const rewind = () =>
    assertDeployment(expected, expected, expected.commit, {
      ...expected,
      revision: 8,
    });
  const collision = () =>
    assertDeployment(expected, expected, expected.commit, {
      ...expected,
      sha256: 'c'.repeat(64),
    });
  // Then a previously verified production revision cannot be overwritten by any invalid candidate.
  expect(stale).toThrow('superseded');
  expect(wrong).toThrow('artifact');
  expect(rewind).toThrow('newer data');
  expect(collision).toThrow('hash mismatch');
});

it('user deploys identical static bytes after preview verification', async () => {
  // Given actual static files generated in an isolated directory.
  const directory = await mkdtemp(join(tmpdir(), 'model-deploy-'));
  try {
    await writeFile(join(directory, 'api.json'), '{"revision":7}');
    await writeFile(join(directory, 'index.html'), '<h1>LMSpeed</h1>');
    const before = await digestDirectory(directory);
    // When a file changes after preview verification.
    await writeFile(join(directory, 'api.json'), '{"revision":8}');
    const changed = await digestDirectory(directory);
    await writeFile(join(directory, 'api.json'), '{"revision":7}');
    // Then the digest detects changed bytes and is reproducible for the original artifact.
    expect(changed).not.toBe(before);
    expect(await digestDirectory(directory)).toBe(before);
  } finally {
    await rm(directory, { recursive: true });
  }
});
