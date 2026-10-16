"""Build Pengo grammar from pinned, CC BY-SA 4.0 Japanese Language Data.

No downloads, Anki deck, audio, or third-party Python dependencies are required.
Source notes remain community drafts; conversion is not an expert review.
Run: python3 scripts/build_grammar.py
"""
import hashlib
import html
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "resources/grammar/japanese-language-data"
OUT = ROOT / "data"
LEVELS = ["N5", "N4", "N3", "N2", "N1"]


def build():
    manifest = json.loads((SOURCE / "SOURCE.json").read_text())
    ids = json.loads((SOURCE / "pengo-ids.json").read_text())
    records = []
    for level in LEVELS:
        path = SOURCE / (level.lower() + ".json")
        if hashlib.sha256(path.read_bytes()).hexdigest() != manifest["files"][path.name]:
            raise ValueError("Pinned grammar source changed: " + path.name)
        for record in json.loads(path.read_text()):
            if record["level"] != level or len(record["examples"]) < 2:
                raise ValueError("Invalid source grammar entry: " + record["id"])
            records.append(record)
    if len({r["id"] for r in records}) != len(records):
        raise ValueError("Upstream grammar identifiers must be unique")
    identifier = {r["id"]: ids.get(r["id"], r["level"] + "-jld-" + r["id"]) for r in records}
    if len(set(identifier.values())) != len(records):
        raise ValueError("Pengo grammar identifiers must be unique")
    output = {level: [] for level in LEVELS}
    for record in records:
        sections = [{"label": "Meaning", "html": html.escape(record["meaning_detailed"])},
                    {"label": "Formation", "html": html.escape(record["formation"])},
                    {"label": "Register", "html": html.escape(record["formality"])}]
        if record.get("formation_notes"):
            sections.append({"label": "Usage", "html": "<br>".join(html.escape(n) for n in record["formation_notes"])})
        output[record["level"]].append({
            "id": identifier[record["id"]], "point": record["pattern"], "jlpt": record["level"],
            "frequency": "", "meaning": record["meaning_en"], "sections": sections,
            "examples": [{"jp": e["japanese"], "en": e["english"], "furi": html.escape(e["japanese"])} for e in record["examples"]],
            "related": [next(r["pattern"] for r in records if r["id"] == i)
                        for i in record.get("related", []) if i in identifier],
            "sourceId": record["id"], "reviewStatus": record["review_status"],
            "blankForms": sorted(set(re.findall(r"[\u3040-\u30ff\u3400-\u9fff]+", record["pattern"])), key=lambda s: (-len(s), s)),
        })
    OUT.mkdir(exist_ok=True)
    # Write the new examples first, excluding any readings from the retired deck.
    for level, rows in output.items():
        (OUT / ("grammar_" + level.lower() + ".json")).write_text(json.dumps(rows, ensure_ascii=False) + "\n")
    import furigana
    lookup, max_length = furigana.get_lookup()
    meta = {"levels": {}, "total": len(records), "withExamples": len(records),
            "examples": 0, "frequencies": {}, "unclassified": 0,
            "source": {**{k: manifest[k] for k in ["project", "author", "url", "commit", "license", "reviewStatus"]},
                       "modifications": "Schema conversion, stable IDs, escaped HTML and dictionary-based furigana"}}
    for level, rows in output.items():
        for row in rows:
            for example in row["examples"]:
                example["furi"] = furigana.annotate(example["jp"], lookup, max_length)
        examples = sum(len(r["examples"]) for r in rows)
        meta["levels"][level] = {"count": len(rows), "withExamples": len(rows), "examples": examples}
        meta["examples"] += examples
        (OUT / ("grammar_" + level.lower() + ".json")).write_text(json.dumps(rows, ensure_ascii=False) + "\n")
        print(level, len(rows), "grammar points,", examples, "examples")
    (OUT / "grammar_meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n")


if __name__ == "__main__":
    build()
