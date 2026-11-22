import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { root } from '@lmspeed/models-publish';
export const GET = async () =>
  Response.json(
    JSON.parse(await readFile(join(root, 'coverage/models-dev.json'), 'utf8')),
  );
