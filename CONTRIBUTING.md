# Contributing to m0saic Community Templates

Thank you for contributing to the m0saic community template ecosystem.

## License of Contributions

By submitting a pull request, issue, or other contribution to this repository,
you agree that your contribution is licensed under the MIT License
used by this repository.

You represent that:

- You are the author of the contribution, or
- You have the right to submit it under the MIT License.

All accepted contributions will be distributed under the MIT License.

If you do not wish to license your work under MIT,
please publish your template in your own repository instead.

## Releases are signed

Every published snapshot of this repo carries a signed `release.json`: the
maintainers hash the built `dist/`, `template-manifest.json` and
`package.json` and sign that hash with the m0saic release key. The m0saic
CLI (`--community-repo <checkout>`) and Mosaic Desktop grant this repo's
reserved `@m0saic-dev/` namespace **only to a checkout whose signature
verifies** — an unsigned clone, a fork, or a checkout with modified build
output loads as an ordinary template repo and its `@m0saic-dev/` ids are
refused. Contributors never sign anything: send a PR, the maintainers build,
sign and tag the release. To render your own work locally before it is
merged, load your fork with `--template-repo` under your own namespace.

## Frozen once shipped

A template that has appeared in a signed release is **frozen**: its files
never change again, comments included. Someone holds its output; a shared
link, a committed `.mosaic`, a rendered deliverable must not change meaning
under them. This is enforced, not remembered: `frozen.manifest.json` hashes
every shipped template file (and the helpers it imports), `npm run build` and
this repo's CI run `node tools/check-freeze.mjs` and fail on any change or
deletion, and the maintainers' pre-commit hook refuses the commit.

To fix or improve a shipped template:

1. Copy its folder to the next version — `…/<slug>/v1/` → `…/<slug>/v2/` —
   and make the change there (a shared helper it needs changed: copy the
   helper into the new folder too; `_shared/` is frozen on the same terms).
2. Deprecate the old version in its catalog sidecar — `<name>.catalog.json`
   beside the old version's code (create it if there is none). The freeze
   hashes code, never the sidecar, so this is the one file in a shipped
   folder you may add or edit:

   ```json
   { "schemaVersion": 1, "templateId": "@<handle>/<pack>/<slug>/v1",
     "deprecated": { "reason": "…", "replacement": "@<handle>/<pack>/<slug>/v2", "since": "YYYY-MM-DD" } }
   ```

   It stays registered and renderable; hosts hide it by default and point at
   the replacement. A deprecation that has shipped is never removed.
3. Register the new id in `src/template-registry.ts`. The registry, the
   barrels, `publisher.ts` and `src/repo.ts` are not frozen — they are what a
   new template has to touch.

The manifest is minted by the maintainers at each release
(`node tools/check-freeze.mjs --update --tag <tag>`), so a template is frozen
from the first tag that ships it. Between releases, new folders are simply
"not yet frozen".

## Publishing checklist

- Templates live under `src/publishers/<your-handle>/templates/<pack>/<slug>/vN/`
  with ids shaped `@<your-handle>/<pack>/<slug>/vN`. Handles matching
  `/m0saic/i` are reserved.
- Export plain template objects (no `registerTemplate()` side effects), list
  them in your publisher's `index.ts`, and add a `src/template-registry.ts`
  entry per template (`author` = your handle). `npm run build` regenerates
  `template-manifest.json` and enforces id/author/uniqueness rules.
- Describe each template in its catalog sidecar, `<name>.catalog.json` beside
  its module — label, description, tags, visibility, and each prop's label /
  hint / placeholder — never in the template's code (m0saic 0.3.1+; the code
  freezes when it ships, the sidecar stays editable). The build gathers the
  sidecars into `template-catalog.json`.
- Every template needs at least one unit test next to its source asserting
  deterministic internals (layout geometry, resolved node tree, or
  validation errors).
- Runs in Mosaic Web? Add it to the browser entry, `src/web.ts` (the build
  writes `web-template-ids.json` from it). The rule, held by `src/web.test.ts`:
  nothing in its import closure may touch a node builtin or a deep
  `@m0saic/template-utils/dist/…` helper, and no media / folder / file prop
  may be `required` — in the browser every media prop is empty, so what people
  play with is the template's empty-media look. Give every media slot a
  stand-in (inline SVG data-URI, URL-encoded, no `;utf8`) and say so in the
  prop's hint. A template that needs a real file to mean anything stays out of
  the entry and ships as a Desktop-only card in the web gallery.
- Renders must be deterministic: same props → same output. No wall-clock
  time, no unseeded randomness (expose seeds as props), no hidden state.
- Stay on the lattice: every split count above 12 in the rendered layout must
  be 5-smooth (2ᵃ·3ᵇ·5ᶜ — cap a weighted split with
  `weightedSplit(…, { precision: 120 })`, never round each weight to a basis
  on its own). `m0saic doctor <repo>` reports the `latticeSmooth` finding and
  it is **blocking**; baked rasters declare `lattice: { mode: "bitmap" }`,
  content counts above 12 declare `lattice.allow` with a reason, print sizes
  declare `lattice: { canvas: "physical" }`.

## Dependencies

Template code may import only: `@m0saic/types`, `@m0saic/template-utils`,
`@m0saic/dsl-stdlib`, `@m0saic/platform`, `@m0saic/dsl`, and `node:path` —
exactly what the hosts (CLI + Desktop) already ship. No other packages or
node builtins (`fs`, `net`, `child_process` are explicitly out), no network
access, no `eval` / dynamic `require`. Most templates need none of the
exceptions — the DSL + stdlib express nearly everything. A native or
third-party runtime dependency (an image library, an emoji set, a layout
engine) is a founder decision, not something a PR can add: open an issue
before writing code that needs it.

CI enforces this with `node tools/check-deps.mjs` against the committed
`dep-allowlist.json` (curator-approved per-file exceptions live there too,
with reasons). Run it locally before opening a PR.