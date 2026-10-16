"""Release regressions for content provenance, removed sources and offline parity."""
import hashlib
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import build_data


class LicensedContentTest(unittest.TestCase):
    def test_upstream_grammar_integrity_and_identifiers(self):
        source = ROOT / "resources/grammar/japanese-language-data"
        manifest = json.loads((source / "SOURCE.json").read_text())
        stable_ids = json.loads((source / "pengo-ids.json").read_text())
        self.assertEqual(manifest["license"], "CC-BY-SA-4.0")
        self.assertEqual(len(manifest["commit"]), 40)
        seen = set()
        for level in range(1, 6):
            path = source / f"n{level}.json"
            self.assertEqual(hashlib.sha256(path.read_bytes()).hexdigest(), manifest["files"][path.name])
            upstream = {r["id"]: r for r in json.loads(path.read_text())}
            runtime = json.loads((ROOT / f"data/grammar_n{level}.json").read_text())
            self.assertEqual(len(upstream), len(runtime))
            for row in runtime:
                self.assertNotIn(row["id"], seen)
                seen.add(row["id"])
                original = upstream[row["sourceId"]]
                self.assertEqual(row["point"], original["pattern"])
                self.assertEqual(row["reviewStatus"], original["review_status"])
                self.assertNotIn("sourceNotes", row)
                self.assertEqual([(e["jp"], e["en"]) for e in row["examples"]],
                                 [(e["japanese"], e["english"]) for e in original["examples"]])
                self.assertGreaterEqual(len(row["examples"]), 2)
                if row["sourceId"] in stable_ids:
                    self.assertEqual(row["id"], stable_ids[row["sourceId"]])
        self.assertEqual(len(seen), 595)

    def test_retired_content_is_not_shipped_or_reintroduced(self):
        self.assertFalse((ROOT / "resources/mnemonics.csv").exists())
        self.assertFalse((ROOT / "scripts/wk_radicals.py").exists())
        metadata = json.loads((ROOT / "resources/kanji/kanji_metadata.json").read_text())
        self.assertFalse(any(key.startswith("wk_") for record in metadata.values() for key in record))
        for level in range(1, 6):
            for row in json.loads((ROOT / f"data/n{level}.json").read_text()):
                expected = build_data.make_mnemonic(row["k"], row["meaning"],
                                                   [c["m"] for c in row["components"]], row["on"], row["kun"])
                self.assertEqual(row["mnemonic"], expected)
        import sync_kanji_data
        self.assertEqual(sync_kanji_data.without_proprietary_enrichment({"字": {"wk_level": 1, "strokes": 6}}),
                         {"字": {"strokes": 6}})

    def test_offline_bundle_contains_the_same_replacement_data(self):
        script = (ROOT / "data/bundle.js").read_text()
        bundle = json.loads(script.removeprefix("window.KK_DATA = ").removesuffix(";"))
        for level in range(1, 6):
            self.assertEqual(bundle["grammar"][f"N{level}"], json.loads((ROOT / f"data/grammar_n{level}.json").read_text()))
            self.assertEqual(bundle["levels"][f"N{level}"], json.loads((ROOT / f"data/n{level}.json").read_text()))
        self.assertEqual(bundle["radicals"], json.loads((ROOT / "data/radicals.json").read_text()))

    def test_notices_and_grammar_credit_are_available(self):
        self.assertIn("Apache License", (ROOT / "LICENSE").read_text())
        for name in ["CC-BY-SA-4.0.txt", "CC-BY-SA-3.0.txt", "CC-BY-4.0.txt", "CC-BY-2.0-FR.html"]:
            self.assertGreater((ROOT / "resources/licenses" / name).stat().st_size, 1000)
        app = (ROOT / "app.js").read_text()
        self.assertNotIn("no licence stated", app)
        self.assertNotIn("Japanese Core Grammar", app)
        self.assertIn("Justin Kindrix", app)


if __name__ == "__main__":
    unittest.main()
