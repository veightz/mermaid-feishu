# Shared-engine HTML blocks

Generate a small editable HTML wrapper referencing one separately hosted flowchart/ELK engine. The wrapper includes source editing/copying, direction switching, explicit zoom buttons, fullscreen, and an optional hosted standalone viewer. No npm dependencies or engine rebuild are needed to generate a wrapper.

This is a deployment path for the existing `mf-*` offline-engine DOM contract. It does not replace the site's `/view` page or the self-contained `buildOfflineWidget` export. Keep deployment URLs, document identifiers, credentials, and user diagrams outside this directory.

## Generate

Create a deployment manifest outside the repository:

```json
{
  "url": "https://your-host.example/mermaid-engine-VERSION.js",
  "sha256": "SHA256_OF_THE_DEPLOYED_ENGINE"
}
```

The engine must boot against `#mermaid-source`, `#mf-cfg`, and the template's `mf-*` DOM. This is not a loader for an arbitrary `mermaid.js` URL. The SHA-256 records the deployed artifact; the generator does not download or verify that artifact on every run.

```bash
python3 tools/html-block/create_widget.py \
  --source diagram.mmd --output out/diagram.html \
  --engine-manifest /path/to/deployment-engine.json \
  --document-key my-document --diagram-key request-flow \
  --viewer-url https://your-host.example/viewer
```

A JSON manifest beside the HTML records its source/template/engine hashes and independent storage key. Source or runtime changes produce a new key; reconcile any saved in-document edits before replacing existing blocks. `--force` only permits overwriting local outputs.

For a standalone viewer:

```bash
python3 tools/html-block/create_widget.py \
  --source tools/html-block/assets/example.mmd --output out/viewer.html \
  --engine-manifest /path/to/deployment-engine.json \
  --document-key viewer --diagram-key example --standalone
```

Host the generated HTML using your chosen provider. It accepts a UTF-8 base64url source snapshot in `#src=`, including the host URL exposed by `window.magic.parentHref`. Standalone changes do not write back to the original document or use page-global source persistence. The wrapper's editable-source flow requires a compatible shared engine; a local browser cannot prove host persistence works.

## Controls and compatibility

- Fullscreen runs only from a user click. Host denial produces a visible explanation, with a separate independent-view link when configured.
- Independent viewing snapshots the current source. For sources above 20 KB, open the viewer and use copy/paste instead of a very long URL. The fragment is not access control and can remain in browser history.
- Explicit zoom buttons adapt to older wheel-zoom engines. Native engines mark their buttons with `data-mf-zoom-owner="viewport"`; the wrapper then skips its compatibility handlers and leaves disabled states to the engine. Before deploying a native engine, regenerate old wrappers that lack this ownership check to avoid double zoom.
- The direction-label adapter translates old engine labels into readable Chinese labels; it leaves already-readable labels alone.
- Regular wheel gestures scroll; Ctrl/Meta + wheel uses the engine's bounded centered zoom. Fullscreen and independent viewing keep the same engine.
- Only flowchart/graph source is supported by this generator. Other diagram types belong to the site's corresponding rendering paths.

## Deployment verification

Generate a preview, visually inspect branches/loops at document width, and inspect render warnings before publishing. Check host-specific fullscreen and persistence in the actual host; don't infer them from local success.

For native Miaobi HTML Box deployments, fetch one block with the document API and compare its record:

```bash
python3 tools/html-block/verify_record.py \
  --record-json out/fetched-block.json --html out/diagram.html
```

This confirms record contents, not browser execution or saved source state. Publishing, moving and deleting document blocks remain the deployment caller's responsibility.
