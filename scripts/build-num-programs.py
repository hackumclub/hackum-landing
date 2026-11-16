#!/usr/bin/env python3
"""Build src/data/num-programs.json from the NUM open-data `programdata` CSV.

Source: https://data.num.edu.mn (licence CC BY-SA). Run manually, never at build time:
    python3 -I scripts/build-num-programs.py [--input local.csv] [--out src/data/num-programs.json]
"""
import argparse
import csv
import io
import json
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

URL = (
    "https://data.num.edu.mn/dataset/bf1557b2-7fa5-416f-97c4-c54ee72595f8/resource/"
    "fb581342-b6a8-428e-85c0-6f0a4b1f263c/download/program-data-2023-autumn.csv"
)
LEVELS = {"Бакалавр": "bachelor", "Магистр": "master", "Доктор": "doctor"}
LEVEL_ORDER = {"bachelor": 0, "master": 1, "doctor": 2}
MAX_BYTES = 120 * 1024


def track_of(mn: str, en: str) -> str:
    """Exact (case-insensitive) match on the programme name; mirrors trackOf() in src/lib/num/programs.ts."""
    names = {mn.casefold(), en.casefold()}
    table = (
        ("software", ("программ хангамж", "software engineering")),
        ("cs", ("компьютерын ухаан", "компьютерийн ухаан", "computer science")),
        ("is", ("мэдээллийн систем", "information systems")),
        ("it", ("мэдээллийн технологи", "information technology")),
    )
    for track, needles in table:
        if names & set(needles):
            return track
    return "other"


def read_csv(path: str | None) -> str:
    if path:
        raw = Path(path).read_bytes()
    else:
        req = urllib.request.Request(URL, headers={"User-Agent": "hackum-program-builder"})
        with urllib.request.urlopen(req, timeout=60) as r:  # noqa: S310 (fixed https URL)
            raw = r.read()
    return raw.decode("utf-8-sig")


def build(text: str) -> list[dict]:
    best: dict[tuple[str, str, str], tuple[int, dict]] = {}
    for row in csv.DictReader(io.StringIO(text)):
        level = LEVELS.get((row.get("Академик_түвшин") or "").strip())
        if not level:
            continue
        index = " ".join((row.get("Хөтөлбөрийн_индекс") or "").split())
        mn = " ".join((row.get("Хөтөлбөрийн_монгол_нэр") or "").split())
        if not index or not mn:
            continue
        en = " ".join((row.get("Хөтөлбөрийн_англи_нэр") or "").split()) or mn
        unit = " ".join((row.get("Харьяалах_нэгжийн_нэр") or "").split())
        try:
            year = int((row.get("Батлагдсан_он") or "0").strip())
        except ValueError:
            year = 0
        item = {"index": index, "name": {"mn": mn, "en": en}, "level": level, "unit": unit, "track": track_of(mn, en)}
        key = (index, mn, level)
        if key not in best or year > best[key][0]:
            best[key] = (year, item)
    items = [v[1] for v in best.values()]
    items.sort(key=lambda p: (LEVEL_ORDER[p["level"]], p["name"]["mn"], p["index"]))
    return items


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", help="read a local CSV instead of downloading")
    ap.add_argument("--out", default=str(Path(__file__).resolve().parent.parent / "src/data/num-programs.json"))
    args = ap.parse_args()
    programs = build(read_csv(args.input))
    doc = {
        "source": "https://data.num.edu.mn (МУИС Нээлттэй Өгөгдөл, programdata)",
        "license": "CC BY-SA",
        "fetched_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "programs": programs,
    }
    out = json.dumps(doc, ensure_ascii=False, separators=(",", ":")) + "\n"
    size = len(out.encode("utf-8"))
    if size >= MAX_BYTES:
        print(f"output {size} bytes exceeds {MAX_BYTES}", file=sys.stderr)
        return 1
    Path(args.out).write_text(out, encoding="utf-8")
    counts = {lv: sum(1 for p in programs if p["level"] == lv) for lv in LEVEL_ORDER}
    tracks = {t: sum(1 for p in programs if p["track"] == t) for t in ("software", "cs", "is", "it", "other")}
    print(f"wrote {len(programs)} programs, {size} bytes; levels={counts}; tracks={tracks}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
