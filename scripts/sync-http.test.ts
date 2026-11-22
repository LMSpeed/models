import { execFile } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';
import { readSnapshot } from './sync-lib';

describe('user avoids empty data commits while source checks stay observable', () => {
  it.each([
    { daily: false, upstreamChanged: false },
    { daily: true, upstreamChanged: false },
    { daily: true, upstreamChanged: true },
  ])(
    'user checks unchanged data with daily=$daily and upstreamChanged=$upstreamChanged',
    async ({ daily, upstreamChanged }) => {
      // Given a real catalogue and the conditional HTTP contract verified against the static preview.
      const root = process.cwd();
      const directory = await mkdtemp(join(tmpdir(), 'models-304-'));
      await cp(join(root, 'data'), join(directory, 'data'), {
        recursive: true,
      });
      await mkdir(join(directory, 'coverage'));
      const snapshot = await readSnapshot(directory);
      const report = JSON.parse(
        await readFile(join(root, 'coverage/models-dev.json'), 'utf8'),
      ) as Record<string, unknown>;
      const initial = {
        ...report,
        lastCheckedAt: '2026-11-22T00:00:00Z',
        lastSuccessfulCheckAt: '2026-11-22T00:00:00Z',
      };
      const before = `${JSON.stringify(initial, null, 2)}\n`;
      await writeFile(join(directory, 'coverage/models-dev.json'), before);
      const updated = {
        ...initial,
        lastCheckedAt: '2026-11-22T01:00:00Z',
        lastSuccessfulCheckAt: '2026-11-22T01:00:00Z',
        ...(upstreamChanged
          ? {
              latestCheckedCommit: 'a'.repeat(40),
              behindLatest: true,
              supersetAchieved: false,
            }
          : {}),
      };
      const server = createServer((request, response) => {
        response.setHeader('etag', `"${snapshot.sha256}"`);
        if (request.url?.endsWith('/coverage')) {
          response
            .writeHead(200, { 'content-type': 'application/json' })
            .end(JSON.stringify(updated));
        } else if (
          request.headers['if-none-match'] === `"${snapshot.sha256}"`
        ) {
          response.writeHead(304).end();
        } else {
          response
            .writeHead(200, { 'content-type': 'application/json' })
            .end(JSON.stringify(snapshot));
        }
      });
      await new Promise<void>((resolve) =>
        server.listen(0, '127.0.0.1', resolve),
      );
      const address = server.address();
      if (!address || typeof address === 'string')
        throw new Error('No source contract listener');
      try {
        // When the actual synchronization CLI checks data and optionally upstream coverage.
        await promisify(execFile)(
          process.execPath,
          [
            join(root, 'node_modules/tsx/dist/cli.mjs'),
            join(root, 'scripts/sync.ts'),
          ],
          {
            cwd: directory,
            env: {
              ...process.env,
              MODEL_SPECS_SOURCE: `http://127.0.0.1:${address.port}/api/v1/model-specs`,
              CHECK_UPSTREAM_COVERAGE: daily ? '1' : '0',
            },
            timeout: 30000,
          },
        );
        // Then only a real coverage change updates Git content; every successful check gets a heartbeat.
        const after = await readFile(
          join(directory, 'coverage/models-dev.json'),
          'utf8',
        );
        expect(after).toBe(
          upstreamChanged ? `${JSON.stringify(updated, null, 2)}\n` : before,
        );
        expect((await readSnapshot(directory)).sha256).toBe(snapshot.sha256);
        const heartbeat = JSON.parse(
          await readFile(join(directory, '.sync/last-success.json'), 'utf8'),
        ) as { revision: number; checkedAt: string };
        expect(heartbeat.revision).toBe(snapshot.revision);
        expect(Number.isFinite(Date.parse(heartbeat.checkedAt))).toBe(true);
      } finally {
        server.closeAllConnections();
        await new Promise<void>((resolve) => server.close(() => resolve()));
        await rm(directory, { recursive: true, force: true });
      }
    },
    30000,
  );
});
