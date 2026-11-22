import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import {
  canonicalJson,
  type Snapshot,
  validateSnapshot,
} from '../packages/core/src/index';
import { validateCoverage } from './coverage-contract';
import { readSnapshot, writeSnapshot } from './sync-lib';

const source =
  process.env.MODEL_SPECS_SOURCE ?? 'https://lmspeed.net/api/v1/model-specs';
let prior: Snapshot | undefined;
try {
  prior = await readSnapshot(process.cwd());
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
}
await mkdir('.sync', { recursive: true });
let success = false;
for (let attempt = 1; attempt <= 3; attempt++) {
  try {
    const response = await fetch(source, {
      headers: prior ? { 'if-none-match': `"${prior.sha256}"` } : {},
      signal: AbortSignal.timeout(30000),
    });
    if (response.status !== 304 && !response.ok)
      throw new Error(`Source HTTP ${response.status}`);
    const snapshot =
      response.status === 304
        ? prior
        : await validateSnapshot(await response.json());
    if (!snapshot) throw new Error('304 without a loaded snapshot');
    if (
      response.status === 304 &&
      process.env.CHECK_UPSTREAM_COVERAGE !== '1'
    ) {
      await writeFile(
        '.sync/last-success.json',
        JSON.stringify({
          checkedAt: new Date().toISOString(),
          revision: snapshot.revision,
          sourceEtag: response.headers.get('etag'),
          reviewRequired: false,
        }),
      );
      if (process.env.GITHUB_OUTPUT)
        await appendFile(
          process.env.GITHUB_OUTPUT,
          `review_required=false\nrevision=${snapshot.revision}\n`,
        );
      success = true;
      break;
    }
    const coverageResponse = await fetch(
      new URL('/api/v1/model-specs/coverage', source),
      { signal: AbortSignal.timeout(30000) },
    );
    if (!coverageResponse.ok)
      throw new Error(`Coverage HTTP ${coverageResponse.status}`);
    const coverage = validateCoverage(snapshot, await coverageResponse.json());
    await writeFile('.sync/candidate.json', JSON.stringify(snapshot));
    await writeFile('.sync/coverage.json', JSON.stringify(coverage));
    let review = false;
    try {
      await writeSnapshot(
        process.cwd(),
        snapshot,
        process.env.ALLOW_REVIEW_CHANGES === '1',
      );
    } catch (error) {
      if (!String(error).includes('Review required')) throw error;
      review = true;
      await writeSnapshot(process.cwd(), snapshot, true);
    }
    await mkdir('coverage', { recursive: true });
    const coverageContent = `${JSON.stringify(coverage, null, 2)}\n`;
    let priorCoverage: Record<string, unknown> | undefined;
    try {
      priorCoverage = JSON.parse(
        await readFile('coverage/models-dev.json', 'utf8'),
      ) as Record<string, unknown>;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    const semanticCoverage = (report: Record<string, unknown>) => {
      const {
        lastCheckedAt: _checked,
        lastSuccessfulCheckAt: _successful,
        ...content
      } = report;
      return canonicalJson(content);
    };
    if (
      !priorCoverage ||
      semanticCoverage(priorCoverage) !== semanticCoverage(coverage)
    )
      await writeFile('coverage/models-dev.json', coverageContent);
    if (process.env.GITHUB_OUTPUT)
      await appendFile(
        process.env.GITHUB_OUTPUT,
        `review_required=${review}\nrevision=${snapshot.revision}\n`,
      );
    await writeFile(
      '.sync/last-success.json',
      JSON.stringify({
        checkedAt: new Date().toISOString(),
        revision: snapshot.revision,
        sourceEtag: response.headers.get('etag'),
        reviewRequired: review,
      }),
    );
    success = true;
    break;
  } catch (error) {
    if (attempt === 3) throw error;
    process.stderr.write(
      `Synchronization attempt ${attempt} failed: ${String(error)}\n`,
    );
  }
}
if (!success) throw new Error('Synchronization did not complete');
