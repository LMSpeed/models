import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile } from 'node:fs/promises';
import { api, run } from '../lib/process';
import {
  beginAttempt,
  bodyWithState,
  type Ecosystem,
  enabledEcosystems,
  finishAttempt,
  pythonVersion,
  type ReleaseState,
  releaseComplete,
  stateFromBody,
} from './state';
import { verifyInstall } from './verify-install';

const repository = process.env.GITHUB_REPOSITORY ?? 'LMSpeed/models';
type Release = {
  id: number;
  tag_name: string;
  body: string;
  draft: boolean;
  assets: Array<{ name: string }>;
};
type Manifest = {
  version: string;
  commit: string;
  schemaVersion: number;
  files: Record<string, string>;
};
const config = JSON.parse(await readFile('release.json', 'utf8')) as {
  version: string;
  schemaVersion: number;
};
const tag = `sdk-v${config.version}`;
const commit = run('git', ['rev-parse', 'HEAD']);
const existing = api<Release[]>(
  `repos/${repository}/releases?per_page=100`,
).find((item) => item.tag_name === tag);
let release: Release;
let manifest: Manifest;
await mkdir('.artifacts', { recursive: true });
if (existing) {
  release = existing;
  run('gh', [
    'release',
    'download',
    tag,
    '--repo',
    repository,
    '--dir',
    '.artifacts',
    '--clobber',
  ]);
  manifest = JSON.parse(
    await readFile('.artifacts/manifest.json', 'utf8'),
  ) as Manifest;
} else {
  run('pnpm', ['exec', 'tsx', 'scripts/release/build.ts']);
  manifest = JSON.parse(
    await readFile('.artifacts/manifest.json', 'utf8'),
  ) as Manifest;
  const notes = await readFile('release-notes.md', 'utf8');
  const state: ReleaseState = {
    version: config.version,
    commit,
    schemaVersion: config.schemaVersion,
    artifacts: manifest.files,
    ecosystems: Object.fromEntries(
      ['npm', 'pypi', 'crates', 'go'].map((key) => [
        key,
        { attempts: 0, status: 'pending' },
      ]),
    ) as ReleaseState['ecosystems'],
  };
  const priorTag = await fetch(
    `https://api.github.com/repos/${repository}/git/ref/tags/${tag}`,
    {
      signal: AbortSignal.timeout(30000),
      headers: {
        'user-agent':
          'LMSpeed-models-release (https://github.com/LMSpeed/models)',
      },
    },
  );
  if (priorTag.status !== 404)
    throw new Error(
      'Release tag already exists without its immutable artifact manifest',
    );
  api(`repos/${repository}/git/refs`, 'POST', {
    ref: `refs/tags/${tag}`,
    sha: commit,
  });
  release = api<Release>(`repos/${repository}/releases`, 'POST', {
    tag_name: tag,
    target_commitish: commit,
    name: `SDK ${config.version}`,
    draft: true,
    prerelease: config.version.includes('-'),
    body: bodyWithState(notes, state),
  });
  run('gh', [
    'release',
    'upload',
    tag,
    ...(await readdir('.artifacts')).map((name) => `.artifacts/${name}`),
    '--repo',
    repository,
  ]);
}
let state = stateFromBody(release.body);
if (
  manifest.version !== config.version ||
  manifest.commit !== state.commit ||
  manifest.schemaVersion !== state.schemaVersion ||
  commit !== state.commit
)
  throw new Error('Release version is bound to another commit');
for (const [name, hash] of Object.entries(manifest.files))
  if (
    createHash('sha256')
      .update(await readFile(`.artifacts/${name}`))
      .digest('hex') !== hash ||
    state.artifacts[name] !== hash
  )
    throw new Error(`Immutable artifact mismatch: ${name}`);
