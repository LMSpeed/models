import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

export interface Deployment {
  commit: string;
  revision: number;
  sha256: string;
}

export function assertDeployment(
  artifact: Deployment,
  expected: Deployment,
  head: string,
  live?: Deployment,
): void {
  if (head !== expected.commit)
    throw new Error('A newer main commit superseded this deployment');
  if (
    artifact.commit !== expected.commit ||
    artifact.revision !== expected.revision ||
    artifact.sha256 !== expected.sha256
  )
    throw new Error(
      'Static artifact does not belong to this commit and dataset',
    );
  if (live && live.revision > expected.revision)
    throw new Error('Production contains newer data');
  if (
    live &&
    live.revision === expected.revision &&
    live.sha256 !== expected.sha256
  )
    throw new Error('Production revision hash mismatch');
}

export async function digestDirectory(directory: string): Promise<string> {
  const hash = createHash('sha256');
  async function visit(path: string): Promise<void> {
    for (const entry of (await readdir(path, { withFileTypes: true })).sort(
      (a, b) => a.name.localeCompare(b.name, 'en'),
    )) {
      const full = join(path, entry.name);
      if (entry.isDirectory()) await visit(full);
      else {
        hash.update(relative(directory, full).replaceAll('\\', '/'));
        hash.update(await readFile(full));
      }
    }
  }
  await visit(directory);
  return hash.digest('hex');
}

export async function mainCommit(): Promise<string> {
  const response = await fetch(
    'https://api.github.com/repos/LMSpeed/models/git/ref/heads/main',
    {
      headers: {
        accept: 'application/vnd.github+json',
        ...(process.env.GH_TOKEN
          ? { authorization: `Bearer ${process.env.GH_TOKEN}` }
          : {}),
      },
      signal: AbortSignal.timeout(30000),
    },
  );
  if (!response.ok)
    throw new Error(`Cannot verify main: HTTP ${response.status}`);
  const value = (await response.json()) as { object: { sha: string } };
  if (!/^[a-f0-9]{40}$/.test(value.object.sha))
    throw new Error('Invalid main commit');
  return value.object.sha;
}

export async function awaitDeployment(
  base: string,
  expected: Deployment,
  options: { retryDelayMs?: number } = {},
): Promise<Deployment> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(`${base}/deployment.json`, {
        signal: AbortSignal.timeout(30000),
      });
      if (!response.ok)
        throw new Error(`Deployment metadata HTTP ${response.status}`);
      const actual = (await response.json()) as Deployment;
      assertDeployment(actual, expected, expected.commit);
      return actual;
    } catch (error) {
      lastError = error;
      if (attempt < 3)
        await new Promise((resolve) =>
          setTimeout(resolve, options.retryDelayMs ?? 30000),
        );
    }
  }
  throw new Error(
    `Static artifact unavailable after 3 attempts: ${String(lastError)}`,
  );
}
