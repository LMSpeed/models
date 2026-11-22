import { validateSnapshot } from '../packages/core/src/index';

const base =
  process.env.MODELS_URL ?? process.argv[2] ?? 'https://models.lmspeed.net';
const response = await fetch(`${base}/v1/api.json`);
if (!response.ok) throw new Error(`Catalogue HTTP ${response.status}`);
if (response.headers.get('access-control-allow-origin') !== '*')
  throw new Error('Missing public CORS');
const snapshot = await validateSnapshot(await response.json());
const model = Object.values(snapshot.data.models).find((m) =>
  m.tasks.includes('text-generation'),
);
const image = Object.values(snapshot.data.models).find((m) =>
  m.tasks.includes('image-generation'),
);
if (!model || !image) throw new Error('Missing real model types');
const alias = snapshot.data.aliases.models.find(
  (a) => a.canonicalId === model.id,
);
if (!alias) throw new Error('Missing alias');
for (const key of [model.id, image.id, alias.routeKey]) {
  const json = await fetch(`${base}/v1/models/${key}.json`);
  const svg = await fetch(`${base}/v1/models/${key}.svg`);
  if (!json.ok || !svg.ok)
    throw new Error(`Missing paired model resources: ${key}`);
  const value = (await json.json()) as { id: string };
  if (value.id !== (key === alias.routeKey ? alias.canonicalId : key))
    throw new Error('Alias canonical identity mismatch');
  if (!svg.headers.get('content-type')?.includes('image/svg+xml'))
    throw new Error('Incorrect SVG content type');
  const etag = json.headers.get('etag');
  if (!etag) throw new Error('Missing ETag');
  const conditional = await fetch(`${base}/v1/models/${key}.json`, {
    headers: { 'if-none-match': etag },
  });
  if (conditional.status !== 304)
    throw new Error('Conditional revalidation failed');
}
for (const extension of ['json', 'svg']) {
  const unknown = await fetch(
    `${base}/v1/models/unknown-model-${snapshot.sha256}.${extension}`,
  );
  if (unknown.status !== 404)
    throw new Error('Unknown model did not return 404');
}
const html = await fetch(base);
if (!html.ok || !(await html.text()).includes('LMSpeed'))
  throw new Error('Static homepage unavailable');
process.stdout.write(
  JSON.stringify({
    base,
    revision: snapshot.revision,
    sha256: snapshot.sha256,
    models: snapshot.counts.models,
    checks: [
      'HTML',
      'JSON',
      'SVG',
      'alias identity',
      'CORS',
      'ETag/304',
      'unknown JSON/SVG 404',
    ],
  }) + '\n',
);
