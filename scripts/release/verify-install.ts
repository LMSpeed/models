import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { run } from '../lib/process';
import { type Ecosystem, goModulePath, pythonVersion } from './state';
export async function verifyInstall(
  ecosystem: Ecosystem,
  version: string,
): Promise<void> {
  const temp = await mkdtemp(join(tmpdir(), `lmspeed-${ecosystem}-public-`));
  const response = await fetch('https://models.lmspeed.net/v1/api.json', {
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`Catalogue HTTP ${response.status}`);
  await writeFile(join(temp, 'api.json'), await response.text());
  if (ecosystem === 'npm') {
    await writeFile(
      join(temp, 'package.json'),
      '{"private":true,"type":"module"}',
    );
    run('pnpm', ['add', `@lmspeed/models@${version}`], { cwd: temp });
    await writeFile(
      join(temp, 'smoke.mjs'),
      `import {Catalog,SDK_VERSION} from '@lmspeed/models';import{readFile}from'node:fs/promises';const c=await Catalog.fromJson(await readFile('api.json','utf8'));if(SDK_VERSION!==${JSON.stringify(version)}||!c.filter({task:'image-generation'}).length)throw new Error('Published npm behavior failed');const m=Object.values(c.snapshot.data.models)[0];if(c.resolveModelId(m.id).canonicalId!==m.id)throw new Error('Offline identity failed');`,
    );
    run('node', ['smoke.mjs'], { cwd: temp });
  } else if (ecosystem === 'pypi') {
    run('uv', ['venv', '--python', '3.12', join(temp, 'venv')]);
    const python = join(temp, 'venv', 'bin', 'python');
    run('uv', [
      'pip',
      'install',
      '--python',
      python,
      `lmspeed-models==${pythonVersion(version)}`,
    ]);
    run(
      python,
      [
        '-c',
        `from lmspeed_models import Catalog,__version__;from pathlib import Path;c=Catalog.from_json(Path('api.json').read_text());assert __version__==${JSON.stringify(pythonVersion(version))};assert len(c.filter(task='image-generation'))>0`,
      ],
      { cwd: temp },
    );
  } else if (ecosystem === 'crates') {
    await mkdir(join(temp, 'src'));
    await writeFile(
      join(temp, 'Cargo.toml'),
      `[package]\nname="lmspeed-public-smoke"\nversion="0.0.0"\nedition="2021"\n[dependencies]\nlmspeed-models="=${version}"\n`,
    );
    await writeFile(
      join(temp, 'src/main.rs'),
      `fn main(){let c=lmspeed_models::Catalog::from_json(&std::fs::read_to_string("api.json").unwrap()).unwrap();assert_eq!(lmspeed_models::VERSION,"${version}");assert!(c.snapshot.counts.models>0);}`,
    );
    run('cargo', ['run', '--quiet'], { cwd: temp, timeout: 600000 });
  } else {
    await writeFile(
      join(temp, 'go.mod'),
      'module lmspeed-public-smoke\n\ngo 1.23.0\n',
    );
    run('go', ['get', `${goModulePath(version)}@v${version}`], {
      cwd: temp,
    });
    await writeFile(
      join(temp, 'main.go'),
      `package main\nimport("os"; models "${goModulePath(version)}")\nfunc main(){raw,e:=os.ReadFile("api.json");if e!=nil{panic(e)};c,e:=models.LoadJSON(raw);if e!=nil{panic(e)};if models.Version!="${version}"||c.Snapshot.Revision==0{panic("invalid public module")}}\n`,
    );
    run('go', ['run', '.'], { cwd: temp });
  }
  process.stdout.write(
    JSON.stringify({ ecosystem, version, installedFromPublicRegistry: true }) +
      '\n',
  );
}
if (process.argv[1]?.endsWith('verify-install.ts')) {
  const config = JSON.parse(await readFile('release.json', 'utf8'));
  await verifyInstall(process.argv[2] as Ecosystem, config.version);
}
