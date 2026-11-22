import { spawn } from 'node:child_process';
import { server } from './http-fixture';

await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
if (!address || typeof address === 'string')
  throw new Error('Test HTTP service unavailable');
const env = {
  ...process.env,
  MODELS_DATA_FILE: `${process.cwd()}/apps/site/dist/v1/api.json`,
  MODEL_TEST_BASE_URL: `http://127.0.0.1:${address.port}`,
};
const run = (command: string, args: string[]) =>
  new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', env });
    child.once('error', reject);
    child.once('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`${command} exited ${code}`)),
    );
  });
try {
  const results = await Promise.allSettled([
    run('pnpm', ['exec', 'vitest', 'run', '--coverage']),
    run('sdk/python/.venv/bin/python', [
      '-m',
      'unittest',
      'discover',
      '-s',
      'sdk/python/tests',
      '-v',
    ]),
    run('go', [
      '-C',
      'sdk/go',
      'test',
      '-race',
      '-coverprofile=../../coverage/go.out',
      './...',
    ]),
    run('cargo', [
      'test',
      '--locked',
      '--manifest-path',
      'sdk/rust/Cargo.toml',
    ]),
  ]);
  const failed = results.filter((r) => r.status === 'rejected');
  if (failed.length)
    throw new AggregateError(
      failed.map((r) => (r as PromiseRejectedResult).reason),
      'SDK contract checks failed',
    );
} finally {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
}
