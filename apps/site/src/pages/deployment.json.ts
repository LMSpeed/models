import { snapshot } from '@lmspeed/models-publish';
export const GET = () =>
  Response.json({
    schemaVersion: 1,
    commit:
      process.env.GITHUB_SHA ??
      process.env.MODELS_BUILD_COMMIT ??
      'development',
    revision: snapshot.revision,
    sha256: snapshot.sha256,
  });
