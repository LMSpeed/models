import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { createSnapshot, type Data } from '../packages/core/src/index';

const data: Data = {
  models: {
    'fixture-llm': {
      id: 'fixture-llm',
      name: 'Contract LLM',
      developerId: 'fixture-lab',
      tasks: ['text-generation', 'future-task'],
      modalities: { input: ['text', 'image'], output: ['text'] },
      specs: { text: { contextWindowTokens: 0, maxOutputTokens: null } },
      capabilities: { reasoning: false, toolCalling: null },
      knowledgeCutoff: '2026-01',
      sources: [
        {
          url: 'https://example.org/fixture',
          fields: ['/specs/text/contextWindowTokens'],
          scope: 'model',
          checkedAt: '2026-11-22T00:00:00Z',
        },
      ],
    },
    'fixture-image': {
      id: 'fixture-image',
      name: 'Contract Image',
      developerId: 'fixture-lab',
      tasks: ['image-generation'],
      modalities: { input: ['text'], output: ['image'] },
      specs: { image: { maxPixels: 1048576, editing: null } },
      capabilities: { reasoning: null, toolCalling: false },
      sources: [],
    },
  },
  developers: {
    'fixture-lab': { id: 'fixture-lab', name: 'Contract Lab', website: null },
  },
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
        value: 'Example LLM',
        canonicalId: 'fixture-llm',
        routeKey: 'example-llm',
        kind: 'fixed',
        source: { url: 'https://example.org/fixture' },
      },
      {
        namespace: 'models.dev',
        value: 'lab/LLM',
        canonicalId: 'fixture-llm',
        routeKey: 'models.dev/lab/LLM',
        kind: 'fixed',
        source: { url: 'https://example.org/fixture' },
      },
      {
        namespace: 'models.dev',
        value: 'shared',
        canonicalId: 'fixture-llm',
        routeKey: 'models.dev/shared',
        kind: 'fixed',
        source: { url: 'https://example.org/fixture' },
      },
      {
        namespace: 'openrouter',
        value: 'shared',
        canonicalId: 'fixture-image',
        routeKey: 'openrouter/shared',
        kind: 'fixed',
        source: { url: 'https://example.org/fixture' },
      },
      {
        namespace: 'openrouter',
        value: 'latest',
        canonicalId: 'fixture-llm',
        routeKey: 'openrouter/latest',
        kind: 'moving',
        revision: 1,
        source: { url: 'https://example.org/fixture' },
      },
    ],
    developers: [],
    families: [],
  },
  redirects: [],
  upstreams: [],
};
const snapshot = await createSnapshot(data, 1, '2026-11-22T00:00:00Z');
await writeFile(
  'fixtures/contracts/valid.json',
  JSON.stringify(snapshot, null, 2) + '\n',
);
const cases = [
  {
    input: 'fixture-llm',
    status: 'resolved',
    canonicalId: 'fixture-llm',
    expectedNamespace: 'canonical',
  },
  {
    input: ' Example llm ',
    status: 'resolved',
    canonicalId: 'fixture-llm',
    expectedNamespace: 'global',
  },
  {
    input: 'lab/LLM',
    namespace: 'models.dev',
    status: 'resolved',
    canonicalId: 'fixture-llm',
  },
  {
    input: 'lab/llm',
    namespace: 'models.dev',
    status: 'not_found',
    candidates: [],
  },
  {
    input: 'shared',
    status: 'ambiguous',
    candidates: ['fixture-image', 'fixture-llm'],
  },
  {
    input: 'shared',
    namespace: 'openrouter',
    status: 'resolved',
    canonicalId: 'fixture-image',
  },
  {
    input: 'latest',
    namespace: 'openrouter',
    status: 'resolved',
    canonicalId: 'fixture-llm',
  },
  { input: 'fixture-llm-preview', status: 'not_found', candidates: [] },
];
await writeFile(
  'fixtures/contracts/resolution.json',
  JSON.stringify(cases, null, 2) + '\n',
);

for (const path of [
  'sdk/python/tests/data',
  'sdk/rust/testdata',
  'sdk/go/testdata',
]) {
  await mkdir(path, { recursive: true });
  for (const file of ['valid.json', 'resolution.json'])
    await copyFile(`fixtures/contracts/${file}`, `${path}/${file}`);
}
