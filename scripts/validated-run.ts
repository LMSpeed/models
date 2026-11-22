export interface ValidationRun {
  status: string;
  conclusion: string | null;
  path: string;
  head_sha: string;
  head_branch: string;
  head_repository: { full_name: string };
}

export interface NativeValidationRun extends ValidationRun {
  id: number;
  event: string;
  actor: { login: string };
}

export function nativeBotValidation(
  runs: NativeValidationRun[],
  expected: ValidationRun,
  repository: string,
): NativeValidationRun | null {
  return (
    runs
      .filter(
        (run) =>
          run.event === 'pull_request' &&
          run.actor.login === 'github-actions[bot]' &&
          run.path === '.github/workflows/validate.yml' &&
          run.head_repository.full_name === repository &&
          run.head_sha === expected.head_sha &&
          run.head_branch === expected.head_branch,
      )
      .sort((a, b) => b.id - a.id)[0] ?? null
  );
}

export function acceptsValidation(
  run: ValidationRun,
  repository: string,
): boolean {
  return (
    run.status === 'completed' &&
    run.conclusion === 'success' &&
    run.path === '.github/workflows/validate.yml' &&
    run.head_repository.full_name === repository
  );
}
