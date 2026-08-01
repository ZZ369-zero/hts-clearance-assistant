import io
import html
import json
import re
import sys
import urllib.request
from urllib.parse import urljoin
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime

from pypdf import PdfReader


USER_AGENT = "HTS-Clearance-Assistant/0.1"
CODE_PATTERN = re.compile(r"\b\d{4}(?:\.\d{2}){0,2}(?:\.\d{2,4})?\b")

SOURCES = {
    "automobile": {
        "name": "CBP Automobile Parts HTS List",
        "url": "https://content.govdelivery.com/attachments/USDHSCBP/2025/05/01/file_attachments/3247574/Attachment%202_Auto%20Parts%20HTS%20List%201.pdf",
        "bulletinUrl": "https://content.govdelivery.com/accounts/USDHSCBP/bulletins/3de7ef9",
        "chapter99": "9903.94.05",
        "zeroDutyChapter99": "9903.94.06",
        "rate": 25,
        "effectiveFrom": "2025-05-03T04:01:00.000Z",
    },
    "mhdv": {
        "name": "CBP Medium- and Heavy-Duty Vehicle Parts HTS List",
        "url": "https://content.govdelivery.com/attachments/USDHSCBP/2025/10/29/file_attachments/3441270/Section%20232%20MHDV%20Attachment.pdf",
        "bulletinUrl": "https://content.govdelivery.com/accounts/USDHSCBP/bulletins/3f93b75",
        "chapter99": "9903.74.08",
        "zeroDutyChapter99": "9903.74.11",
        "rate": 25,
        "effectiveFrom": "2025-11-01T04:01:00.000Z",
    },
}


def discover_attachment(source_id, source):
    request = urllib.request.Request(
        source["bulletinUrl"],
        headers={"User-Agent": USER_AGENT, "Accept": "text/html,*/*"},
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            page = response.read().decode("utf-8", errors="replace")
    except Exception:
        return source["url"], "fallback"

    links = [
        urljoin(source["bulletinUrl"], html.unescape(match))
        for match in re.findall(r'href=["\']([^"\']+\.pdf(?:\?[^"\']*)?)["\']', page, flags=re.IGNORECASE)
    ]
    if source_id == "automobile":
        candidates = [link for link in links if all(term in link.lower() for term in ("auto", "parts", "hts"))]
    else:
        candidates = [link for link in links if "mhdv" in link.lower() and "attachment" in link.lower()]
    return (candidates[-1], "discovered") if candidates else (source["url"], "fallback")


def fetch_pdf(source_id, source):
    source_url, discovery_status = discover_attachment(source_id, source)
    request = urllib.request.Request(
        source_url,
        headers={"User-Agent": USER_AGENT, "Accept": "application/pdf,*/*"},
    )
    with urllib.request.urlopen(request, timeout=90) as response:
        payload = response.read()
        last_modified = response.headers.get("Last-Modified", "")
    if not payload.startswith(b"%PDF"):
        raise RuntimeError(f"CBP source did not return a PDF: {source_url}")
    pages = [(page.extract_text() or "") for page in PdfReader(io.BytesIO(payload)).pages]
    return "\n".join(pages), format_http_date(last_modified), source_url, discovery_status


def format_http_date(value):
    if not value:
        return ""
    try:
        return parsedate_to_datetime(value).astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
    except (TypeError, ValueError):
        return value


def normalize_code(value):
    return re.sub(r"\D", "", value)


def extract_codes(text):
    codes = []
    for match in CODE_PATTERN.finditer(text):
        display = match.group(0)
        normalized = normalize_code(display)
        if len(normalized) not in {4, 6, 8, 10} or normalized.startswith("99"):
            continue
        chapter = int(normalized[:2])
        if chapter < 1 or chapter > 97:
            continue
        codes.append({"hts": normalized, "displayHts": display})

    unique = {}
    for item in codes:
        unique.setdefault(item["hts"], item)
    return sorted(unique.values(), key=lambda item: (item["hts"], len(item["hts"])))


def parse_automobile(text):
    if "AUTOMOBILE PARTS HTS LIST" not in text or "9903.94.05" not in text:
        raise RuntimeError("Automobile parts PDF heading was not recognized.")
    return extract_codes(text)


def parse_mhdv(text):
    marker = "Parts of Medium- and Heavy-Duty Vehicles"
    marker_index = text.find(marker)
    if marker_index < 0 or "9903.74.08" not in text:
        raise RuntimeError("MHDV parts PDF heading was not recognized.")
    return extract_codes(text[marker_index + len(marker):])


def build_snapshot():
    generated_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    lists = []
    for source_id, source in SOURCES.items():
        text, last_modified, source_url, discovery_status = fetch_pdf(source_id, source)
        codes = parse_automobile(text) if source_id == "automobile" else parse_mhdv(text)
        lists.append(
            {
                "id": source_id,
                **source,
                "url": source_url,
                "discoveryStatus": discovery_status,
                "lastModified": last_modified,
                "count": len(codes),
                "codes": codes,
            }
        )

    by_id = {item["id"]: item for item in lists}
    automobile = {item["hts"] for item in by_id["automobile"]["codes"]}
    mhdv = {item["hts"] for item in by_id["mhdv"]["codes"]}
    overlap = sorted(automobile & mhdv)
    old_prefix_coverage = {code for code in automobile | mhdv if code.startswith("8708")}
    missed_by_old_rule = sorted((automobile | mhdv) - old_prefix_coverage)

    required = "85122020"
    if required not in automobile or required not in mhdv:
        raise RuntimeError("Section 232 vehicle-parts sentinel 8512.20.20 is missing.")
    if len(automobile) < 100 or len(mhdv) < 150:
        raise RuntimeError(
            f"Section 232 vehicle-parts lists look incomplete: automobile={len(automobile)}, mhdv={len(mhdv)}"
        )

    return {
        "generatedAt": generated_at,
        "lists": lists,
        "audit": {
            "automobileCount": len(automobile),
            "mhdvCount": len(mhdv),
            "overlapCount": len(overlap),
            "overlapCodes": overlap,
            "missedByLegacy8708RuleCount": len(missed_by_old_rule),
            "missedByLegacy8708RuleExamples": missed_by_old_rule[:30],
        },
    }


if __name__ == "__main__":
    try:
        json.dump(build_snapshot(), sys.stdout, ensure_ascii=False, separators=(",", ":"))
    except Exception as error:
        print(str(error), file=sys.stderr)
        raise
