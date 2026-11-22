import { describe, expect, it } from 'vitest';
import {
  canonicalJson,
  type Data,
  resolveModelId,
  validateData,
} from '../src/index';

const data: Data = {
  models: {
    'example-1': {
      id: 'example-1',
      name: 'Example 1',
      developerId: 'lab',
      tasks: ['text-generation'],
      modalities: { input: ['text'], output: ['text'] },
      specs: { text: { contextWindowTokens: 0, maxOutputTokens: null } },
      capabilities: { reasoning: false, toolCalling: null },
      sources: [],
    },
    'example-2': {
      id: 'example-2',
      name: 'Example 2',
      developerId: 'lab',
      tasks: ['text-generation'],
      modalities: { input: ['text'], output: ['text'] },
      specs: {},
      capabilities: { reasoning: null, toolCalling: null },
      sources: [],
    },
  },
  developers: { lab: { id: 'lab', name: 'Lab', website: null } },
  aliases: {
    schemaVersion: 1,
    revision: 1,
    namespaces: {
      global: { caseSensitive: false },
      'models.dev': { caseSensitive: true },
      openrouter: { caseSensitive: true },
    },
    models: [
      {
        namespace: 'global',
        value: 'EXAMPLE',
        canonicalId: 'example-1',
        routeKey: 'example',
        kind: 'fixed',
        source: { url: 'https://example.org' },
      },
      {
        namespace: 'models.dev',
        value: 'shared',
        canonicalId: 'example-1',
        routeKey: 'models.dev/shared',
        kind: 'fixed',
        source: { url: 'https://example.org' },
      },
      {
        namespace: 'openrouter',
        value: 'shared',
        canonicalId: 'example-2',
        routeKey: 'openrouter/shared',
        kind: 'moving',
        source: { url: 'https://example.org' },
        revision: 1,
      },
    ],
    developers: [],
    families: [],
  },
  redirects: [],
  upstreams: [],
};
describe('user can trust shared model identity and data', () => {
  it('user retains zero, false and null with deterministic object ordering', () => {
    // Given a valid spec with explicit zero, false and unknown values.
    // When the catalogue is validated and serialized in canonical order.
    const parsed = validateData(data);
    // Then no known value is treated as missing and insertion order is irrelevant.
    expect(parsed).toEqual(data);
    expect(canonicalJson({ z: 0, a: { b: false, a: null } })).toBe(
      '{"a":{"a":null,"b":false},"z":0}',
    );
  });
  it('user gets canonical precedence, registered case rules and ambiguity offline', () => {
    // Given source-partitioned aliases for distinct real versions.
    // When the consumer resolves canonical, global and unspecified source names.
    const canonical = resolveModelId(data, 'example-1');
    // Then it does not guess between different source identities.
    expect(canonical).toMatchObject({
      status: 'resolved',
      canonicalId: 'example-1',
      namespace: 'canonical',
    });
    expect(resolveModelId(data, ' Example ')).toMatchObject({
      status: 'resolved',
      canonicalId: 'example-1',
      namespace: 'global',
    });
    expect(resolveModelId(data, 'shared')).toMatchObject({
      status: 'ambiguous',
      candidates: ['example-1', 'example-2'],
    });
    expect(resolveModelId(data, 'shared', 'models.dev')).toMatchObject({
      status: 'resolved',
      canonicalId: 'example-1',
    });
    expect(resolveModelId(data, 'SHARED', 'models.dev')).toEqual({
      status: 'not_found',
      candidates: [],
    });
  });
  it('user cannot publish unsafe aliases or private pricing fields', () => {
    // Given a valid catalogue and mutations crossing the public contract.
    // When validation sees a path traversal, missing target or price.
    const bad = structuredClone(data);
    bad.aliases.models[0].routeKey = '../secret';
    // Then it rejects the candidate instead of publishing broken or private data.
    expect(() => validateData(bad)).toThrow();
    const missing = structuredClone(data);
    missing.aliases.models[0].canonicalId = 'missing';
    expect(() => validateData(missing)).toThrow();
    expect(() =>
      validateData({
        ...data,
        models: {
          ...data.models,
          'example-1': { ...data.models['example-1'], price: 1 },
        },
      }),
    ).toThrow();
  });
});
