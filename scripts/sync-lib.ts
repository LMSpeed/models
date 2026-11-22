import {
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  canonicalJson,
  type Snapshot,
  validateSnapshot,
} from '../packages/core/src/index';
export async function readSnapshot(root: string): Promise<Snapshot> {
  const manifest = JSON.parse(
    await readFile(join(root, 'data/manifest.json'), 'utf8'),
  ) as Omit<Snapshot, 'data'> & { modelIds: string[]; developerIds: string[] };
  const models = Object.fromEntries(
    await Promise.all(
      manifest.modelIds.map(async (id) => [
        id,
        JSON.parse(
          await readFile(join(root, `data/models/${id}.json`), 'utf8'),
        ),
      ]),
    ),
  );
  const developers = Object.fromEntries(
    await Promise.all(
      manifest.developerIds.map(async (id) => [
        id,
        JSON.parse(
          await readFile(join(root, `data/developers/${id}.json`), 'utf8'),
        ),
      ]),
    ),
  );
  const [aliases, redirects, upstreams] = await Promise.all(
    ['aliases', 'redirects', 'upstreams'].map(async (name) =>
      JSON.parse(await readFile(join(root, `data/${name}.json`), 'utf8')),
    ),
  );
  const { modelIds: _models, developerIds: _developers, ...header } = manifest;
  return validateSnapshot({
    ...header,
    data: { models, developers, aliases, redirects, upstreams },
  });
}
export async function writeSnapshot(
  root: string,
  input: unknown,
  allowReviewChanges = false,
): Promise<boolean> {
  const snapshot = await validateSnapshot(input);
  let previous: Snapshot | undefined;
  try {
    previous = await readSnapshot(root);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  if (previous) {
    if (snapshot.revision < previous.revision)
      throw new Error('Snapshot revision regressed');
    if (snapshot.revision === previous.revision) {
      if (snapshot.sha256 !== previous.sha256)
        throw new Error('Same revision has different contents');
      return false;
    }
    const removed = Object.keys(previous.data.models).filter(
      (id) => !Object.hasOwn(snapshot.data.models, id),
    );
    const withdrawn = Object.entries(snapshot.data.models).filter(
      ([id, model]) =>
        ['retired', 'deprecated'].includes(model.lifecycle ?? '') &&
        previous.data.models[id]?.lifecycle !== model.lifecycle,
    );
    const lostAliases = previous.data.aliases.models.filter(
      (alias) =>
        !snapshot.data.aliases.models.some(
          (next) =>
            next.namespace === alias.namespace && next.value === alias.value,
        ),
    );
    const previousAliases = new Map(
      previous.data.aliases.models
        .filter((a) => a.kind === 'fixed')
        .map((a) => [`${a.namespace}:${a.value}`, a.canonicalId]),
    );
    const repointed = snapshot.data.aliases.models.filter(
      (a) =>
        previousAliases.has(`${a.namespace}:${a.value}`) &&
        previousAliases.get(`${a.namespace}:${a.value}`) !== a.canonicalId,
    );
    if (
      !allowReviewChanges &&
      (removed.length ||
        withdrawn.length ||
        lostAliases.length ||
        repointed.length ||
        canonicalJson(previous.data.redirects) !==
          canonicalJson(snapshot.data.redirects))
    )
      throw new Error(
        `Review required for deletion, withdrawal, merge or identity change: ${removed.join(',')}`,
      );
  }
  const stage = await mkdtemp(join(tmpdir(), 'models-sync-'));
  try {
    await Promise.all(
      ['models', 'developers'].map((name) =>
        mkdir(join(stage, name), { recursive: true }),
      ),
    );
    const write = (path: string, value: unknown) =>
      writeFile(join(stage, path), `${canonicalJson(value)}\n`);
    await Promise.all([
      ...Object.entries(snapshot.data.models).map(([id, model]) =>
        write(`models/${id}.json`, model),
      ),
      ...Object.entries(snapshot.data.developers).map(([id, developer]) =>
        write(`developers/${id}.json`, developer),
      ),
      ...['aliases', 'redirects', 'upstreams'].map((key) =>
        write(`${key}.json`, snapshot.data[key as keyof typeof snapshot.data]),
      ),
    ]);
    const { data, ...manifest } = snapshot;
    await write('manifest.json', {
      ...manifest,
      modelIds: Object.keys(data.models).sort(),
      developerIds: Object.keys(data.developers).sort(),
    });
    await mkdir(root, { recursive: true });
    const destination = join(root, 'data');
    const backup = join(root, '.data-previous');
    // Keep LICENSE and attribution files through an atomic directory replacement.
    for (const name of ['LICENSE', 'NOTICE.md']) {
      try {
        await writeFile(
          join(stage, name),
          await readFile(join(destination, name)),
        );
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
    }
    const localStage = join(root, '.data-candidate');
    await rm(localStage, { recursive: true, force: true });
    const { cp } = await import('node:fs/promises');
    await cp(stage, localStage, { recursive: true });
    try {
      await rename(destination, backup);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    try {
      await rename(localStage, destination);
    } catch (error) {
      await rename(backup, destination);
      throw error;
    }
    await rm(backup, { recursive: true, force: true });
    return true;
  } finally {
    await rm(stage, { recursive: true, force: true });
  }
}
