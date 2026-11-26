"""Prepare a complete, verified US-close snapshot before the publication job can commit it."""
import json
import argparse
import subprocess
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import exchange_calendars as calendars

ROOT = Path(__file__).resolve().parents[1]
CORE = ROOT / "app/src/data.json"
REFS = ROOT / "app/src/content/dashboard/reference-prices.json"


def latest_close(now):
    # Python calendar months are one-indexed. Allow two hours after the exchange close.
    calendar = calendars.get_calendar("XNYS")
    cutoff = now.astimezone(timezone.utc) - timedelta(hours=2)
    session = calendar.date_to_session(cutoff.date(), direction="previous")
    if calendar.session_close(session) > cutoff:
        session = calendar.previous_session(session)
    return session.date().isoformat()


def read(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def check_panel(core, refs, expected):
    if core["asOf"] != expected or refs["asOf"] != expected or max(core["marketCloses"]) != expected:
        raise ValueError("Core, reference and broad-market histories must match the completed exchange session")
    if len(core["groups"]) != 13 or set(core["groups"]) != set(core["queries"]):
        raise ValueError("Incomplete layer coverage")
    for key, query in core["queries"].items():
        if query["rows"][-1]["date"] != expected:
            raise ValueError(f"Incomplete layer history for {key}")
    for symbol, record in refs["series"].items():
        if max(record["prices"]) != expected:
            raise ValueError(f"Incomplete reference history for {symbol}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--verify-provider", action="store_true", help="Fetch and reconcile prices even when the saved close is current")
    args = parser.parse_args()
    expected = latest_close(datetime.now(timezone.utc))
    old, old_refs = read(CORE), read(REFS)
    check_panel(old, old_refs, old["asOf"])
    if old["asOf"] > expected:
        raise ValueError(f"Existing {old['asOf']} snapshot is ahead of the expected {expected} close")
    if old["asOf"] == expected and not args.verify_provider:
        print(f"All 13 layers and reference prices already cover {expected}")
        return
    (ROOT / "data").mkdir(exist_ok=True)
    for name in ("fetch_prices.py", "pipeline.py", "fetch_references.py", "verify.py"):
        subprocess.run([sys.executable, str(ROOT / "scripts" / name)], cwd=ROOT, check=True)
    core, refs = read(CORE), read(REFS)
    check_panel(core, refs, expected)
    if old["marketCloses"].keys() - core["marketCloses"].keys() or old_refs["series"].keys() != refs["series"].keys():
        raise ValueError("Historical market or reference coverage regressed")
    subprocess.run(["node", "scripts/check_attribution.mjs"], cwd=ROOT, check=True)
    print(f"Verified {expected} across all 13 layers and {len(refs['series'])} reference series")


if __name__ == "__main__":
    main()
