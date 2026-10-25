"""Extract the Delhi Revenue colony PDF into an INACTIVE, unverified proposal.

Usage: python scripts/import-delhi-localities.py /path/to/colony1.pdf
Requires pypdf as an external extraction tool, not an application dependency.
Never connects to a database. Never guesses PINs or current district boundaries.
"""
import hashlib
import json
import re
import sys
import uuid
from pathlib import Path
from pypdf import PdfReader

source = "https://revenue.delhi.gov.in/sites/default/files/revenue/ereg/colony1.pdf"
pdf = Path(sys.argv[1])
records = {}
unparsed = []
for page in PdfReader(pdf).pages:
    lines = page.extract_text().splitlines()
    buffer = ""
    for line in lines + ["END"]:
        line = " ".join(line.split())
        if line.startswith("S.No.") or not line:
            continue
        if re.match(r"^\d+\s", line) or line == "END":
            if buffer:
                # PDF column positioning sometimes splits district words into
                # letters. Normalize only known source district labels, not names.
                match = None
                for district in ["NORTH-EAST", "NORTH-WEST", "SOUTH-WEST", "NEW DELHI", "CENTRAL", "NORTH", "SOUTH", "EAST", "WEST"]:
                    suffix = r"\s*".join(re.escape(c) for c in district if c != " ")
                    match = re.fullmatch(r"(\d+) (.+?)\s+" + suffix, buffer, re.I)
                    if match:
                        break
                if not match:
                    unparsed.append(buffer)
                else:
                    serial, name = match.groups()
                    name = re.sub(r" [A-H]$", "", name)
                    key = (name.casefold(), district.casefold())
                    row = records.setdefault(key, {"id": str(uuid.uuid5(uuid.NAMESPACE_URL, source + "#" + "|".join(key))), "name": name, "district": district, "source_keys": []})
                    row["source_keys"].append(serial)
            buffer = "" if line == "END" else line
        else:
            buffer += " " + line

if unparsed:
    raise SystemExit("Extraction requires review; unparsed rows: " + json.dumps(unparsed[:12]))
rows = sorted(records.values(), key=lambda row: (row["name"].casefold(), row["district"].casefold()))
serials = [int(key) for row in rows for key in row["source_keys"]]
if sorted(serials) != list(range(1, max(serials) + 1)):
    raise SystemExit("Missing or repeated source row numbers; do not publish this extraction")
result = {"source_url": source, "source_sha256": hashlib.sha256(pdf.read_bytes()).hexdigest(), "source_rows": len(serials),
          "limitations": "Historical Revenue colony names/district labels; not a current exhaustive locality or postal-boundary dataset. No PIN mapping inferred. All rows import unverified/inactive.", "localities": rows}
Path("data/localities/delhi-revenue.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
quote = lambda value: "'" + value.replace("'", "''") + "'"
values = ["(" + ",".join([quote(row["id"]), quote(row["name"]), quote(row["district"]), quote(source), "array[" + ",".join(quote(key) for key in row["source_keys"]) + "]"]) + ")" for row in rows]
Path("supabase/migrations/20261025090001_delhi_locality_catalog.sql").write_text(
    "-- Phase 4E catalog proposal. No coverage, PINs or professional permissions are created.\n"
    "-- Source/limitations: data/localities/README.md. All imported rows default unverified/inactive.\n"
    "insert into public.marketplace_localities(id,name,district,source_url,source_keys) values\n" + ",\n".join(values) + ";\n", encoding="utf-8")
print(f"Extracted {len(serials)} source rows into {len(rows)} distinct historical name/district records; no postal mappings or active areas.")
