import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { validateCoverage } from './coverage-contract';
import { readSnapshot } from './sync-lib';

describe('user never publishes data with an unrelated coverage report', () => {
  it('user keeps mismatched and exaggerated coverage out of synchronization', async () => {
    // Given the actual imported baseline and its full inventory report.
    const snapshot = await readSnapshot(process.cwd());
    const report = JSON.parse(
      await readFile('coverage/models-dev.json', 'utf8'),
    );
    // When the source serves another revision or claims an unproven superset.
    const mismatch = { ...report, revision: snapshot.revision + 1 };
    const exaggerated = {
      ...report,
      supersetAchieved: true,
      extraModels: [],
      extraFields: [],
    };
    // Then validation rejects both before any tracked dataset is changed.
    expect(() => validateCoverage(snapshot, mismatch)).toThrow(/revision/);
    expect(() => validateCoverage(snapshot, exaggerated)).toThrow(/superset/);
    expect(validateCoverage(snapshot, report).revision).toBe(snapshot.revision);
  });
});
