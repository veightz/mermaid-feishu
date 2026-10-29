#!/usr/bin/env python3
"""Compare one fetched Feishu HTML Box record to a generated local HTML file."""
import argparse
import hashlib
import json
from pathlib import Path


def records(value):
    if isinstance(value, dict):
        if 'add_ons' in value:
            yield value['add_ons']
        for child in value.values():
            yield from records(child)
    elif isinstance(value, list):
        for child in value:
            yield from records(child)


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--record-json', type=Path, required=True)
    p.add_argument('--html', type=Path, required=True)
    args = p.parse_args()
    result = json.loads(args.record_json.read_text(encoding='utf-8'))
    candidates = list(records(result))
    if len(candidates) != 1:
        p.error(f'Expected exactly one add_ons record, got {len(candidates)}. Fetch one block.')
    addon = candidates[0]
    if addon.get('component_type_id') != 'blk_6900429af84180025ce76527':
        p.error('This is not the expected native Miaobi HTML Box.')
    record = addon['record']
    actual = json.loads(record) if isinstance(record, str) else record
    expected = args.html.read_text(encoding='utf-8')
    if actual.get('html') != expected:
        p.error('Remote record.html does not match the generated file. Do not delete the old block.')
    print(json.dumps({'record_html_matches': True, 'sha256': hashlib.sha256(expected.encode('utf-8')).hexdigest()}))


if __name__ == '__main__':
    main()
