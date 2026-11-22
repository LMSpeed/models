import { createHash } from 'node:crypto';
import { cp, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { run } from '../lib/process';

const root = process.cwd();
const config = JSON.parse(await readFile('release.json', 'utf8')) as {
  version: string;
  schemaVersion: number;
};
const commit = run('git', ['rev-parse', 'HEAD']);
await mkdir('.artifacts', { recursive: true });
run('pnpm', ['--filter', '@lmspeed/models', 'build']);
run('pnpm', [
  '--filter',
  '@lmspeed/models',
  'pack',
  '--pack-destination',
  `${root}/.artifacts`,
]);
run('uv', [
  'build',
  '--project',
  'sdk/python',
  '--out-dir',
  `${root}/.artifacts`,
]);
run('cargo', ['package', '--locked', '--manifest-path', 'sdk/rust/Cargo.toml']);
await cp(
  `sdk/rust/target/package/lmspeed-models-${config.version}.crate`,
  `.artifacts/lmspeed-models-${config.version}.crate`,
);
const metadata = JSON.parse(
  run('cargo', [
    'metadata',
    '--format-version',
    '1',
    '--no-deps',
    '--manifest-path',
    'sdk/rust/Cargo.toml',
  ]),
);
const crate = metadata.packages.find(
  (pkg: { name: string }) => pkg.name === 'lmspeed-models',
);
if (!crate) throw new Error('Missing crate metadata');
const description = {
  name: crate.name,
  vers: crate.version,
  deps: crate.dependencies.map(
    (dep: {
      name: string;
      rename: string | null;
      req: string;
      features: string[];
      optional: boolean;
      uses_default_features: boolean;
      target: string | null;
      kind: string | null;
      registry: string | null;
    }) => ({
      name: dep.name,
      explicit_name_in_toml: dep.rename,
      version_req: dep.req,
      features: dep.features,
      optional: dep.optional,
      default_features: dep.uses_default_features,
      target: dep.target,
      kind: dep.kind ?? 'normal',
      registry: dep.registry,
    }),
  ),
  features: crate.features,
  authors: crate.authors,
  description: crate.description,
  documentation: crate.documentation,
  homepage: crate.homepage,
  readme: await readFile('sdk/rust/README.md', 'utf8'),
  readme_file: 'README.md',
  keywords: crate.keywords,
  categories: crate.categories,
  license: crate.license,
  license_file: null,
  repository: crate.repository,
  rust_version: crate.rust_version,
  links: crate.links,
};
await writeFile('.artifacts/crate-metadata.json', JSON.stringify(description));
const files: Record<string, string> = {};
for (const name of (await readdir('.artifacts'))
  .filter((name) => /\.(tgz|whl|gz|crate)$|^crate-metadata\.json$/.test(name))
  .sort())
  files[name] = createHash('sha256')
    .update(await readFile(`.artifacts/${name}`))
    .digest('hex');
if (Object.keys(files).length !== 5)
  throw new Error('Expected npm, wheel, sdist and crate artifacts');
await writeFile(
  '.artifacts/manifest.json',
  JSON.stringify(
    {
      version: config.version,
      commit,
      schemaVersion: config.schemaVersion,
      files,
    },
    null,
    2,
  ) + '\n',
);
