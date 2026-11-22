import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { writeSnapshot } from '../../../scripts/sync-lib';
import { createSnapshot, type Data } from '../src/index';

const data: Data = {
  models: {},
  developers: {},
  aliases: {
    schemaVersion: 1,
    revision: 1,
    namespaces: {},
    models: [],
    developers: [],
    families: [],
  },
  redirects: [],
  upstreams: [],
};
describe('user keeps the last valid Git snapshot during synchronization', () => {
  it('user avoids empty writes on replay and rejects a corrupted candidate', async () => {
    // Given a complete validated snapshot in an isolated directory.
    const root = await mkdtemp(join(tmpdir(), 'model-sync-'));
    const snapshot = await createSnapshot(data, 1, '2026-11-22T00:00:00Z');
    // When synchronization repeats and a later response has a wrong hash.
    expect(await writeSnapshot(root, snapshot)).toBe(true);
    expect(await writeSnapshot(root, snapshot)).toBe(false);
    const before = await readFile(join(root, 'data/manifest.json'), 'utf8');
    await expect(
      writeSnapshot(root, { ...snapshot, sha256: '0'.repeat(64) }),
    ).rejects.toThrow(/hash/);
    // Then the previous complete version is still present byte for byte.
    expect(await readFile(join(root, 'data/manifest.json'), 'utf8')).toBe(
      before,
    );
  });
});
