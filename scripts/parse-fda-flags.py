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


OFFICIAL_URL = "https://www.fda.gov/industry/import-basics/harmonized-tariff-schedule-and-fd-flags"
LIST_URL_TEMPLATE = "https://syslp.customsinfo.com/Sections/ResearchTools/OGA/Download/{flag}.xls"
FLAG_META = {
    "FD1": {
        "status": "need_input",
        "nameZh": "FD1 FDA 数据可能需要",
        "nameEn": "FDA Data May Be Required",
        "meaningZh": "商品可能属于 FDA 监管范围；如受 FDA 监管需提交 801(a) 入境数据，否则应按实际用途申报 disclaim。",
        "meaningEn": "May or may not be regulated by FDA. Submit entry information if regulated; otherwise disclaim.",
    },
    "FD2": {
        "status": "high",
        "nameZh": "FD2 FDA 数据必须提供",
        "nameEn": "FDA Entry Data Required",
        "meaningZh": "商品属于 FDA 监管的非食品产品，通常必须提交 801(a) 入境数据。",
        "meaningEn": "Regulated by FDA, but not food. Entry information is required.",
    },
    "FD3": {
        "status": "need_input",
        "nameZh": "FD3 FDA 食品数据可能需要",
        "nameEn": "FDA Prior Notice Data May Be Required",
        "meaningZh": "商品可能属于食品；如作为食品进口需提交 Prior Notice 和入境数据，否则应按实际用途申报 disclaim。",
        "meaningEn": "May or may not be food. Submit Prior Notice and entry information if food; otherwise disclaim.",
    },
    "FD4": {
        "status": "high",
        "nameZh": "FD4 FDA 食品数据必须提供",
        "nameEn": "FDA Prior Notice and Entry Data Required",
        "meaningZh": "商品属于食品，通常必须提交 Prior Notice 和 FDA 入境数据。",
        "meaningEn": "Food product. Prior Notice and entry information are required.",
    },
}


def main():
    parser = argparse.ArgumentParser(description="Download and parse FDA FD1-FD4 HTS flag lists.")
    parser.add_argument("--timeout", type=int, default=45)
    args = parser.parse_args()

    generated_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    codes = {}
    flags = {}
    list_sources = []
    total_rows = 0

    for flag, metadata in FLAG_META.items():
        url = LIST_URL_TEMPLATE.format(flag=flag)
        payload, last_modified = download(url, args.timeout)
        rows, sheet_name, dataset_date = parse_workbook(payload)
        total_rows += len(rows)

        flags[flag] = {
            **metadata,
            "count": len(rows),
            "datasetDate": dataset_date,
            "sheetName": sheet_name,
            "sourceUrl": url,
            "lastModified": last_modified,
            "sha256": hashlib.sha256(payload).hexdigest(),
        }
        list_sources.append({
            "flag": flag,
            "url": url,
            "count": len(rows),
            "datasetDate": dataset_date,
            "lastModified": last_modified,
        })

        for hts, description in rows:
            records = codes.setdefault(hts, [])
            if not any(record["flag"] == flag for record in records):
                records.append({"flag": flag, "description": description})

    snapshot = {
        "generatedAt": generated_at,
        "count": total_rows,
        "uniqueCodeCount": len(codes),
        "source": {
            "name": "FDA FD Flags / CustomsInfo public HTS flag lists",
            "officialUrl": OFFICIAL_URL,
            "providerName": "CustomsInfo public OGA HTS flag lists",
            "listSources": list_sources,
            "noteZh": "FD1-FD4 含义采用 FDA 官方说明；HTS 精确代码清单来自公开 OGA 下载文件，并按每日任务监控更新。",
        },
        "flags": flags,
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
        raw_code = sheet.cell_value(row_index, 0)
        hts = normalize_hts(raw_code)
        if len(hts) != 10:
            continue
        description = ""
        if sheet.ncols > 1:
            description = str(sheet.cell_value(row_index, 1) or "").strip()
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
