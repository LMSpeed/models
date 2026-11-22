import { expect, it } from 'vitest';
import {
  acceptsValidation,
  type NativeValidationRun,
  nativeBotValidation,
  type ValidationRun,
} from './validated-run';

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

it('user starts native PR checks only for the exact repository bot and validated head', () => {
  // Given approval-gated native checks alongside unrelated workflows and contributors.
  const candidate: NativeValidationRun = {
    id: 42,
    event: 'pull_request',
    actor: { login: 'github-actions[bot]' },
    status: 'completed',
    conclusion: 'action_required',
    path: '.github/workflows/validate.yml',
    head_sha: 'a'.repeat(40),
    head_branch: 'automation/sdk-version',
    head_repository: { full_name: 'LMSpeed/models' },
  };
  const unrelated = [
    { ...candidate, id: 50, actor: { login: 'untrusted-user' } },
    { ...candidate, id: 51, event: 'workflow_dispatch' },
    { ...candidate, id: 52, head_sha: 'b'.repeat(40) },
    { ...candidate, id: 53, head_branch: 'other-branch' },
    { ...candidate, id: 54, path: '.github/workflows/release-sdks.yml' },
    { ...candidate, id: 55, head_repository: { full_name: 'fork/models' } },
  ];
  // When the trusted continuation chooses the PR workflow eligible to start.
  const selected = nativeBotValidation(
    [...unrelated, candidate],
    candidate,
    'LMSpeed/models',
  );
  // Then external or unrelated work never inherits the approval, and missing eligible checks remain blocked.
  expect(selected?.id).toBe(42);
  expect(nativeBotValidation(unrelated, candidate, 'LMSpeed/models')).toBe(
    null,
  );
});