if (process.env.GITHUB_SHA && process.env.GITHUB_SHA !== manifest.commit) {
  run('gh', [
    'workflow',
    'run',
    'release-sdks.yml',
    '--repo',
    repository,
    '--ref',
    tag,
  ]);
  process.stdout.write(
    `Publication resumes from immutable tag ${tag}; registry provenance will name the actual source commit.\n`,
  );
  process.exit(0);
}
const notes = release.body.split('\n\n<!-- lmspeed-release-state')[0];
const save = () => {
  release = api<Release>(
    `repos/${repository}/releases/${release.id}`,
    'PATCH',
    { body: bodyWithState(notes, state), draft: !releaseComplete(state) },
  );
};
async function remote(path: string): Promise<unknown | undefined> {
  const response = await fetch(path, {
    signal: AbortSignal.timeout(30000),
    headers: {
      'user-agent':
        'LMSpeed-models-release (https://github.com/LMSpeed/models)',
    },
  });
  if (response.status === 404) return undefined;
  if (!response.ok) throw new Error(`Registry HTTP ${response.status}`);
  return response.json();
}
async function assertHash(url: string, name: string) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(30000),
    headers: {
      'user-agent':
        'LMSpeed-models-release (https://github.com/LMSpeed/models)',
    },
  });
  if (!response.ok)
    throw new Error(`Published artifact HTTP ${response.status}`);
  const hash = createHash('sha256')
    .update(new Uint8Array(await response.arrayBuffer()))
    .digest('hex');
  if (hash !== manifest.files[name])
    throw new Error(
      `Published artifact differs from release manifest: ${name}`,
    );
}
async function publish(ecosystem: Ecosystem) {
  const names = Object.keys(manifest.files);
  if (ecosystem === 'npm') {
    const name = names.find((name) => name.endsWith('.tgz'))!;
    let value = (await remote(
      `https://registry.npmjs.org/@lmspeed%2fmodels/${config.version}`,
    )) as { dist: { tarball: string } } | undefined;
    if (!value) {
      run('npm', [
        'publish',
        `.artifacts/${name}`,
        '--access',
        'public',
        '--provenance',
        '--tag',
        config.version.includes('-') ? 'next' : 'latest',
      ]);
      value = (await remote(
        `https://registry.npmjs.org/@lmspeed%2fmodels/${config.version}`,
      )) as typeof value;
    }
    if (!value) throw new Error('Published npm version not visible');
    await assertHash(value.dist.tarball, name);
  } else if (ecosystem === 'pypi') {
    const version = pythonVersion(config.version);
    let value = (await remote(
      `https://pypi.org/pypi/lmspeed-models/${version}/json`,
    )) as
      | { urls: Array<{ filename: string; digests: { sha256: string } }> }
      | undefined;
    const required = names.filter((name) => /\.(whl|tar.gz)$/.test(name));
    if (
      !value ||
      required.some(
        (name) => !value?.urls.some((file) => file.filename === name),
      )
    ) {
      run('uv', [
        'publish',
        '--trusted-publishing',
        'always',
        '--check-url',
        'https://pypi.org/simple',
        ...required.map((name) => `.artifacts/${name}`),
      ]);
      value = (await remote(
        `https://pypi.org/pypi/lmspeed-models/${version}/json`,
      )) as typeof value;
    }
    for (const name of required)
      if (
        value?.urls.find((file) => file.filename === name)?.digests.sha256 !==
        manifest.files[name]
      )
        throw new Error(`PyPI artifact mismatch: ${name}`);
  } else if (ecosystem === 'crates') {
    const name = names.find((name) => name.endsWith('.crate'))!;
    let value = await remote(
      `https://crates.io/api/v1/crates/lmspeed-models/${config.version}`,
    );
    if (!value) {
      const token = process.env.CARGO_REGISTRY_TOKEN;
      if (!token) throw new Error('Missing scoped crates.io publication token');
      const metadata = await readFile('.artifacts/crate-metadata.json');
      const crate = await readFile(`.artifacts/${name}`);
      const size = Buffer.alloc(4);
      size.writeUInt32LE(metadata.length);
      const crateSize = Buffer.alloc(4);
      crateSize.writeUInt32LE(crate.length);
      const result = await fetch('https://crates.io/api/v1/crates/new', {
        method: 'PUT',
        headers: {
          authorization: token,
          'content-type': 'application/octet-stream',
          accept: 'application/json',
          'user-agent':
            'LMSpeed-models-release (https://github.com/LMSpeed/models)',
        },
        body: Buffer.concat([size, metadata, crateSize, crate]),
        signal: AbortSignal.timeout(30000),
      });
      if (!result.ok)
        throw new Error(
          `Crate upload HTTP ${result.status}: ${(await result.text()).slice(0, 500)}`,
        );
      value = await remote(
        `https://crates.io/api/v1/crates/lmspeed-models/${config.version}`,
      );
    }
    if (!value) throw new Error('Published crate not visible');
    await assertHash(
      `https://crates.io/api/v1/crates/lmspeed-models/${config.version}/download`,
      name,
    );
  } else {
    const goTag = `sdk/go/v${config.version}`;
    const refs = api<Array<{ ref: string; object: { sha: string } }>>(
      `repos/${repository}/git/matching-refs/tags/${goTag}`,
    );
    const ref = refs.find((item) => item.ref === `refs/tags/${goTag}`);
    if (ref && ref.object.sha !== commit)
      throw new Error('Go module tag points to another commit');
    if (!ref)
      api(`repos/${repository}/git/refs`, 'POST', {
        ref: `refs/tags/${goTag}`,
        sha: commit,
      });
  }
  await verifyInstall(ecosystem, config.version);
}
const failures: string[] = [];
const enabled = enabledEcosystems(process.env.SDK_PUBLISH_ECOSYSTEMS);
for (const ecosystem of ['npm', 'pypi', 'crates', 'go'] as const) {
  if (state.ecosystems[ecosystem].status === 'verified') continue;
  if (!enabled.includes(ecosystem)) {
    state.ecosystems[ecosystem].error =
      'Publishing deferred by repository configuration; retry budget is unchanged';
    save();
    failures.push(`${ecosystem}: publication is explicitly deferred`);
    continue;
  }
  if (state.ecosystems[ecosystem].attempts >= 3) {
    failures.push(`${ecosystem}: attempt budget exhausted`);
    continue;
  }
  state = beginAttempt(state, ecosystem);
  save();
  try {
    await publish(ecosystem);
    state = finishAttempt(state, ecosystem, true);
  } catch (error) {
    state = finishAttempt(state, ecosystem, false, String(error));
    failures.push(`${ecosystem}: ${String(error)}`);
  }
  save();
}
if (failures.length) throw new Error(failures.join('\n'));
if (!releaseComplete(state)) throw new Error('Release remains incomplete');
process.stdout.write(
  JSON.stringify({
    version: state.version,
    commit: state.commit,
    complete: true,
    ecosystems: state.ecosystems,
  }) + '\n',
);
