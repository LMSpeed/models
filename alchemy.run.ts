import * as Alchemy from 'alchemy';
import * as Cloudflare from 'alchemy/Cloudflare';
import * as Effect from 'effect/Effect';

export default Alchemy.Stack(
  'lmspeed-models',
  { providers: Cloudflare.providers(), state: Alchemy.localState() },
  Effect.gen(function* () {
    const stage = yield* Alchemy.Stage;
    if (stage !== 'production' && stage !== 'preview')
      return yield* Effect.die(
        new Error('Use the production or preview deployment stage'),
      );
    const production = stage === 'production';
    // Ephemeral build hosts re-read this single named resource from Cloudflare.
    // No bindings or shared infrastructure are managed by this stack.
    const site = yield* Cloudflare.Worker('site', {
      name: production ? 'lmspeed-models' : 'lmspeed-models-preview',
      domain: production ? 'models.lmspeed.net' : 'models-preview.lmspeed.net',
      compatibility: { date: '2026-11-22' },
      assets: {
        directory: './apps/site/dist',
        notFoundHandling: '404-page',
        htmlHandling: 'auto-trailing-slash',
      },
    }).pipe(Alchemy.AdoptPolicy.adopt(true));
    return { url: site.url, workerName: site.workerName };
  }),
);
