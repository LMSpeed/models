import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { server } from '../../scripts/http-fixture';
import { Catalog, Client } from './src/index';

let base = '';
beforeAll(async () => {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (address && typeof address !== 'string')
    base = `http://127.0.0.1:${address.port}`;
});
afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});
describe('user can refresh real HTTP catalogue files without losing cached data', () => {
  it('user revalidates a loaded revision and reads sources, logo metadata and coverage', async () => {
    // Given an HTTP server whose success contract matches the verified static preview.
    const client = new Client({ baseUrl: `${base}/valid` });
    // When the caller refreshes, revalidates and requests metadata.
    const first = await client.refresh();
    const second = await client.refresh();
    await client.logos();
    const report = await client.coverage();
    // Then 304 retains the loaded catalogue and all representations share one revision.
    expect(second).toBe(first);
    expect(client.current).toBe(first);
    expect((await client.get('Example LLM')).id).toBe('fixture-llm');
    expect(
      first.sources('Example LLM', '/specs/text/contextWindowTokens'),
    ).toHaveLength(1);
    expect(first.sources('Example LLM', '/unknown')).toEqual([]);
    expect(first.upstreamFacts('Example LLM')).toEqual([]);
    expect(first.iconInfo('Example LLM')).toMatchObject({
      fallback: true,
      source: 'LMSpeed',
    });
    expect(report.revision).toBe(first.revision);
    expect(first.dataUpdatedAt).toBe('2026-11-22T00:00:00Z');
    expect(
      first.filter({
        input: 'image',
        output: 'text',
        developerId: 'fixture-lab',
      }),
    ).toHaveLength(1);
    expect(first.filter({ developerId: 'missing' })).toEqual([]);
  });
  it('user receives distinct errors and retains the last valid catalogue after refresh failure', async () => {
    // Given loaded data followed by a malformed response from an external boundary.
    const client = new Client({ baseUrl: `${base}/flaky-js` });
    const first = await client.refresh();
    // When refresh fails and other boundary failures are exercised.
    await expect(client.refresh()).rejects.toMatchObject({
      code: 'invalid_json',
    });
    // Then the original revision survives and callers can distinguish each failure.
    expect(client.current).toBe(first);
    for (const [path, code] of [
      ['missing', 'not_found'],
      ['invalid', 'invalid_json'],
      ['incompatible', 'schema_incompatible'],
      ['bad-hash', 'invalid_contract'],
    ] as const)
      await expect(
        new Client({ baseUrl: `${base}/${path}` }).refresh(),
      ).rejects.toMatchObject({ code });
    await expect(
      new Client({ baseUrl: `${base}/slow`, timeoutMs: 5 }).refresh(),
    ).rejects.toMatchObject({ code: 'timeout' });
    const controller = new AbortController();
    controller.abort();
    await expect(
      new Client({ baseUrl: `${base}/valid` }).refresh(controller.signal),
    ).rejects.toMatchObject({ code: 'cancelled' });
  });
  it('user can accept additive fields and explicitly disable conditional request headers', async () => {
    // Given an older consumer and a catalogue with new optional fields.
    const client = new Client({
      baseUrl: `${base}/extension`,
      conditionalRequests: false,
    });
    // When ordinary GET requests reload a forward-compatible catalogue.
    const first = await client.refresh();
    const second = await client.refresh();
    // Then the new data remains readable and the explicit refresh still works.
    expect(second.revision).toBe(first.revision);
    expect(second).not.toBe(first);
    expect(() => first.get('missing')).toThrow(/not_found/);
    expect(() => first.iconInfo('fixture-llm')).toThrow(/Load logo/);
    expect(() =>
      first.attachLogos({ schemaVersion: 2, revision: 1, models: {} }),
    ).toThrow();
    expect(() =>
      first.attachLogos({ schemaVersion: 1, revision: 2, models: {} }),
    ).toThrow();
    expect(() => new Client({ timeoutMs: 0 })).toThrow();
    await expect(Catalog.fromJson('invalid')).rejects.toMatchObject({
      code: 'invalid_json',
    });
  });
});
