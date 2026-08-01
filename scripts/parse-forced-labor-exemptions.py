#!/usr/bin/env python3
"""Parse CBP's Section 301 forced-labor HTS exclusion list into a static snapshot."""

from __future__ import annotations

import json
import re
import sys
from datetime import datetime, timezone
from io import BytesIO
from urllib.request import Request, urlopen

from pypdf import PdfReader


BULLETIN_URL = "https://content.govdelivery.com/accounts/USDHSCBP/bulletins/421d887"
PDF_URL = (
    "https://content.govdelivery.com/attachments/USDHSCBP/2026/07/23/"
    "file_attachments/3723786/Forced%20Labor%20HTS%20LIST.pdf"
)
HTS_PATTERN = re.compile(r"\b([0-9]{4}\.[0-9]{2}\.[0-9]{2})\b")


def fetch_pdf() -> bytes:
    request = Request(
        PDF_URL,
        headers={
            "User-Agent": "HTS-Clearance-Assistant/1.0",
            "Accept": "application/pdf,*/*",
        },
    )
    with urlopen(request, timeout=90) as response:
        data = response.read()
    if not data.startswith(b"%PDF"):
        raise RuntimeError("CBP forced-labor attachment did not return a PDF")
    return data


def extract_text(pdf_data: bytes) -> str:
    pages = [(page.extract_text() or "") for page in PdfReader(BytesIO(pdf_data)).pages]
    if len(pages) < 4:
        raise RuntimeError("CBP forced-labor PDF returned too few pages")
    return "\n".join(pages).replace("\u6bcf", "-")


def section(text: str, start: str, end_patterns: list[str]) -> str:
    start_index = text.find(start)
    if start_index < 0:
        raise RuntimeError(f"Missing CBP section heading: {start}")
    possible_ends = [text.find(pattern, start_index + len(start)) for pattern in end_patterns]
    end_index = min(index for index in possible_ends if index >= 0)
    return text[start_index:end_index]


def extract_codes(text: str) -> list[str]:
    codes = {
        match.group(1)
        for match in HTS_PATTERN.finditer(text)
        if 1 <= int(match.group(1)[:2]) <= 97
    }
    return sorted(codes)


def extract_particular_articles(text: str) -> list[dict[str, object]]:
    body = section(text, "9903.05.87:", ["9903.05.88:"])
    matches = list(re.finditer(r"(?:^|\n)\((\d+)\)\s+", body))
    articles: list[dict[str, object]] = []
    for index, match in enumerate(matches):
        end = matches[index + 1].start() if index + 1 < len(matches) else len(body)
        description = re.sub(r"\s+", " ", body[match.end() : end]).strip(" ;")
        codes = extract_codes(description)
        articles.append(
            {
                "item": int(match.group(1)),
                "descriptionEn": description,
                "codes": codes,
            }
        )
    return articles


def rule(
    code: str,
    title_zh: str,
    summary_zh: str,
    match_type: str,
    *,
    codes: list[str] | None = None,
    chapters: list[str] | None = None,
    condition_zh: str = "",
    effective_to: str = "",
    status: str = "active",
    items: list[dict[str, object]] | None = None,
    chapter99_codes: list[str] | None = None,
) -> dict[str, object]:
    return {
        "code": code,
        "titleZh": title_zh,
        "summaryZh": summary_zh,
        "matchType": match_type,
        "codes": codes or [],
        "chapters": chapters or [],
        "conditionZh": condition_zh,
        "effectiveFrom": "2026-07-24T04:01:00.000Z",
        "effectiveTo": effective_to,
        "expiryLabel": effective_to[:10] if effective_to else "未规定到期日",
        "status": status,
        "sourceUrl": BULLETIN_URL,
        "pdfUrl": PDF_URL,
        "items": items or [],
        "chapter99Codes": chapter99_codes or [],
    }


