import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { Catalog } from './src/index';

const root = new URL('../../', import.meta.url);
describe('user can consume the same offline model catalogue in JavaScript', () => {
  it('user resolves every shared contract case without a network request', async () => {
    // Given the shared cross-language catalogue and identity examples.
    const catalogue = await Catalog.fromJson(
      await readFile(new URL('fixtures/contracts/valid.json', root), 'utf8'),
    );
    const cases = JSON.parse(
      await readFile(
        new URL('fixtures/contracts/resolution.json', root),
        'utf8',
      ),
    );
    // When each explicit identity is resolved through the public package entry point.
    for (const entry of cases) {
      const resolved = catalogue.resolveModelId(entry.input, entry.namespace);
      // Then all canonical identities and ambiguity candidates match the contract.
      expect(resolved).toMatchObject({
        status: entry.status,
        ...(entry.canonicalId ? { canonicalId: entry.canonicalId } : {}),
        ...(entry.candidates ? { candidates: entry.candidates } : {}),
      });
    }
    expect(catalogue.get('Example LLM').specs.text?.contextWindowTokens).toBe(
      0,
    );
    expect(catalogue.get('fixture-llm').capabilities.reasoning).toBe(false);
    expect(catalogue.get('fixture-llm').specs.text?.maxOutputTokens).toBeNull();
    expect(
      catalogue.filter({ task: 'image-generation' }).map((m) => m.id),
    ).toEqual(['fixture-image']);
    expect(catalogue.iconUrl('Example LLM')).toBe(
      'https://models.lmspeed.net/v1/models/fixture-llm.svg',
    );
    expect(() => catalogue.get('shared')).toThrow(/ambiguous/);
  });
});
if (process.env.MODELS_DATA_FILE)
  it('user reads every actual imported model through the public JavaScript catalogue', async () => {
    // Given the exact SSG catalogue produced from the tracked source snapshot.
    const raw = await readFile(process.env.MODELS_DATA_FILE!, 'utf8');
    // When the public SDK loads it offline and resolves every registered source ID.
    const catalog = await Catalog.fromJson(raw);
    const parsed = JSON.parse(raw);
    // Then models retain their canonical identity and both real model types are readable.
    expect(catalog.snapshot.counts.models).toBe(parsed.counts.models);
    for (const alias of catalog.snapshot.data.aliases.models)
      expect(
        catalog.resolveModelId(alias.value, alias.namespace),
      ).toMatchObject({ status: 'resolved', canonicalId: alias.canonicalId });
    expect(catalog.filter({ task: 'text-generation' }).length).toBeGreaterThan(
      0,
    );
    expect(catalog.filter({ task: 'image-generation' }).length).toBeGreaterThan(
      0,
    );
  });
