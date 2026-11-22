import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { expect, it } from 'vitest';
import { awaitDeployment } from './deployment';

it('user verifies a new static domain after its registered artifact becomes reachable', async () => {
  // Given Cloudflare's verified missing-file 404 and deployment.json contracts while a new domain is being registered.
  const expected = {
    commit: 'a'.repeat(40),
    revision: 2,
    sha256: 'b'.repeat(64),
  };
  let registered = false;
  const server = createServer((_request, response) => {
    if (!registered) {
      registered = true;
      response.writeHead(404).end();
    } else
      response
        .writeHead(200, { 'content-type': 'application/json' })
        .end(JSON.stringify(expected));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    // When deployment waits through that propagation boundary using an isolated HTTP service and a zero-delay test clock.
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const actual = await awaitDeployment(base, expected, { retryDelayMs: 0 });
    // Then the initial publication verifies the exact artifact instead of failing before the first real smoke request.
    expect(actual).toEqual(expected);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
