import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { sha256 } from '../packages/core/src/index';

const valid = JSON.parse(
  await readFile(
    new URL('../fixtures/contracts/valid.json', import.meta.url),
    'utf8',
  ),
);
const etag = `"${valid.sha256}"`;
const attempts = new Map<string, number>();
const logos = {
  schemaVersion: 1,
  revision: valid.revision,
  models: Object.fromEntries(
    Object.keys(valid.data.models).map((modelId) => [
      modelId,
      {
        modelId,
        key: null,
        level: 'default',
        fallback: true,
        source: 'LMSpeed',
        version: '1',
        sha256: 'a'.repeat(64),
      },
    ]),
  ),
};
export const server = createServer(async (request, response) => {
  const path = new URL(request.url ?? '/', 'http://localhost').pathname;
  response.setHeader('access-control-allow-origin', '*');
  response.setHeader('content-type', 'application/json');
  if (path.includes('/slow/'))
    await new Promise((resolve) => setTimeout(resolve, 250));
  if (path.includes('/missing/')) {
    response.writeHead(404);
    response.end('{"error":"not_found"}');
    return;
  }
  if (path.endsWith('/logos.json')) {
    response.end(
      JSON.stringify(
        path.includes('/stale/') ? { ...logos, revision: 999 } : logos,
      ),
    );
    return;
  }
  if (path.endsWith('/coverage/models-dev.json')) {
    response.end(
      JSON.stringify({
        schemaVersion: 1,
        revision: path.includes('/stale/') ? 999 : valid.revision,
        baselineCommit: 'a'.repeat(40),
        supersetAchieved: false,
      }),
    );
    return;
  }
  if (path.endsWith('.svg')) {
    response.setHeader('content-type', 'image/svg+xml');
    response.end(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><path d="M0 0h1v1z"/></svg>',
    );
    return;
  }
  if (path.includes('/invalid/')) {
    response.end('invalid JSON');
    return;
  }
  if (path.includes('/incompatible/')) {
    response.end(JSON.stringify({ ...valid, schemaVersion: 2 }));
    return;
  }
  if (path.includes('/bad-hash/')) {
    response.end(JSON.stringify({ ...valid, sha256: '0'.repeat(64) }));
    return;
  }
  if (path.includes('/flaky-')) {
    const count = attempts.get(path) ?? 0;
    attempts.set(path, count + 1);
    if (count > 0) {
      response.end('invalid JSON');
      return;
    }
  }
  if (path.includes('/rewind-')) {
    const count = attempts.get(path) ?? 0;
    attempts.set(path, count + 1);
    const revision = count === 0 ? valid.revision + 1 : valid.revision;
    const data = {
      ...valid.data,
      aliases: { ...valid.data.aliases, revision },
    };
    const sha = await sha256(data);
    response.setHeader('etag', `"${sha}"`);
    response.end(JSON.stringify({ ...valid, data, revision, sha256: sha }));
    return;
  }
  response.setHeader('etag', etag);
  if (request.headers['if-none-match'] === etag) {
    response.writeHead(304);
    response.end();
    return;
  }
  if (path.includes('/extension/')) {
    const data = { ...valid.data, newField: 'new optional data' };
    response.end(
      JSON.stringify({ ...valid, data, sha256: await sha256(data) }),
    );
    return;
  }
  response.end(JSON.stringify(valid));
});
if (process.argv[1]?.endsWith('http-fixture.ts')) {
  server.listen(0, '127.0.0.1', () => {
    const address = server.address();
    if (address && typeof address !== 'string')
      process.stdout.write(`http://127.0.0.1:${address.port}\n`);
  });
}
