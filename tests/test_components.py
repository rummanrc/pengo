"""Structural extraction regressions; no network or third-party dependencies."""
import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from build_components import extract_tree

def svg(body):
    return '<svg xmlns="http://www.w3.org/2000/svg" xmlns:kvg="http://kanjivg.tagaini.net"><g id="kvg:StrokePaths_x"><g kvg:element="語">' + body + '</g></g></svg>'

class ComponentsTest(unittest.TestCase):
    def test_nested_shapes(self):
        tree = extract_tree(svg('<g kvg:element="言"><path id="a"/></g><g kvg:element="吾"><g kvg:element="五"><path id="b"/></g><g kvg:element="口"><path id="c"/></g></g>'))
        self.assertEqual([n['c'] for n in tree['children']], ['言','吾'])
        self.assertEqual([n['c'] for n in tree['children'][1]['children']], ['五','口'])
        self.assertTrue(tree['complete'])
    def test_anonymous_strokes_do_not_claim_full_breakdown(self):
        tree = extract_tree(svg('<g><g><path id="a"/></g></g><g kvg:element="口"><path id="b"/></g>'))
        self.assertEqual([n['c'] for n in tree['children']], ['口'])
        self.assertFalse(tree['complete'])
    def test_disconnected_parts_merge_but_repeated_parts_stay(self):
        tree = extract_tree(svg('<g kvg:element="二" kvg:part="1"><path id="a"/></g><g kvg:element="二" kvg:part="2"><path id="b"/></g><g kvg:element="木"><path id="c"/></g><g kvg:element="木"><path id="d"/></g>'))
        self.assertEqual([n['c'] for n in tree['children']], ['二','木','木'])
        self.assertTrue(tree['complete'])
    def test_shape_annotations_preserved(self):
        tree = extract_tree(svg('<g kvg:element="月" kvg:original="肉" kvg:position="left" kvg:partial="true"><path id="a"/></g>'))
        node = tree['children'][0]
        self.assertEqual((node['original'],node['position'],node['partial']), ('肉','left','true'))
        self.assertNotIn('_paths',node)
    def test_namespace_declared_only_in_old_dtd(self):
        text = (Path(__file__).resolve().parents[1]/'resources/stroke-order/kanjivg/08a9e.svg').read_text()
        self.assertEqual(extract_tree(text)['c'],'語')

if __name__ == '__main__':
    unittest.main()
