import type { Snapshot } from '../packages/core/src/index';
export function validateCoverage(
  snapshot: Snapshot,
  input: unknown,
): Record<string, unknown> {
  if (!input || typeof input !== 'object')
    throw new Error('Invalid coverage report');
  const report = input as Record<string, unknown>;
  const baseline = snapshot.data.upstreams.find(
    (source) => source.id === 'models.dev',
  );
  if (
    !baseline ||
    report.revision !== snapshot.revision ||
    report.baselineCommit !== baseline.commit ||
    report.upstreamModelCount !== baseline.modelCount
  )
    throw new Error(
      'Coverage report identifies a different revision or baseline',
    );
  for (const key of [
    'missingModels',
    'unmappedFields',
    'extraModels',
    'extraFields',
  ])
    if (!Array.isArray(report[key]))
      throw new Error(`Incomplete coverage report: ${key}`);
  const missing = report.missingModels as unknown[];
  const total = Number(report.totalFactCount);
  const covered = Number(report.coveredFactCount);
  if (
    Number(report.mappedModelCount) + missing.length !== baseline.modelCount ||
    !Number.isInteger(total) ||
    !Number.isInteger(covered) ||
    total < covered ||
    covered < 0 ||
    report.modelCoverage !==
      (baseline.modelCount - missing.length) / baseline.modelCount ||
    report.fieldCoverage !== (total === 0 ? 0 : covered / total)
  )
    throw new Error('Invalid coverage denominator');
  if (
    report.supersetAchieved &&
    (missing.length ||
      (report.unmappedFields as unknown[]).length ||
      covered !== total ||
      total === 0 ||
      report.behindLatest ||
      (!(report.extraModels as unknown[]).length &&
        !(report.extraFields as unknown[]).length))
  )
    throw new Error('Unproven superset claim');
  return report;
}
