import { execFile } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const root = process.cwd();
const artifacts = resolve('.artifacts');
await mkdir(artifacts, { recursive: true });
const run = async (cmd: string, args: string[], cwd = root) => {
  const result = await exec(cmd, args, {
    cwd,
    maxBuffer: 1024 * 1024 * 4,
    timeout: 300000,
  });
  if (result.stdout) process.stdout.write(result.stdout);
};
await run('pnpm', [
  '--filter',
  '@lmspeed/models',
  'pack',
  '--pack-destination',
  artifacts,
]);
const config = JSON.parse(await readFile('release.json', 'utf8')) as {
  version: string;
};
const temp = await mkdtemp(join(tmpdir(), 'lmspeed-package-smoke-'));
const fixture = resolve('apps/site/dist/v1/api.json');
const js = join(temp, 'javascript');
await mkdir(js);
await writeFile(join(js, 'package.json'), '{"private":true,"type":"module"}\n');
await run(
  'pnpm',
  ['add', join(artifacts, `lmspeed-models-${config.version}.tgz`)],
  js,
);
await writeFile(
  join(js, 'smoke.mjs'),
  `import {Catalog,SDK_VERSION} from '@lmspeed/models';import {readFile} from 'node:fs/promises';const catalog=await Catalog.fromJson(await readFile(${JSON.stringify(fixture)},'utf8'));if(catalog.snapshot.counts.models<1)throw new Error('Empty model catalogue');process.stdout.write(JSON.stringify({language:'javascript',sdkVersion:SDK_VERSION,revision:catalog.revision,models:catalog.snapshot.counts.models})+'\\n');`,
);
await run('node', ['smoke.mjs'], js);
await writeFile(
  join(js, 'types.ts'),
  "import {Catalog, type Model} from '@lmspeed/models'; async function read(json:string):Promise<Model>{return (await Catalog.fromJson(json)).get('example');} void read;\n",
);
await run(
  'node',
  [
    resolve('node_modules/typescript/bin/tsc'),
    '--noEmit',
    '--skipLibCheck',
    '--module',
    'NodeNext',
    '--target',
    'ES2022',
    'types.ts',
  ],
  js,
);
await run('uv', ['build', '--project', 'sdk/python', '--out-dir', artifacts]);
const py = join(temp, 'python');
await run('uv', ['venv', '--python', '3.12', py]);
await run('uv', [
  'pip',
  'install',
  '--python',
  join(py, 'bin/python'),
  join(artifacts, `lmspeed_models-${config.version}-py3-none-any.whl`),
]);
await run(
  join(py, 'bin/python'),
  [
    '-c',
    `from lmspeed_models import Catalog, __version__;import json;from pathlib import Path;c=Catalog.from_json(Path(${JSON.stringify(fixture)}).read_text());assert len(c.models)>0;print(json.dumps({'language':'python','sdkVersion':__version__,'revision':c.revision,'models':len(c.models)}))`,
  ],
  temp,
);
await run('cargo', [
  'package',
  '--locked',
  '--manifest-path',
  'sdk/rust/Cargo.toml',
  '--allow-dirty',
]);
const rust = join(temp, 'rust');
await mkdir(join(rust, 'src'), { recursive: true });
await cp(
  resolve(`sdk/rust/target/package/lmspeed-models-${config.version}`),
  join(temp, 'crate'),
  { recursive: true },
);
await writeFile(
  join(rust, 'Cargo.toml'),
  `[package]\nname="lmspeed-install-smoke"\nversion="0.0.0"\nedition="2021"\n[dependencies]\nlmspeed-models={path="../crate"}\n`,
);
await writeFile(
  join(rust, 'src/main.rs'),
  `fn main(){let raw=std::fs::read_to_string(${JSON.stringify(fixture)}).unwrap();let catalog=lmspeed_models::Catalog::from_json(&raw).unwrap();assert!(!catalog.snapshot.data.models.is_empty());println!("rust revision={} models={}",catalog.revision(),catalog.snapshot.counts.models);}`,
);
await run(
  'cargo',
  ['run', '--quiet', '--manifest-path', join(rust, 'Cargo.toml')],
  temp,
);
process.stdout.write(
  `Clean artifact installations verified in ${temp}. Go public module installation is verified after its real tag is available.\n`,
);