def build_snapshot(text: str) -> dict[str, object]:
    exact_86_text = section(text, "9903.05.86:", ["9903.05.87:"])
    exact_86_codes = extract_codes(exact_86_text)
    particular_articles = extract_particular_articles(text)

    civil_aircraft_text = section(text, "9903.05.88:", ["9903.05.89:"])
    pharmaceutical_text = section(
        text,
        "9903.05.89:",
        ["9903.95.90:", "9903.05.90:"],
    )
    civil_aircraft_codes = extract_codes(civil_aircraft_text)
    pharmaceutical_codes = extract_codes(pharmaceutical_text)

    rules = {
        "9903.05.85": rule(
            "9903.05.85",
            "在途货物过渡豁免",
            "仅适用于2026年7月24日前已装船并处于最终运输途中，且在2026年7月28日凌晨前完成进口或保税提取的货物。",
            "conditional",
            condition_zh="须同时满足装船、连续运输及截止申报时间条件。",
            effective_to="2026-07-28T04:01:00.000Z",
            status="expired",
        ),
        "9903.05.86": rule(
            "9903.05.86",
            "HTS精确排除清单",
            "归入CBP官方清单所列HTS子目的商品，不适用9903.05.31的12.5%附加税。",
            "exact-hts",
            codes=exact_86_codes,
        ),
        "9903.05.87": rule(
            "9903.05.87",
            "特定商品排除",
            "仅限美国注释52列明的特定商品描述；HTS相同但商品规格不符时不得自动豁免。",
            "particular-article",
            codes=sorted({code for item in particular_articles for code in item["codes"]}),
            condition_zh="必须同时符合清单中的英文商品描述和HTS子目。",
            items=particular_articles,
        ),
        "9903.05.88": rule(
            "9903.05.88",
            "民用航空器排除",
            "符合民用航空器及其零部件用途和申报条件的商品可能排除。",
            "conditional-hts",
            codes=civil_aircraft_codes,
            condition_zh="需确认民用航空器用途、适用HTS和申报证明。",
        ),
        "9903.05.89": rule(
            "9903.05.89",
            "医药用途排除",
            "用于医药应用并符合官方清单HTS及用途条件的商品可能排除。",
            "conditional-hts",
            codes=pharmaceutical_codes,
            chapters=["28", "29", "30", "38", "39", "90"],
            condition_zh="需同时核对HTS清单、实际医药用途和进口资料。",
        ),
        "9903.05.90": rule(
            "9903.05.90",
            "其他贸易措施重叠排除",
            "钢铝铜、车辆及零部件、木制品、重型车辆和半导体等已适用特定贸易措施的商品可能排除。",
            "conditional",
            chapters=["44", "72", "73", "74", "76", "84", "85", "87"],
            condition_zh="需确认对应Chapter 99贸易措施编码，不能仅凭材质或章节自动豁免。",
            chapter99_codes=[
                "9903.94.01", "9903.94.02", "9903.94.03", "9903.94.05", "9903.94.06", "9903.94.07",
                "9903.94.31", "9903.94.32", "9903.94.33", "9903.94.40", "9903.94.41", "9903.94.42",
                "9903.94.43", "9903.94.44", "9903.94.45", "9903.94.50", "9903.94.51", "9903.94.52",
                "9903.94.53", "9903.94.54", "9903.94.55", "9903.94.60", "9903.94.61", "9903.94.62",
                "9903.94.63", "9903.94.64", "9903.94.65", "9903.94.66", "9903.94.67", "9903.94.68",
                "9903.94.69", "9903.76.01", "9903.76.02", "9903.76.03", "9903.76.20", "9903.76.21",
                "9903.76.22", "9903.76.23", "9903.76.24", "9903.74.01", "9903.74.02", "9903.74.03",
                "9903.74.06", "9903.74.08", "9903.74.09", "9903.74.10", "9903.79.01",
            ],
        ),
        "9903.05.91": rule(
            "9903.05.91",
            "捐赠物资排除",
            "由受美国管辖人士捐赠、用于减轻人类苦难的食品、衣物和药品等可能排除。",
            "conditional",
            chapters=["21", "30", "61", "62", "63"],
            condition_zh="需提供捐赠主体、用途和非商业交易证明。",
        ),
        "9903.05.92": rule(
            "9903.05.92",
            "信息资料排除",
            "出版物、电影、海报、录音、照片、缩微品、磁带、光盘、艺术品和新闻通讯等信息资料可能排除。",
            "conditional",
            chapters=["37", "49", "85", "97"],
            condition_zh="需确认商品属于受保护的信息材料范围。",
        ),
    }

    if "8524.91.10" not in exact_86_codes:
        raise RuntimeError("CBP exclusion parser sentinel failed: 8524.91.10 missing from 9903.05.86")
    if len(particular_articles) != 16:
        raise RuntimeError(
            f"CBP exclusion parser sentinel failed: expected 16 particular articles, got {len(particular_articles)}"
        )

    active_count = sum(1 for item in rules.values() if item["status"] == "active")
    expired_count = sum(1 for item in rules.values() if item["status"] == "expired")
    return {
        "generatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "sourceName": "CBP Section 301 Forced Labor HTS List",
        "sourceUrl": BULLETIN_URL,
        "pdfUrl": PDF_URL,
        "effectiveFrom": "2026-07-24T04:01:00.000Z",
        "baseDutyCode": "9903.05.31",
        "baseDutyRate": 12.5,
        "defaultOriginCountry": "China",
        "statistics": {
            "activeRules": active_count,
            "expiredRules": expired_count,
            "exactExclusionCodes": len(exact_86_codes),
            "particularArticles": len(particular_articles),
            "conditionalHtsCodes": len(civil_aircraft_codes) + len(pharmaceutical_codes),
        },
        "rules": rules,
    }


def main() -> None:
    pdf_data = fetch_pdf()
    snapshot = build_snapshot(extract_text(pdf_data))
    json.dump(snapshot, sys.stdout, ensure_ascii=False, separators=(",", ":"))


if __name__ == "__main__":
    main()
