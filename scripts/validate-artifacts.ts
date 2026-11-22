import { createHash } from 'node:crypto';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import {
  canonicalJson,
  routeManifest,
  validateSnapshot,
} from '../packages/core/src/index';

const directory = 'apps/site/dist';
const snapshot = await validateSnapshot(
  JSON.parse(await readFile(join(directory, 'v1/api.json'), 'utf8')),
);
const routes = routeManifest(snapshot.data);
const logos = JSON.parse(
  await readFile(join(directory, 'logos.json'), 'utf8'),
) as {
  revision: number;
  models: Record<
    string,
    { sha256: string; fallback: boolean; source: string; version: string }
  >;
};
if (logos.revision !== snapshot.revision)
  throw new Error('Logo revision mismatch');
if (
  canonicalJson(
    JSON.parse(await readFile(join(directory, 'api.json'), 'utf8')),
  ) !== canonicalJson(snapshot)
)
  throw new Error('Unversioned API is not the v1 snapshot');
for (const [route, id] of routes) {
  const model = JSON.parse(
    await readFile(join(directory, `v1/models/${route}.json`), 'utf8'),
  );
  if (canonicalJson(model) !== canonicalJson(snapshot.data.models[id]))
    throw new Error(`Model alias differs: ${route}`);
  const svg = await readFile(join(directory, `v1/models/${route}.svg`), 'utf8');
  if (!svg.includes('<svg') || /<script|\bon\w+\s*=|foreignObject/.test(svg))
    throw new Error(`Unsafe SVG artifact: ${route}`);
  if (
    createHash('sha256').update(svg).digest('hex') !== logos.models[id].sha256
  )
    throw new Error(`Logo hash differs: ${route}`);
}
async function visit(path: string): Promise<string[]> {
  return (
    await Promise.all(
      (
        await readdir(path, { withFileTypes: true })
      ).map((entry) =>
        entry.isDirectory()
          ? visit(join(path, entry.name))
          : Promise.resolve([join(path, entry.name)]),
      ),
    )
  ).flat();
}
const files = await visit(directory);
if (files.length > 20000)
  throw new Error(
    'Static asset file count exceeds the conservative deployment limit',
  );
for (const path of files)
  if ((await stat(path)).size > 25 * 1024 * 1024)
    throw new Error(`Static asset exceeds 25 MiB: ${path}`);
const modelFiles = files.filter((path) =>
  path.startsWith(`${directory}/v1/models/`),
);
if (
  modelFiles.filter((path) => path.endsWith('.json')).length !== routes.size ||
  modelFiles.filter((path) => path.endsWith('.svg')).length !== routes.size
)
  throw new Error('JSON/SVG path sets differ');
if (files.some((path) => /\/(server|functions)\/|\/_worker\./.test(path)))
  throw new Error('Unexpected server runtime artifact');
for (const path of [
  'index.html',
  '404.html',
  'v1/aliases.json',
  'v1/developers.json',
  'v1/schema.json',
  'coverage/models-dev.json',
  'licenses/models-dev.txt',
  'licenses/logos.txt',
])
  await stat(join(directory, path));
process.stdout.write(
  JSON.stringify({
    revision: snapshot.revision,
    files: files.length,
    routes: routes.size,
    pairedRepresentations: true,
    staticOnly: true,
  }) + '\n',
);
