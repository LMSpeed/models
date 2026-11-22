import { describe, expect, it } from 'vitest';
import {
  createSnapshot,
  type Data,
  loadCompatibleSnapshot,
  sha256,
} from '../src/index';

describe('user can load a compatible future catalogue without accepting malformed known fields', () => {
  it('user retains unknown additions but rejects incompatible schema versions', async () => {
    // Given a valid data version containing a newly introduced optional field.
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
    const base = await createSnapshot(data, 1, '2026-11-22T00:00:00Z');
    const extended = {
      ...base,
      data: { ...base.data, newField: { future: true } },
    };
    extended.sha256 = await sha256(extended.data);
    // When an older consumer loads the forward-compatible response.
    const loaded = await loadCompatibleSnapshot(extended);
    // Then it preserves the revision and new data while failing on a new major version.
    expect(loaded).toEqual(extended);
    await expect(
      loadCompatibleSnapshot({ ...extended, schemaVersion: 2 }),
    ).rejects.toThrow();
    await expect(
      loadCompatibleSnapshot({ ...extended, revision: 'wrong' }),
    ).rejects.toThrow();
  });
});
