#!/usr/bin/env python3
"""Parse USITC's China Tariffs PDF into HTS-to-Chapter-99 mappings."""

from __future__ import annotations

import json
import re
import sys
from datetime import datetime, timezone
from io import BytesIO
from urllib.request import Request, urlopen

from pypdf import PdfReader


SOURCE_URL = "https://hts.usitc.gov/reststop/file?filename=China+Tariffs&release=currentRelease"
ROW_PATTERN = re.compile(r"\b(\d{4}\.\d{2}\.(?:\d{2}|\d{4}))\s+(9903\.(?:88|91|92)\.\d{2})\b")
SENTINEL_MAPPINGS = [
    ("39249056", "3924.90.56", "9903.88.15", "3924905650"),
    ("2931909010", "2931.90.9010", "9903.88.04", "2931909010"),
    ("4901990010", "4901.99.0010", "9903.88.15", "4901990010"),
    ("6307909842", "6307.90.9842", "9903.91.07", "6307909842"),
    ("8517620010", "8517.62.0010", "9903.88.04", "8517620010"),
    ("9401806030", "9401.80.6030", "9903.88.04", "9401806030"),
    ("9403704031", "9403.70.4031", "9903.88.04", "9403704031"),
]


def fetch_pdf() -> bytes:
    request = Request(
        SOURCE_URL,
        headers={
            "User-Agent": "HTS-Clearance-Assistant/1.0",
            "Accept": "application/pdf,*/*",
        },
    )
    with urlopen(request, timeout=90) as response:
        data = response.read()
    if not data.startswith(b"%PDF"):
        raise RuntimeError("USITC China Tariffs endpoint did not return a PDF")
    return data


def clean_hts(value: str) -> str:
    return re.sub(r"\D", "", value or "")


def parse_entries(pdf_data: bytes) -> list[dict[str, object]]:
    reader = PdfReader(BytesIO(pdf_data))
    entries_by_key: dict[tuple[str, str], dict[str, object]] = {}
    for page_number, page in enumerate(reader.pages, start=1):
        text = page.extract_text() or ""
        for match in ROW_PATTERN.finditer(text):
            display_hts = match.group(1)
            chapter99 = match.group(2)
            hts = clean_hts(display_hts)
            key = (hts, chapter99)
            entries_by_key.setdefault(
                key,
                {
                    "hts": hts,
                    "displayHts": display_hts,
                    "chapter99": chapter99,
                    "sourcePage": page_number,
                },
            )
    return sorted(entries_by_key.values(), key=lambda item: (str(item["hts"]), str(item["chapter99"])))


def build_by_hts(entries: list[dict[str, object]]) -> dict[str, list[str]]:
    by_hts: dict[str, set[str]] = {}
    for entry in entries:
        by_hts.setdefault(str(entry["hts"]), set()).add(str(entry["chapter99"]))
    return {hts: sorted(codes) for hts, codes in sorted(by_hts.items())}


def main() -> int:
    pdf_data = fetch_pdf()
    entries = parse_entries(pdf_data)
    by_hts = build_by_hts(entries)
    if len(entries) < 10000:
        raise RuntimeError(f"USITC China Tariffs parse returned too few rows: {len(entries)}")
    missing_sentinels = [
        (hts, chapter99)
        for hts, _display_hts, chapter99, _example_hts in SENTINEL_MAPPINGS
        if chapter99 not in by_hts.get(hts, [])
    ]
    if missing_sentinels:
        details = ", ".join(f"{hts} -> {chapter99}" for hts, chapter99 in missing_sentinels)
        raise RuntimeError(f"Missing China Tariffs sentinel mapping(s): {details}")

    snapshot = {
        "generatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "sourceName": "USITC China Tariffs",
        "sourceUrl": SOURCE_URL,
        "count": len(entries),
        "mappedPrefixes": len(by_hts),
        "entries": entries,
        "byHts": by_hts,
        "sentinels": [
            {
                "hts": hts,
                "displayHts": display_hts,
                "chapter99": chapter99,
                "exampleHts": example_hts,
            }
            for hts, display_hts, chapter99, example_hts in SENTINEL_MAPPINGS
        ],
    }
    json.dump(snapshot, sys.stdout, ensure_ascii=False, indent=2)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
