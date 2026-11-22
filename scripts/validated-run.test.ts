import { expect, it } from 'vitest';
import { acceptsValidation, type ValidationRun } from './validated-run';

it('user automates merging only after the exact repository validation has succeeded', () => {
  // Given a successful explicit validation of a bot-created version branch.
  const run: ValidationRun = {
    status: 'completed',
    conclusion: 'success',
    path: '.github/workflows/validate.yml',
    head_sha: 'a'.repeat(40),
    head_branch: 'automation/sdk-version',
    head_repository: { full_name: 'LMSpeed/models' },
  };
  // When the default-branch continuation authenticates its requested validation run.
  const accepted = acceptsValidation(run, 'LMSpeed/models');
  // Then pending, failed, unrelated-workflow and external-repository results cannot authorize a merge.
  expect(accepted).toBe(true);
  expect(
    acceptsValidation({ ...run, status: 'in_progress' }, 'LMSpeed/models'),
  ).toBe(false);
  expect(
    acceptsValidation({ ...run, conclusion: 'failure' }, 'LMSpeed/models'),
  ).toBe(false);
  expect(
    acceptsValidation(
      { ...run, path: '.github/workflows/sync.yml' },
      'LMSpeed/models',
    ),
  ).toBe(false);
  expect(
    acceptsValidation(
      { ...run, head_repository: { full_name: 'someone/models' } },
      'LMSpeed/models',
    ),
  ).toBe(false);
});
