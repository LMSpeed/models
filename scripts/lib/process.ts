import { execFileSync } from 'node:child_process';
export function run(
  command: string,
  args: string[],
  options: {
    cwd?: string;
    input?: string;
    quiet?: boolean;
    timeout?: number;
  } = {},
): string {
  return execFileSync(command, args, {
    cwd: options.cwd ?? process.cwd(),
    input: options.input,
    encoding: 'utf8',
    timeout: options.timeout ?? 300000,
    maxBuffer: 16 * 1024 * 1024,
    stdio: ['pipe', options.quiet ? 'pipe' : 'pipe', 'pipe'],
  }).trim();
}
export function api<T>(path: string, method = 'GET', body?: unknown): T {
  return JSON.parse(
    run(
      'gh',
      ['api', path, '--method', method, ...(body ? ['--input', '-'] : [])],
      { input: body ? JSON.stringify(body) : undefined, timeout: 30000 },
    ),
  ) as T;
}
