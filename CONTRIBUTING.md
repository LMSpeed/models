# Contributing

For data corrections, open an issue with the exact model identity, field, and a primary official source. Maintainers update LMSpeed first; the generated snapshot is synchronized here. Do not edit `data/` by hand.

Logo mappings, licensed supplemental SVGs, SDKs, tools and documentation accept pull requests. LobeHub SVG and source files must never be committed. Add supplemental attribution to `logos/sources.json`.

Use pnpm on Node.js 22+, Python 3.10+, Rust 1.89+ and Go 1.23+. Install with `pnpm install --frozen-lockfile`, then run `pnpm check`, `pnpm build`, and the shared cross-language contract suite. Code generation must leave no uncommitted changes. Every public behavior change includes a `.changes/<name>.json` entry with `type` (`patch`, `minor`, `major`) and a user-facing `summary`. Data, documentation and tests alone do not cause package releases.

Write Given / When / Then acceptance scenarios before behavior changes. Use real infrastructure; no mocks. Each language consumes the same generated contract fixtures. Test descriptions start with `user`. Keep known `false`, `0`, `null`, date precision and absent type blocks distinct. Do not guess aliases from similar names or strip version suffixes.
