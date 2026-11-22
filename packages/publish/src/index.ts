import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import {
  type Model,
  routeManifest,
  schemaDocument,
} from '@lmspeed/models-core';
import { XMLValidator } from 'fast-xml-parser';
import { readSnapshot } from '../../../scripts/sync-lib';

function repositoryRoot(start: string): string {
  if (
    existsSync(join(start, 'data/manifest.json')) &&
    existsSync(join(start, 'logos/mapping.json'))
  )
    return start;
  const parent = dirname(start);
  if (parent === start) throw new Error('Model data root not found');
  return repositoryRoot(parent);
}
export const root = repositoryRoot(process.cwd());
export const snapshot = await readSnapshot(root);
export const routes = routeManifest(snapshot.data);
export const schema = schemaDocument();
const require = createRequire(join(root, 'packages/publish/package.json'));
const iconsRoot = dirname(
  require.resolve('@lobehub/icons-static-svg/package.json'),
);
const iconPackage = JSON.parse(
  await readFile(join(iconsRoot, 'package.json'), 'utf8'),
) as { version: string };
export type LogoMapping = {
  models: Record<string, string>;
  families: Record<string, string>;
  developers: Record<string, string>;
};
export const mapping = JSON.parse(
  await readFile(join(root, 'logos/mapping.json'), 'utf8'),
) as LogoMapping;
export const defaultSvg =
  '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect x="4" y="4" width="56" height="56" rx="16" fill="#0f766e"/><path d="M18 43V21h6l8 12 8-12h6v22h-6V31l-8 11-8-11v12z" fill="#fff"/></svg>';
export function sanitizeSvg(value: string): string {
  const attributesRemoved = value.replace(
    /xmlns(?:[:\w]*)?=["'][^"']*["']/g,
    '',
  );
  if (
    XMLValidator.validate(value) !== true ||
    !/<svg[\s>]/i.test(value) ||
    /<!DOCTYPE|<!ENTITY|<\s*(script|foreignObject|iframe|object|embed|image|a)\b|\bon[a-z]+\s*=|(?:href|src)\s*=\s*["'](?!#)|url\(\s*["']?(?!#)|@import|javascript:|data:|https?:/i.test(
      attributesRemoved,
    )
  )
    throw new Error('Unsafe SVG resource');
  return value.replace(/currentColor/g, '#111827');
}
export function selectLogo(
  model: Model,
  index: LogoMapping,
): { key: string | null; level: string } {
  if (index.models[model.id])
    return { key: index.models[model.id], level: 'model' };
  if (model.familyId && index.families[model.familyId])
    return { key: index.families[model.familyId], level: 'family' };
  if (index.developers[model.developerId])
    return { key: index.developers[model.developerId], level: 'developer' };
  return { key: null, level: 'default' };
}
export type Logo = {
  modelId: string;
  key: string | null;
  level: string;
  fallback: boolean;
  source: string;
  version: string;
  sha256: string;
  svg: string;
};
const cache = new Map<string, Promise<Logo>>();
export function logoFor(model: Model): Promise<Logo> {
  const current = cache.get(model.id);
  if (current) return current;
  const work = (async () => {
    const { key, level } = selectLogo(model, mapping);
    let svg = defaultSvg;
    let source = 'LMSpeed';
    let version = '1';
    if (key) {
      if (!/^[a-z0-9-]+$/.test(key))
        throw new Error(`Invalid logo key: ${key}`);
      let file: string | undefined;
      for (const candidate of [`${key}-color.svg`, `${key}.svg`]) {
        try {
          svg = await readFile(join(iconsRoot, 'icons', candidate), 'utf8');
          file = candidate;
          break;
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        }
      }
      if (!file) throw new Error(`Missing pinned logo resource: ${key}`);
      source = '@lobehub/icons-static-svg';
      version = iconPackage.version;
    }
    svg = sanitizeSvg(svg);
    return {
      modelId: model.id,
      key,
      level,
      fallback: key === null,
      source,
      version,
      sha256: createHash('sha256').update(svg).digest('hex'),
      svg,
    };
  })();
  cache.set(model.id, work);
  return work;
}
export async function logoIndex() {
  return {
    schemaVersion: 1,
    revision: snapshot.revision,
    models: Object.fromEntries(
      await Promise.all(
        Object.values(snapshot.data.models).map(async (model) => {
          const { svg: _svg, ...metadata } = await logoFor(model);
          return [model.id, metadata];
        }),
      ),
    ),
  };
}
