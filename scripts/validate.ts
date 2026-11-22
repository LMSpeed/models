import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { canonicalJson, schemaDocument } from '../packages/core/src/index';
import { readSnapshot } from './sync-lib';

const root = process.cwd();
const snapshot = await readSnapshot(root);
const report = JSON.parse(
  await readFile(join(root, 'coverage/models-dev.json'), 'utf8'),
) as {
  baselineCommit: string;
  revision: number;
  upstreamModelCount: number;
  mappedModelCount: number;
  totalFactCount: number;
  coveredFactCount: number;
  modelCoverage: number;
  fieldCoverage: number;
  supersetAchieved: boolean;
  behindLatest?: boolean;
  extraModels: string[];
  extraFields: unknown[];
  missingModels: string[];
  unmappedFields: unknown[];
};
const upstream = snapshot.data.upstreams.find(
  (source) => source.id === 'models.dev',
);
if (
  !upstream ||
  report.baselineCommit !== upstream.commit ||
  report.upstreamModelCount !== upstream.modelCount ||
  report.revision !== snapshot.revision
)
  throw new Error(
    'Coverage report and snapshot identify different baselines or revisions',
  );
if (
  report.mappedModelCount + report.missingModels.length !==
    report.upstreamModelCount ||
  report.totalFactCount < report.coveredFactCount ||
  report.coveredFactCount < 0
)
  throw new Error('Coverage denominator is inconsistent');
if (
  report.supersetAchieved &&
  (report.modelCoverage !== 1 ||
    report.fieldCoverage !== 1 ||
    report.missingModels.length ||
    report.unmappedFields.length ||
    report.behindLatest ||
    (!report.extraModels.length && !report.extraFields.length))
)
  throw new Error('Coverage claims an unproven superset');
const config = JSON.parse(
  await readFile(join(root, 'release.json'), 'utf8'),
) as { version: string; schemaVersion: number };
const js = JSON.parse(
  await readFile('sdk/javascript/package.json', 'utf8'),
) as { version: string };
const py = await readFile('sdk/python/pyproject.toml', 'utf8');
const rust = await readFile('sdk/rust/Cargo.toml', 'utf8');
if (
  js.version !== config.version ||
  !py.includes(
    `version = "${config.version.replace(/-(alpha|beta|rc)\.(\d+)$/, (_, channel: string, n: string) => `${({ alpha: 'a', beta: 'b', rc: 'rc' } as Record<string, string>)[channel]}${n}`)}"`,
  ) ||
  !rust.includes(`version = "${config.version}"`) ||
  config.schemaVersion !== 1
)
  throw new Error('SDK versions or supported schema major disagree');
const schema = schemaDocument();
if (canonicalJson(schema).length < 100)
  throw new Error('Empty contract schema');
const visit = async (path: string): Promise<string[]> => {
  const entries = await readdir(path, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((entry) =>
        entry.isDirectory()
          ? visit(join(path, entry.name))
          : Promise.resolve([join(path, entry.name)]),
      ),
    )
  ).flat();
};
const logoFiles = await visit(resolve('logos'));
if (
  logoFiles.some(
    (path) => path.endsWith('.svg') && !path.includes('/overrides/'),
  )
)
  throw new Error('Do not vendor dependency SVG assets');
for (const key of ['models', 'developers'] as const) {
  const files = (await readdir(join('data', key))).filter((file) =>
    file.endsWith('.json'),
  );
  if (files.length !== snapshot.counts[key])
    throw new Error(`Unexpected stale data files in ${key}`);
}
process.stdout.write(
  JSON.stringify({
    revision: snapshot.revision,
    sha256: snapshot.sha256,
    models: snapshot.counts.models,
    developers: snapshot.counts.developers,
    baseline: report.baselineCommit,
    modelCoverage: report.modelCoverage,
    fieldCoverage: report.fieldCoverage,
    supersetAchieved: report.supersetAchieved,
    sdkVersion: config.version,
  }) + '\n',
);
