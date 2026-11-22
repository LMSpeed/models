# LMSpeed Models

[![Data revision](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fmodels.lmspeed.net%2Fdeployment.json&query=%24.revision&label=data%20revision)](https://models.lmspeed.net/deployment.json) [![SDK version](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2FLMSpeed%2Fmodels%2Fmain%2Frelease.json&query=%24.version&label=SDK)](release.json)

An open, source-attributed database of AI model specifications, maintained in LMSpeed and distributed as static files. Language, image, audio, video, embedding, reranking and other model types share one identity and data contract. Providers, prices, benchmarks and user data are outside this dataset.

**Data status:** this repository now contains the authoritative export from [LMSpeed](https://lmspeed.net/api/v1/model-specs), including independently reviewed language and image specifications. The complete models.dev model-body baseline is mapped; conflicts remain visible and the coverage report does not yet declare the superset target achieved. Preview: https://models-preview.lmspeed.net.

**Package status:** registry publication is in progress. Python and Rust publication are explicitly deferred; their clients and contract checks remain included in CI. The immutable release manifest records each registry separately.

The production endpoint is **https://models.lmspeed.net**, serving data revision **2** with **925 canonical models** and **120 developers**. Deployment and package publication are tracked by Actions and the release manifests. SDK versions are independent of the data `revision`.

```sh
curl https://models.lmspeed.net/v1/api.json
curl https://models.lmspeed.net/v1/models/deepseek-v4-pro.json
curl https://models.lmspeed.net/v1/models/deepseek-v4-pro.svg
```

Canonical IDs are stable. Registered external IDs and old names resolve through `data/aliases.json`, partitioned by source. A source-specific route uses its explicitly registered `routeKey`, for example `/v1/models/models.dev/openai/gpt-5.json`. JSON and SVG use exactly the same path set. Unknown routes return 404. A known model without a dedicated logo uses a marked default logo.

## JavaScript / TypeScript

```sh
pnpm add @lmspeed/models
```

```ts
import { Client, Catalog } from '@lmspeed/models';
const client = new Client();
const catalog = await client.refresh();
const model = catalog.get('openai/gpt-5', 'models.dev');
console.log(catalog.revision, model.specs.text, catalog.iconUrl(model.id));
const offline = await Catalog.fromJson(savedJson);
```

## Python

```sh
pip install lmspeed-models
```

```python
from lmspeed_models import Catalog, Client, AsyncClient
catalog = Client().refresh()
model = catalog.get('openai/gpt-5', 'models.dev')
offline = Catalog.from_json(saved_json)
# AsyncClient exposes the same asynchronous reads and supports cancellation.
```

## Rust

```toml
[dependencies]
lmspeed-models = "0.1"
```

```rust
let mut client = lmspeed_models::Client::default();
let catalog = client.refresh().await?;
let model = catalog.get("openai/gpt-5", Some("models.dev"))?;
let offline = lmspeed_models::Catalog::from_json(&saved_json)?;
```

## Go

```sh
go get github.com/lmspeed/models/sdk/go@v0.1.0
```

```go
import models "github.com/lmspeed/models/sdk/go"
client := models.NewClient("")
catalog, err := client.Refresh(ctx)
model, err := catalog.Get("openai/gpt-5", "models.dev")
offline, err := models.LoadJSON(savedJSON)
```

All clients offer explicit refresh, custom origins and timeouts, local filtering, field sources, upstream comparison facts, logo metadata and coverage. JavaScript and Rust requests can be cancelled by their caller; Python has an asynchronous client; Go accepts `context.Context`. Imports do not connect or start polling. HTTP failures, 404, invalid JSON and incompatible schema versions are distinguishable; failed refreshes retain the last loaded catalogue. Server clients revalidate ETags. Browser clients use ordinary CORS GET and the browser HTTP cache.

## Data and identities

- `/api.json` and `/v1/api.json`: complete snapshot with schema, scope, revision, update time, counts and a deterministic SHA-256 of `data`.
- `/v1/models/{id}.json` and `.svg`: canonical models and explicitly registered alias routes.
- `/v1/aliases.json`, `/v1/developers.json`, `/v1/schema.json`: identity and validation resources.
- `/logos.json`: chosen source, pinned package version, SHA-256 and fallback state.
- `/coverage/models-dev.json`: fixed baseline, mapping, reusable-field coverage, conflicts and visible gaps. A mapped conflict is not a claim of verified agreement.

Unknown applicable values are `null`. Inapplicable type blocks are absent. `false`, `0` and confirmed empty lists remain explicit values. Token and physical units appear in field names. Knowledge dates preserve their original precision. `documentedSizes` contains working official image inference examples; it does not assert an exhaustive supported set or maximum. Source observation time is separate from verification time.

Unspecified sources resolve exact canonical IDs first, then confirmed global aliases, then source matches. Several distinct targets return `ambiguous` with candidates. A specified source uses only its registered case rules. No parser strips dates, sizes, `preview`, `thinking`, quantization or other identity distinctions. Fixed aliases cannot silently change target; moving aliases carry revisions and history.

## Updates and reproducibility

models.dev enrichment enters LMSpeed before export. Scheduled source and distribution checks run every six hours. An optional cross-repository dispatch credential can shorten distribution latency; the scheduled chain works independently. Unknown upstream fields, incomplete snapshots, hash mismatches or suspicious deletions preserve the previous valid version. Coverage is measured against the complete fixed model-body baseline, including every model type; price, host API and benchmark fields are explicitly excluded.

Automatic source synchronization is currently blocked by the source site's Cloudflare Bot Fight Mode. The previously validated snapshot remains available; automated updates are not claimed operational until the source requests pass and a complete update has been verified.

To pin data, choose a Git commit or data tag and reconstruct its local snapshot with `scripts/sync-lib.ts`, then load that JSON in any client. SDK packages do not contain a complete data snapshot. The same commit builds offline after its public locked dependencies are installed. Astro output is static; the deployed Worker contains only Static Assets, with no database, server adapter or custom request handler.

## Continuous delivery

GitHub Actions uses its repository-scoped token. Bot-created data and version PRs explicitly dispatch Validate on their exact branch. After its required checks succeed, a separate job with only Actions write permission explicitly dispatches the default-branch continuation; it does not checkout branch code. The continuation re-reads the completed validation run, checks its workflow, repository and immutable head, respects identity-review candidates, merges ordinary validated updates, and explicitly dispatches deployment and SDK release. Human-triggered validation also retains the workflow-run continuation. This avoids relying on events suppressed by GITHUB_TOKEN. No GitHub App is required. Protected jobs hold deployment and registry permissions; PR validation jobs have read access only.

Dispatched workflow checks do not satisfy GitHub's required PR checks. For its own bot-created PR and exact validated head only, the default-branch continuation starts the approval-gated native PR validation and waits up to eight minutes for its real result. It rechecks the head before merging. Native checks and branch protections stay enabled; failed checks preserve the open PR. Continuations use independent run identities so unrelated dependency checks cannot cancel a pending model release.

Cloudflare Workers Builds connects `LMSpeed/models` on `main`. Its build command is `pnpm build:site`, production command is `pnpm deploy:site`, and branch previews use `pnpm deploy:preview`. Alchemy deploys the prebuilt Astro directory as an assets-only Worker, verifies a preview, then uploads the same bytes to production. No server entrypoint, runtime binding or SSR adapter is present. GitHub Actions verifies the exact published commit and data revision rather than deploying a second copy. Failed production smoke checks restore the previous Cloudflare version.

`alchemy.run.ts` names only the two site Workers. On ephemeral build hosts it reads and adopts those resources from Cloudflare; local Alchemy state is ignored by Git and is not required for recovery. Deployment history is retained by Cloudflare, and the deployed `deployment.json` identifies the source commit and data hash. No account-wide state Worker is modified.

Workers Builds uses a shallow Git checkout. Before checking that production's commit precedes the candidate, the deploy command fetches the main branch history with a bounded timeout. The ancestry check still rejects older or unrelated commits.

## Development

Use pnpm and the pinned lockfile. `pnpm check`, `pnpm build`, and `pnpm exec tsx scripts/test-sdks.ts` validate the contract and all four clients. The latter starts an isolated real HTTP contract service. See [CONTRIBUTING.md](CONTRIBUTING.md) for corrections and change records.

Tooling and SDK code: MIT. LMSpeed-owned metadata: CC BY 4.0 with attribution. Imported models.dev fields retain MIT and original notices. LobeHub resources are extracted from the pinned static package at build time and never vendored. See [data/NOTICE.md](data/NOTICE.md), [data/LICENSE](data/LICENSE) and [logos/NOTICE.md](logos/NOTICE.md). Model weight licenses and trademarks are separate.
