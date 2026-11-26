"""Capture contextual stocks separately from the fixed historical signal baskets."""
import json
from datetime import datetime, timezone
from pathlib import Path

from fetch_prices import capture

ROOT = Path(__file__).resolve().parents[1]

if __name__ == "__main__":
    reviewed = json.loads((ROOT / "app/src/data.json").read_text(encoding="utf-8-sig"))
    starts = {"ANT": "2026-11-19"}
    symbols = ["NET", "SHOP", "ANT", "MU", "AVGO", "DLR", "AAPL", "NEE", "ASML", "ASX", "PLTR", "TSLA"]
    result = capture(datetime.now(timezone.utc), symbols, listing_starts=starts)
    # Reuse the reviewed control prices so their role as a reference and benchmark agrees.
    core = json.loads((ROOT / "data/prices.json").read_text(encoding="utf-8"))["series"]
    for symbol in ["MSFT", "AMZN", "GOOGL", "ORCL"]:
        result["series"][symbol] = core[symbol]
    sessions = set(reviewed["marketCloses"])
    for symbol, entry in result["series"].items():
        expected = {day for day in sessions if day >= starts.get(symbol, "")}
        missing = expected.difference(entry["prices"])
        if missing:
            raise ValueError(f"{symbol} missing {len(missing)} reviewed sessions")
        entry["prices"] = {day: entry["prices"][day] for day in sorted(expected)}
    result["asOf"] = reviewed["asOf"]
    path = ROOT / "app/src/content/dashboard/reference-prices.json"
    temp = path.with_suffix(".tmp")
    temp.write_text(json.dumps(result, separators=(",", ":")), encoding="utf-8")
    temp.replace(path)
