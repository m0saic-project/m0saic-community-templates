# Mosaic Community Templates

A curated collection of community templates for m0saic, organized by
**publisher**. Acceptance requires meeting quality and compatibility
standards — a PR to this repository is the submission process.

You are always free to publish and distribute your own template repositories
independently; the m0saic CLI and Desktop load external template repos the
user opts into.

The m0saic rendering engine and desktop application are proprietary and
require a valid license for execution in production.

## Layout

```
template-manifest.json          generated browse surface (npm run build)
assets/templates/<encoded-id>/  preview.png | preview.mp4 | poster.png
src/
  template-registry.ts          authoring registry (browse metadata, one entry per template)
  repo.ts                       repo descriptor (repoId @m0saic-community) + pack descriptors
  front-door.ts                 the repo's OWN handle (@m0saic-community) — the front door, nothing else
  hello-world/v1/               @m0saic-community/hello-world/v1 — packless, top-level, mark re-baked per release
  publishers/
    index.ts                    PUBLISHER_ENTRIES — one lazy line per publisher
    <handle>/                   one folder per publisher
      publisher.ts              publisher descriptor
      templates/<pack>/<slug>/vN/
  _PUBLISHER_STARTER/           copy-me scaffold for a new publisher
```

## Template ids

Every template id is **publisher-scoped**: `@<handle>/<pack>/<slug>/vN`
(e.g. `@m0saic-dev/hero/search-typing/v1`). One exception by design: the
repo's own front door, `@m0saic-community/hello-world/v1`, is **packless**
(`@<handle>/<slug>/vN`) under the repo's own handle — it is the greeting the
repo makes, not any contributor's template. The `@m0saic/` namespace is
reserved for the official library, and handles matching `/m0saic/i` are
reserved (`m0saic-dev` is the founder's publisher; `m0saic-community` is the
repo itself and carries the front door only).

Trust does not come from the id. Hosts stamp provenance from **where they
loaded the bytes**: a checkout whose `release.json` verifies against the
m0saic public keys is the community repo; anything else is a third-party repo,
whatever its ids claim. See "Releases" below.

> Renamed 2026-08: ids formerly shaped
> `@m0saic/community-templates/<publisher>--<pack>--<slug>/vN` are now
> `@<publisher>/<pack>/<slug>/vN`. Three templates also moved here from the
> official library (old id → new id, no aliasing):
> `@m0saic/language/dual-sub/v1` → `@m0saic-dev/language/dual-sub/v1`,
> `@m0saic/print/dvd-wrap/v1` → `@m0saic-dev/print/dvd-wrap/v1`,
> `@m0saic/science/multi-panel-figure/v1` → `@m0saic-dev/science/multi-panel-figure/v1`.
> A fourth, `@m0saic/demos/header-hero-footer/v1`, moved with them and was
> CUT in the 2026-09 curation pass before this repo was first published — it
> was a geometry smoke test, not a template.

Template modules export plain template objects — no self-registration; the
host decides what to register. See `src/_PUBLISHER_STARTER/README.md` for the
full walkthrough, and `CONTRIBUTING.md` for the license + dependency rules.


## Frozen once shipped

`frozen.manifest.json` hashes every template file a signed release shipped.
`node tools/check-freeze.mjs` (run by `npm run build` and by CI) fails on any
change to one of them — a fix is a new `vN+1` folder, the old version is
deprecated. See CONTRIBUTING.md § "Frozen once shipped".

## Releases — what this repository is

This repo is a **signed snapshot**, not a self-building project (yet). It is
minted from the m0saic monorepo, which holds the substrate this code compiles
against — `@m0saic/types`, `@m0saic/platform`, `@m0saic/template-utils` — and
those packages are not on npm today, so `npm install` here will not resolve
them. What ships instead:

- `dist/` — prebuilt, loadable by the m0saic CLI and Mosaic Desktop with no
  build step (`m0saic list-templates --community-repo <checkout>`).
- `release.json` — the release tag, a hash over the whole tree, and an
  **ed25519 signature** over that hash. A host grants the `@m0saic-dev/` and
  `@m0saic-community/` namespaces only to a checkout that verifies; an
  unsigned or edited checkout loads as an ordinary third-party repo and those
  ids are refused.
- `keys/<kid>.public.pem` — the public halves of the m0saic release keys, the
  same ones the CLI and Desktop embed.
- `tools/verify-release.mjs` — a standalone verifier (Node built-ins only)
  that re-derives the tree hash and checks the signature against `keys/`.
  Run it on any checkout: `node tools/verify-release.mjs`.
- CI (`.github/workflows/ci.yml`) verifies; it does not build. `policy` lints
  every push and PR; `release` runs `verify-release` on every push to `main`
  (and requires the git tag on a tag push). `main` is only ever a signed mint,
  so a merged change that touched `dist/` turns it red by design — a PR's
  tree is not the signed one, which is why `release` does not run on PRs.

Contributions are reviewed as pull requests here and land through the next
signed mint. Until the substrate publishes, authoring a template end-to-end
means the template-repo starter (link on m0saic.io/developers), which carries
the same conventions and does build standalone.
