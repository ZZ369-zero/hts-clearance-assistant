#!/usr/bin/env python3
import argparse
import hashlib
import json
import re
import sys
import urllib.request
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime

import xlrd


OFFICIAL_URL = "https://www.epa.gov/compliance/importing-and-exporting-pesticides-and-devices"
CBP_REFERENCE_URL = "https://content.govdelivery.com/accounts/USDHSCBP/bulletins/25b0fed"
LIST_URL = "https://syslp.customsinfo.com/Sections/ResearchTools/OGA/Download/EP5.xls"
FLAG_META = {
    "status": "review",
    "nameZh": "EP5 可能需要 EPA 进口申报",
    "nameEn": "EPA Pesticide Notice of Arrival May Be Required",
    "meaningZh": "该 HTS 在 ACE 中带有 EP5 精确监管标志，可能需要提交 EPA 农药及装置进口申报/到货通知。",
    "meaningEn": "The HTS is flagged EP5 in ACE; EPA pesticide or device Notice of Arrival data may be required.",
}


def main():
    parser = argparse.ArgumentParser(description="Download and parse the EPA ACE EP5 HTS flag list.")
    parser.add_argument("--timeout", type=int, default=45)
    args = parser.parse_args()

    generated_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    payload, last_modified = download(LIST_URL, args.timeout)
    rows, sheet_name, dataset_date = parse_workbook(payload)
    codes = {
        hts: [{"flag": "EP5", "description": description}]
        for hts, description in rows
    }

    snapshot = {
        "generatedAt": generated_at,
        "count": len(rows),
        "uniqueCodeCount": len(codes),
        "source": {
            "name": "EPA ACE EP5 / CustomsInfo public OGA HTS flag list",
            "officialUrl": OFFICIAL_URL,
            "cbpReferenceUrl": CBP_REFERENCE_URL,
            "providerName": "CustomsInfo public OGA HTS flag list",
            "listSources": [{
                "flag": "EP5",
                "url": LIST_URL,
                "count": len(rows),
                "datasetDate": dataset_date,
                "lastModified": last_modified,
            }],
            "noteZh": "EP5 含义采用 EPA/CBP 官方说明；精确 HTS 清单来自公开 OGA 下载文件，并按每日任务监控更新。",
        },
        "flags": {
            "EP5": {
                **FLAG_META,
                "count": len(rows),
                "datasetDate": dataset_date,
                "sheetName": sheet_name,
                "sourceUrl": LIST_URL,
                "lastModified": last_modified,
                "sha256": hashlib.sha256(payload).hexdigest(),
            }
        },
        "codes": dict(sorted(codes.items())),
    }
    json.dump(snapshot, sys.stdout, ensure_ascii=False, separators=(",", ":"))


def download(url, timeout):
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "hts-clearance-assistant/1.0 (+https://github.com/ZZ369-zero/hts-clearance-assistant)",
            "Accept": "application/vnd.ms-excel,application/octet-stream;q=0.9,*/*;q=0.8",
        },
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        payload = response.read()
        last_modified = normalize_http_date(response.headers.get("Last-Modified"))
    if len(payload) < 1024:
        raise RuntimeError(f"Downloaded file is unexpectedly small: {url}")
    return payload, last_modified


def parse_workbook(payload):
    workbook = xlrd.open_workbook(file_contents=payload)
    sheet = workbook.sheet_by_index(0)
    rows = []

    for row_index in range(1, sheet.nrows):
        hts = normalize_hts(sheet.cell_value(row_index, 0))
        if len(hts) != 10:
            continue
        description = str(sheet.cell_value(row_index, 1) or "").strip() if sheet.ncols > 1 else ""
        rows.append((hts, description))

    dataset_date = ""
    match = re.search(r"(\d{1,2})-(\d{1,2})-(\d{4})", sheet.name)
    if match:
        month, day, year = match.groups()
        dataset_date = f"{year}-{int(month):02d}-{int(day):02d}"
    return rows, sheet.name, dataset_date


def normalize_hts(value):
    if isinstance(value, float) and value.is_integer():
        return str(int(value)).zfill(10)
    digits = re.sub(r"\D", "", str(value or ""))
    if 1 <= len(digits) < 10:
        digits = digits.zfill(10)
    return digits


def normalize_http_date(value):
    if not value:
        return ""
    try:
        return parsedate_to_datetime(value).astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
    except (TypeError, ValueError):
        return value


if __name__ == "__main__":
    main()
