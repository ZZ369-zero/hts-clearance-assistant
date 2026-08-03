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


OFFICIAL_URL = "https://www.epa.gov/importing-vehicles-and-engines"
PESTICIDE_OFFICIAL_URL = "https://www.epa.gov/compliance/importing-and-exporting-pesticides-and-devices"
CBP_REFERENCE_URL = "https://www.cbp.gov/sites/default/files/2024-08/ACE%20CATAIR%20EPA%20Supplemental%20Guidelines%20v17%2008-01-24%20FINAL_508.pdf"
LIST_BASE_URL = "https://syslp.customsinfo.com/Sections/ResearchTools/OGA/Download"
FLAG_CONFIG = {
    "EP3": {
        "url": f"{LIST_BASE_URL}/EP3.xls",
        "status": "review",
        "nameZh": "EP3 可能需要 EPA 车辆或发动机进口申报",
        "nameEn": "EPA Vehicle or Engine Declaration May Be Required",
        "meaningZh": "该 HTS 在 ACE 中带有 EP3 精确监管标志，装有受监管发动机的车辆、机械或设备可能需要 EPA 车辆/发动机进口申报。",
        "meaningEn": "The HTS is flagged EP3 in ACE; an EPA vehicle or engine declaration may be required for regulated engines, vehicles, or equipment.",
        "officialUrl": OFFICIAL_URL,
    },
    "EP5": {
        "url": f"{LIST_BASE_URL}/EP5.xls",
        "status": "review",
        "nameZh": "EP5 可能需要 EPA 农药及装置进口申报",
        "nameEn": "EPA Pesticide Notice of Arrival May Be Required",
        "meaningZh": "该 HTS 在 ACE 中带有 EP5 精确监管标志，可能需要提交 EPA 农药及装置进口申报/到货通知。",
        "meaningEn": "The HTS is flagged EP5 in ACE; EPA pesticide or device Notice of Arrival data may be required.",
        "officialUrl": PESTICIDE_OFFICIAL_URL,
    },
}


def main():
    parser = argparse.ArgumentParser(description="Download and parse EPA ACE EP3 and EP5 HTS flag lists.")
    parser.add_argument("--timeout", type=int, default=45)
    args = parser.parse_args()

    generated_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    codes = {}
    flags = {}
    list_sources = []
    total_rows = 0

    for flag, config in FLAG_CONFIG.items():
        payload, last_modified = download(config["url"], args.timeout)
        rows, sheet_name, dataset_date = parse_workbook(payload)
        total_rows += len(rows)
        for hts, description in rows:
            codes.setdefault(hts, []).append({"flag": flag, "description": description})

        list_sources.append({
            "flag": flag,
            "url": config["url"],
            "count": len(rows),
            "datasetDate": dataset_date,
            "lastModified": last_modified,
        })
        flags[flag] = {
            **{key: value for key, value in config.items() if key != "url"},
            "count": len(rows),
            "datasetDate": dataset_date,
            "sheetName": sheet_name,
            "sourceUrl": config["url"],
            "lastModified": last_modified,
            "sha256": hashlib.sha256(payload).hexdigest(),
        }

    snapshot = {
        "generatedAt": generated_at,
        "count": total_rows,
        "uniqueCodeCount": len(codes),
        "source": {
            "name": "EPA ACE EP3/EP5 / CustomsInfo public OGA HTS flag lists",
            "officialUrl": OFFICIAL_URL,
            "pesticideOfficialUrl": PESTICIDE_OFFICIAL_URL,
            "cbpReferenceUrl": CBP_REFERENCE_URL,
            "providerName": "CustomsInfo public OGA HTS flag lists",
            "listSources": list_sources,
            "noteZh": "EP3/EP5 含义采用 EPA/CBP 官方说明；精确 HTS 清单来自公开 OGA 下载文件，并按每日任务监控更新。HTS 标志属于申报提示，不等同于自动认定必须认证或申报。",
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
