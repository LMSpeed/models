import { spawn } from 'node:child_process';
import { server } from './http-fixture';

const language = process.argv[2];
const commands: Record<string, [string, string[]]> = {
  javascript: [
    'pnpm',
    ['exec', 'vitest', 'run', 'sdk/javascript', '--coverage.enabled=false'],
  ],
  python: [
    'sdk/python/.venv/bin/python',
    [
      '-m',
      'coverage',
      'run',
      '--branch',
      '--source=lmspeed_models',
      '-m',
      'unittest',
      'discover',
      '-s',
      'sdk/python/tests',
      '-v',
    ],
  ],
  rust: [
    'cargo',
    ['test', '--locked', '--manifest-path', 'sdk/rust/Cargo.toml'],
  ],
  go: ['go', ['-C', 'sdk/go', 'test', '-race', './...']],
};
if (language === 'rust' && process.env.MODELS_RUST_COVERAGE === '1')
  commands.rust = [
    'cargo',
    [
      '+nightly-2026-11-21',
      'llvm-cov',
      '--branch',
      '--locked',
      '--manifest-path',
      'sdk/rust/Cargo.toml',
      '--json',
      '--output-path',
      'coverage/rust.json',
    ],
  ];
const selected = commands[language];
if (!selected) throw new Error('Unknown SDK language');
await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
if (!address || typeof address === 'string')
  throw new Error('No HTTP contract listener');
try {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(selected[0], selected[1], {
      stdio: 'inherit',
      env: {
        ...process.env,
        MODEL_TEST_BASE_URL: `http://127.0.0.1:${address.port}`,
        MODELS_DATA_FILE: `${process.cwd()}/apps/site/dist/v1/api.json`,
      },
    });
    child.once('error', reject);
    child.once('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`${language} failed: ${code}`)),
    );
  });
} finally {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
}
