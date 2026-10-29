#!/usr/bin/env python3
"""Generate an editable Mermaid HTML Box; does not publish or upload anything."""
import argparse
import hashlib
import html
import json
from pathlib import Path
import re
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent


def digest(value):
    return hashlib.sha256(value.encode('utf-8')).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--engine-manifest', type=Path, required=True, help='Deployment JSON with HTTPS engine url and sha256; kept outside this repository')
    parser.add_argument('--source', type=Path, required=True, help='UTF-8 .mmd file or a single fenced Mermaid block')
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--document-key', required=True, help='Stable document token or unique local document identifier')
    parser.add_argument('--diagram-key', required=True, help='Stable identifier within this document; not an array index')
    parser.add_argument('--viewer-url', help='HTTPS URL of the standalone viewer')
    parser.add_argument('--standalone', action='store_true', help='Generate a standalone viewer without shared source persistence')
    parser.add_argument('--force', action='store_true', help='Overwrite local generated outputs')
    args = parser.parse_args()
    if args.viewer_url:
        url = urlparse(args.viewer_url)
        if url.scheme != 'https' or not url.netloc or url.username or url.password:
            parser.error('Viewer URL must be an HTTPS URL without credentials.')
    source = args.source.read_text(encoding='utf-8').strip()
    fenced = re.fullmatch(r'```mermaid\s*\n(.*?)\n```', source, flags=re.S | re.I)
    if fenced:
        source = fenced[1].strip()
    meaningful = [line for line in source.splitlines() if line.strip() and not line.lstrip().startswith('%%')]
    if not meaningful or not re.fullmatch(r'\s*(?:flowchart|graph)\s+(?:TB|TD|LR|RL|BT)\s*;?\s*', meaningful[0]):
        parser.error('Use a flowchart/graph with a standalone direction line. Other diagram types need a different renderer.')
    if re.search(r'</script\b|<!--', source, flags=re.I):
        parser.error('Source contains HTML script delimiters; replace those literal labels before embedding.')
    if len(source.encode('utf-8')) > 50_000:
        parser.error('Source exceeds 50 KB; split the diagram.')
    if not args.document_key.strip() or not args.diagram_key.strip():
        parser.error('Document and diagram keys must be non-empty.')
    source += '\n'
    engine = json.loads(args.engine_manifest.read_text(encoding='utf-8'))
    engine_url = urlparse(engine.get('url', ''))
    if engine_url.scheme != 'https' or not engine_url.netloc or engine_url.username or engine_url.password:
        parser.error('Engine URL must be HTTPS without credentials.')
    if not re.fullmatch(r'[0-9a-f]{64}', engine.get('sha256', '')):
        parser.error('Engine manifest must include its SHA-256 hex digest.')
    template = (ROOT / 'assets/widget.html').read_text(encoding='utf-8')
    controls = (ROOT / 'assets/view-controls.js').read_text(encoding='utf-8')
    template_hash = digest(template + controls)
    scope = digest(json.dumps([args.document_key, args.diagram_key], ensure_ascii=False))[:24]
    revision = digest(source + engine['sha256'] + template_hash + str(args.standalone) + str(args.viewer_url))[:24]
    key = f'mermaid-html-{scope}-{revision}'
    config = json.dumps({'palette': None, 'storageKey': key, 'viewerUrl': args.viewer_url, 'standalone': args.standalone}, ensure_ascii=False).replace('<', '\\u003c')
    replacements = {'@@VIEW_CONTROLS@@': controls, '@@MERMAID_SOURCE@@': source, '@@CONFIG_JSON@@': config, '@@ENGINE_URL@@': html.escape(engine['url'], quote=True)}
    for marker in replacements:
        if template.count(marker) != 1:
            raise ValueError(f'Template must contain exactly one {marker}')
    output = re.sub(r'@@(?:VIEW_CONTROLS|MERMAID_SOURCE|CONFIG_JSON|ENGINE_URL)@@', lambda m: replacements[m[0]], template)
    if args.standalone:
        output = output.replace('html-box-height-mode" content="auto', 'html-box-height-mode" content="viewport')
    manifest_path = args.output.with_suffix(args.output.suffix + '.json')
    if args.source.resolve() in (args.output.resolve(), manifest_path.resolve()):
        parser.error('Output must not overwrite the source.')
    if not args.force and (args.output.exists() or manifest_path.exists()):
        parser.error('Output exists. Review it before using --force; this does not authorize replacing a live component.')
    manifest = {
        'document_key': args.document_key, 'diagram_key': args.diagram_key,
        'standalone': args.standalone, 'viewer_url': args.viewer_url,
        'source_sha256': digest(source), 'html_sha256': digest(output),
        'engine_url': engine['url'], 'engine_sha256': engine['sha256'],
        'template_sha256': template_hash, 'storage_key': key,
        'redis_key': 'mf-shared-source-v1-' + key,
        'html_bytes': len(output.encode('utf-8')),
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(output, encoding='utf-8')
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'html': str(args.output.resolve()), 'manifest': str(manifest_path.resolve()), 'bytes': manifest['html_bytes']}, ensure_ascii=False))


if __name__ == '__main__':
    main()
