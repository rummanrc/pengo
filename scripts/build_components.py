"""Extract nested Japanese learning components from the bundled KanjiVG SVGs.

Derived structural data: CC BY-SA 3.0, © Ulrich Apel / KanjiVG.
Story references are extracted from the existing mnemonic CSV, without replacing stories.
Run after updating source SVGs or mnemonics: python3 scripts/build_components.py
No network or third-party Python dependencies required.
"""
import csv
import json
import re
import xml.etree.ElementTree as ET
from pathlib import Path
import build_data as facts

ROOT = Path(__file__).resolve().parent.parent
SVG = '{http://www.w3.org/2000/svg}'
KVG = '{http://kanjivg.tagaini.net}'


def extract_tree(text):
    # Older SVGs declare the namespace only in the internal DTD.
    text = text.replace('<svg ', '<svg xmlns:kvg="http://kanjivg.tagaini.net" ', 1) if 'xmlns:kvg=' not in text else text
    root = ET.fromstring(text)
    paths = next((g for g in root if g.get('id', '').startswith('kvg:StrokePaths_')), None)
    if paths is None:
        return None

    def group(g):
        stroke_ids = {p.get('id') for p in g.iter(SVG + 'path')}
        nodes = []
        for child in g.findall(SVG + 'g'):
            node = group(child)
            nodes.extend([node] if node else [])
        char = g.get(KVG + 'element')
        if not char:
            # Anonymous grouping is transparent, rather than an invented character.
            return {'children': nodes, '_paths': stroke_ids}
        def flatten(nodes):
            return [n for node in nodes for n in ([node] if node.get('c') else flatten(node.get('children', [])))]
        merged = []
        for node in flatten(nodes):
            # Non-consecutive portions of the same component represent one part.
            same = next((n for n in merged if node.get('part') and n.get('part') and
                         n['c'] == node['c'] and n.get('number') == node.get('number')), None)
            if same:
                same['_paths'].update(node['_paths'])
                if node.get('children'):
                    same.setdefault('children', []).extend(node['children'])
            else:
                merged.append(node)
        node = {'c': char, '_paths': stroke_ids}
        for attr in ('original', 'position', 'partial', 'part', 'number'):
            value = g.get(KVG + attr)
            if value:
                node[attr] = value
        if merged:
            node['children'] = merged
            # A group with ungrouped strokes isn't fully explained by its child groups.
            node['complete'] = stroke_ids == set().union(*(n['_paths'] for n in merged))
        return node

    tree = group(paths.find(SVG + 'g'))
    def clean(node):
        node.pop('_paths', None)
        for child in node.get('children', []):
            clean(child)
    clean(tree)
    return tree


def build():
    dataset = {}
    for level in facts.LEVELS:
        for item in json.loads((ROOT / 'data' / (level.lower() + '.json')).read_text()):
            dataset[item['k']] = item
    metadata, radicals = facts.load_metadata(), facts.load_radicals()
    trees, names, stories = {}, {}, {}
    for char, item in dataset.items():
        path = facts.STROKE_DIR / (item['cp'] + '.svg')
        if path.exists():
            tree = extract_tree(path.read_text())
            if tree and tree.get('c') == char:
                trees[char] = tree
    def collect(node):
        char = node.get('c')
        for label in (char, node.get('original')):
            if label and label not in names:
                names[label] = facts.component_info(label, dataset, metadata, radicals)
        for child in node.get('children', []):
            collect(child)
    for tree in trees.values():
        collect(tree)
    with (ROOT / 'resources' / 'mnemonics.csv').open(encoding='utf-8-sig') as f:
        rows = list(csv.DictReader(f))
    refs = {row['NUMBER']: row for row in rows}
    for row in rows:
        char = row.get('CHARACTER', '').strip()
        if char not in dataset or facts.strip_mnemonic_html(row.get('MNEMONIC')) != dataset[char].get('mnemonic'):
            continue
        parts = []
        for ref, label in re.findall(r"<u\s+[^>]*data-id=['\"]([^'\"]+)['\"][^>]*>(.*?)</u>", row.get('MNEMONIC', '')):
            source = refs.get(ref, {})
            c = source.get('CHARACTER', '').strip()
            if len(c) != 1 or c == char or any(p['c'] == c for p in parts):
                continue
            info = facts.component_info(c, dataset, metadata, radicals)
            info['m'] = facts.strip_mnemonic_html(label)
            parts.append(info)
        if parts:
            stories[char] = parts
    payload = {'source': 'KanjiVG', 'license': 'CC BY-SA 3.0', 'trees': trees, 'names': names, 'stories': stories}
    out = ROOT / 'data' / 'components.js'
    out.write_text('/* KanjiVG-derived hierarchy © Ulrich Apel, CC BY-SA 3.0. https://kanjivg.tagaini.net/ */\nwindow.KK_COMPONENTS = ' + json.dumps(payload, ensure_ascii=False, separators=(',', ':')) + ';\n')
    print(f'Component trees: {len(trees)}/{len(dataset)} kanji; {len(stories)} story reference sets; {out.stat().st_size / 1024:.1f} KiB')


if __name__ == '__main__':
    build()
