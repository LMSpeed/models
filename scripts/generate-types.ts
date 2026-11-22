import { execFileSync } from 'node:child_process';
import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import {
  FetchingJSONSchemaStore,
  InputData,
  JSONSchemaInput,
  quicktype,
} from 'quicktype-core';
import { schemaDocument } from '../packages/core/src/index';

const document = schemaDocument();
const valueField = (
  document as unknown as {
    properties: {
      data: {
        properties: {
          models: {
            additionalProperties: {
              properties: {
                upstreamFacts: {
                  properties: {
                    modelsDev: { items: { properties: { value: unknown } } };
                  };
                };
              };
            };
          };
        };
      };
    };
  }
).properties.data.properties.models.additionalProperties.properties
  .upstreamFacts.properties.modelsDev.items.properties;
valueField.value = {};
const schema = JSON.stringify(document, null, 2);
await writeFile('fixtures/contracts/schema.json', schema + '\n');
for (const [lang, path, options] of [
  [
    'python',
    'sdk/python/src/lmspeed_models/types.py',
    { 'python-version': '3.7' },
  ],
  [
    'rust',
    'sdk/rust/src/types.rs',
    { visibility: 'public', 'derive-debug': 'true' },
  ],
  ['go', 'sdk/go/types.go', { package: 'models', 'just-types': 'true' }],
] as const) {
  const input = new JSONSchemaInput(new FetchingJSONSchemaStore());
  await input.addSource({ name: 'Snapshot', schema });
  const data = new InputData();
  data.addInput(input);
  const generated = await quicktype({
    inputData: data,
    lang,
    rendererOptions: options,
    alphabetizeProperties: true,
  });
  await mkdir(path.substring(0, path.lastIndexOf('/')), { recursive: true });
  await writeFile(
    path,
    (lang === 'go' ? 'package models\n\n' : '') +
      generated.lines.join('\n') +
      '\n',
  );
}

execFileSync('gofmt', ['-w', 'sdk/go/types.go']);
execFileSync('rustfmt', ['--edition', '2021', 'sdk/rust/src/types.rs']);
for (const path of [
  'sdk/python/src/lmspeed_models/schema.json',
  'sdk/rust/schema.json',
  'sdk/go/schema.json',
])
  await copyFile('fixtures/contracts/schema.json', path);
