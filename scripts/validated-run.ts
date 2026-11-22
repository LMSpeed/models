export interface ValidationRun {
  status: string;
  conclusion: string | null;
  path: string;
  head_sha: string;
  head_branch: string;
  head_repository: { full_name: string };
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
