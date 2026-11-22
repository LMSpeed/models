import { execFileSync, spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
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
  go: [
    'go',
    [
      '-C',
      'sdk/go',
      'test',
      '-race',
      '-coverprofile=../../coverage/go.out',
      './...',
    ],
  ],
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
  if (language === 'python') {
    execFileSync(selected[0], [
      '-m',
      'coverage',
      'json',
      '-o',
      'coverage/python.json',
    ]);
    const report = JSON.parse(
      await readFile('coverage/python.json', 'utf8'),
    ) as { totals: { num_branches: number; covered_branches: number } };
    const branches =
      (report.totals.covered_branches / report.totals.num_branches) * 100;
    if (!Number.isFinite(branches) || branches < 70)
      throw new Error(`Python branch coverage below 70%: ${branches}`);
    process.stdout.write(`Python branch coverage: ${branches.toFixed(2)}%\n`);
  }
  if (language === 'rust' && process.env.MODELS_RUST_COVERAGE === '1') {
    const report = JSON.parse(await readFile('coverage/rust.json', 'utf8')) as {
      data: Array<{ totals: { branches: { percent: number } } }>;
    };
    const branches = report.data[0].totals.branches.percent;
    if (branches < 70)
      throw new Error(`Rust branch coverage below 70%: ${branches}`);
    process.stdout.write(`Rust branch coverage: ${branches.toFixed(2)}%\n`);
  }
  if (language === 'go') {
    const summary = execFileSync(
      'go',
      ['tool', 'cover', '-func=../../coverage/go.out'],
      { encoding: 'utf8', cwd: `${process.cwd()}/sdk/go` },
    );
    const statements = Number(
      /total:\s+\(statements\)\s+([\d.]+)%/.exec(summary)?.[1],
    );
    if (!Number.isFinite(statements) || statements < 70)
      throw new Error(`Go statement coverage below 70%: ${statements}`);
    process.stdout.write(
      `Go statement coverage (Go toolchain does not expose branches): ${statements}%\n`,
    );
  }
} finally {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
}
