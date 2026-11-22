import { createHash } from 'node:crypto';

export function preparedConfig<T extends { version: string }>(
  config: T,
  changes: unknown[],
): T & { changeSet: string } {
  return {
    ...config,
    changeSet: createHash('sha256')
      .update(JSON.stringify(changes))
      .digest('hex'),
  };
}
