import { describe, expect, it } from 'vitest';
import {
  beginAttempt,
  finishAttempt,
  nextVersion,
  pythonVersion,
  type ReleaseState,
  releaseComplete,
} from './state';

const initial: ReleaseState = {
  version: '1.2.3',
  commit: 'a'.repeat(40),
  schemaVersion: 1,
  artifacts: { 'package.tgz': 'b'.repeat(64) },
  ecosystems: {
    npm: { attempts: 0, status: 'pending' },
    pypi: { attempts: 0, status: 'pending' },
    crates: { attempts: 0, status: 'pending' },
    go: { attempts: 0, status: 'pending' },
  },
};
describe('user receives one recoverable release across all four ecosystems', () => {
  it('user never consumes successful packages again or retries a failed ecosystem more than three times', () => {
    // Given one immutable version, commit and package hash manifest.
    let state = structuredClone(initial);
    // When one ecosystem succeeds and another fails through its finite budget.
    state = finishAttempt(beginAttempt(state, 'npm'), 'npm', true);
    for (let i = 0; i < 3; i++)
      state = finishAttempt(
        beginAttempt(state, 'pypi'),
        'pypi',
        false,
        'Temporary registry failure',
      );
    // Then successful uploads are immutable and exhausted retries are blocked.
    expect(state.ecosystems.npm).toMatchObject({
      status: 'verified',
      attempts: 1,
    });
    expect(() => beginAttempt(state, 'npm')).toThrow();
    expect(state.ecosystems.pypi).toMatchObject({
      status: 'blocked',
      attempts: 3,
    });
    expect(() => beginAttempt(state, 'pypi')).toThrow();
    expect(releaseComplete(state)).toBe(false);
    expect(state.artifacts).toEqual(initial.artifacts);
  });
  it('user sees a complete release only after every public installation is verified', () => {
    // Given all four ecosystems awaiting actual installation validation.
    let state = structuredClone(initial);
    // When all public packages finish installation verification.
    for (const ecosystem of ['npm', 'pypi', 'crates', 'go'] as const)
      state = finishAttempt(beginAttempt(state, ecosystem), ecosystem, true);
    // Then the unified release can be marked complete with its original commit.
    expect(releaseComplete(state)).toBe(true);
    expect(state.commit).toBe(initial.commit);
  });
  it('user gets the highest semantic change and matching prerelease identifiers', () => {
    // Given several merged behavior records and a stable or prerelease channel.
    // When the release version is allocated automatically.
    const next = nextVersion('1.2.3', [
      { type: 'patch', summary: 'Handle offline errors' },
      { type: 'minor', summary: 'Read new specifications' },
    ]);
    // Then data-only updates allocate no package version and all channels agree.
    expect(next).toBe('1.3.0');
    expect(nextVersion('1.2.3', [])).toBe('1.2.3');
    expect(
      nextVersion('1.2.3', [
        { type: 'major', summary: 'Changed field meaning' },
      ]),
    ).toBe('2.0.0');
    expect(pythonVersion('1.3.0-beta.2')).toBe('1.3.0b2');
    expect(pythonVersion('1.3.0-rc.1')).toBe('1.3.0rc1');
    expect(pythonVersion('1.3.0')).toBe('1.3.0');
  });
});
