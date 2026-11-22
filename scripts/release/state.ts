export type Ecosystem = 'npm' | 'pypi' | 'crates' | 'go';
export type ReleaseState = {
  version: string;
  commit: string;
  schemaVersion: number;
  artifacts: Record<string, string>;
  ecosystems: Record<
    Ecosystem,
    {
      attempts: number;
      status: 'pending' | 'publishing' | 'published' | 'verified' | 'blocked';
      error?: string;
    }
  >;
};
export function beginAttempt(
  state: ReleaseState,
  ecosystem: Ecosystem,
): ReleaseState {
  const item = state.ecosystems[ecosystem];
  if (item.status === 'verified')
    throw new Error(`Already verified: ${ecosystem}`);
  if (item.status === 'blocked' || item.attempts >= 3)
    throw new Error(`Release attempt budget exhausted: ${ecosystem}`);
  const next = structuredClone(state);
  next.ecosystems[ecosystem] = {
    attempts: item.attempts + 1,
    status: 'publishing',
  };
  return next;
}
export function finishAttempt(
  state: ReleaseState,
  ecosystem: Ecosystem,
  verified: boolean,
  error?: string,
): ReleaseState {
  if (
    state.ecosystems[ecosystem].status !== 'publishing' &&
    state.ecosystems[ecosystem].status !== 'published'
  )
    throw new Error('No active ecosystem attempt');
  const next = structuredClone(state);
  next.ecosystems[ecosystem] = {
    attempts: state.ecosystems[ecosystem].attempts,
    status: verified
      ? 'verified'
      : state.ecosystems[ecosystem].attempts >= 3
        ? 'blocked'
        : 'pending',
    ...(error ? { error } : {}),
  };
  return next;
}
export function releaseComplete(state: ReleaseState): boolean {
  return Object.values(state.ecosystems).every(
    (item) => item.status === 'verified',
  );
}
export function enabledEcosystems(value = 'npm,pypi,crates,go'): Ecosystem[] {
  const names = value
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);
  if (names.some((name) => !['npm', 'pypi', 'crates', 'go'].includes(name)))
    throw new Error('Invalid enabled publication ecosystem');
  return [...new Set(names)] as Ecosystem[];
}
export function recoverableEcosystems(
  state: ReleaseState,
  enabled?: string,
): Ecosystem[] {
  return enabledEcosystems(enabled).filter((name) => {
    const item = state.ecosystems[name];
    return (
      item.status !== 'verified' &&
      item.status !== 'blocked' &&
      item.attempts < 3
    );
  });
}
function parseVersion(version: string): {
  major: number;
  minor: number;
  patch: number;
  channel?: string;
  sequence?: number;
} {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-(alpha|beta|rc)\.(\d+))?$/.exec(
    version,
  );
  if (!match) throw new Error(`Unsupported semantic version: ${version}`);
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    channel: match[4],
    sequence: match[5] ? Number(match[5]) : undefined,
  };
}
export function nextVersion(
  version: string,
  changes: Array<{ type: 'patch' | 'minor' | 'major'; summary: string }>,
): string {
  const parsed = parseVersion(version);
  if (!changes.length) return version;
  if (changes.some((c) => c.type === 'major')) {
    parsed.major++;
    parsed.minor = 0;
    parsed.patch = 0;
  } else if (changes.some((c) => c.type === 'minor')) {
    parsed.minor++;
    parsed.patch = 0;
  } else parsed.patch++;
  const core = `${parsed.major}.${parsed.minor}.${parsed.patch}`;
  return parsed.channel ? `${core}-${parsed.channel}.1` : core;
}
export function pythonVersion(version: string): string {
  const parsed = parseVersion(version);
  return `${parsed.major}.${parsed.minor}.${parsed.patch}${parsed.channel ? `${({ alpha: 'a', beta: 'b', rc: 'rc' } as Record<string, string>)[parsed.channel]}${parsed.sequence}` : ''}`;
}
export function stateFromBody(body: string): ReleaseState {
  const match = /<!-- lmspeed-release-state\n([\s\S]*?)\n-->/.exec(body);
  if (!match) throw new Error('Release has no recoverable state manifest');
  const state = JSON.parse(match[1]) as ReleaseState;
  parseVersion(state.version);
  if (!/^[a-f0-9]{40}$/.test(state.commit) || state.schemaVersion !== 1)
    throw new Error('Invalid release identity');
  for (const name of ['npm', 'pypi', 'crates', 'go'] as const)
    if (
      !state.ecosystems[name] ||
      !Number.isInteger(state.ecosystems[name].attempts) ||
      state.ecosystems[name].attempts < 0 ||
      state.ecosystems[name].attempts > 3
    )
      throw new Error('Invalid release attempt ledger');
  return state;
}
export function bodyWithState(notes: string, state: ReleaseState): string {
  return `${notes}\n\n<!-- lmspeed-release-state\n${JSON.stringify(state, null, 2)}\n-->`;
}

export function goModulePath(version: string): string {
  const parsed = parseVersion(version);
  return `github.com/lmspeed/models/sdk/go${parsed.major >= 2 ? `/v${parsed.major}` : ''}`;
}
