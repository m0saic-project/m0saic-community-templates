# Publisher starter

Copy this folder into `src/publishers/<your-publisher-handle>/` and rename it.
Your **handle** is the first segment of every template id you publish
(`@<your-handle>/<pack>/<slug>/vN`) and must match the folder name.
Handles matching `/m0saic/i` are reserved.

Then:

1. Fill in `publisher.ts` (handle, display name, `entryModule` path).
2. Author templates under `templates/<pack>/<slug>/vN/`. Template modules
   export plain template objects — no `registerTemplate()` calls; the host
   decides what to register.
3. List each template in this folder's `index.ts` `templates` array.
4. Add one line to `src/publishers/index.ts`:

   ```ts
   "<your-handle>": () => require("./<your-handle>") as PublisherModule,
   ```

5. Add a registry entry per template in `src/template-registry.ts`
   (`author` = your handle). `npm run build` regenerates
   `template-manifest.json` and enforces id/author/uniqueness rules.
6. Add at least one unit test per template next to its source
   (deterministic internals — geometry, resolved tree, or validation).

Preview assets (optional but strongly encouraged) follow the convention
`assets/templates/<id with "/" → "__">/preview.png|preview.mp4|poster.png`.
