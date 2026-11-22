import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { assertDeployment, digestDirectory } from './deployment';

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
