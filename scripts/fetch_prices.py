"""Capture completed US sessions and cross-check every listing against Nasdaq Trader."""
import csv
import io
import json
import math
from datetime import datetime, time, timedelta, timezone
from pathlib import Path
from time import sleep
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

import exchange_calendars as calendars

ROOT = Path(__file__).resolve().parents[1]
from universe import SYMBOLS
HEADERS = {"User-Agent": "Mozilla/5.0"}
NEW_YORK = ZoneInfo("America/New_York")
DIRECTORY = "https://www.nasdaqtrader.com/dynamic/SymDir/"


def get(url):
    for attempt in range(3):
        endpoint = url.replace("query1.finance.yahoo.com", "query2.finance.yahoo.com") if attempt == 1 else url
        try:
            with urlopen(Request(endpoint, headers=HEADERS), timeout=30) as response:
                return response.read()
        except (HTTPError, URLError, TimeoutError) as error:
            if attempt == 2 or isinstance(error, HTTPError) and error.code not in (403, 408, 429, 500, 502, 503, 504):
                raise
            sleep(2 ** (attempt + 1))


def capture(now,symbols=SYMBOLS,*,listing_starts=None):
    # Python calendar months are 1-indexed. Allow two hours after the regular US close.
    local = now.astimezone(NEW_YORK)
    end = datetime.combine(local.date(), time.min, tzinfo=NEW_YORK)
    if local.hour >= 18:
        end += timedelta(days=1)
    start = datetime(2023, 1, 1, tzinfo=timezone.utc)
    directory = {}
    for file, key in [("nasdaqlisted.txt", "Symbol"), ("otherlisted.txt", "ACT Symbol")]:
        for row in csv.DictReader(io.StringIO(get(DIRECTORY + file).decode()), delimiter="|"):
            if row.get("Test Issue") == "N":
                directory[row[key]] = (row["Security Name"], DIRECTORY + file)
    output = {"retrieved": now.isoformat(), "endExclusive": end.date().isoformat(), "series": {}}
    for symbol in symbols:
        name, identity_source = directory[symbol]
        url = (f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}"
               f"?period1={int(start.timestamp())}&period2={int(end.timestamp())}&interval=1d")
        result = json.loads(get(url))["chart"]["result"][0]
        meta = result["meta"]
        assert meta["symbol"] == symbol and meta["currency"] == "USD"
        points = {}
        for stamp, price in zip(result["timestamp"], result["indicators"]["adjclose"][0]["adjclose"], strict=True):
            session = datetime.fromtimestamp(stamp, NEW_YORK).date()
            if session >= end.date() or price is None:
                continue
            assert math.isfinite(price) and price > 0 and session.isoformat() not in points
            points[session.isoformat()] = price
        listing_start = (listing_starts or {}).get(symbol)
        if listing_start:
            assert points and min(points) == listing_start, f"Unexpected first session for {symbol}"
        else:
            assert len(points) >= 126
        print(symbol, name, min(points), max(points), flush=True)
        output["series"][symbol] = dict(name=meta.get("longName") or meta.get("shortName") or name, listing=name, listingSource=identity_source,
                                        url=url, prices=points)
    latest = {max(item["prices"]) for item in output["series"].values()}
    assert len(latest) == 1, f"Mixed last sessions: {latest}"
    expected = calendars.get_calendar("XNYS").date_to_session(end.date() - timedelta(days=1), direction="previous")
    assert latest == {expected.date().isoformat()}, f"Expected completed session {expected.date()}, got {latest}"
    return output


if __name__ == "__main__":
    snapshot = capture(datetime.now(timezone.utc))
    path = ROOT / "data" / "prices.json"
    temp = path.with_suffix(".tmp")
    temp.write_text(json.dumps(snapshot, separators=(",", ":")), encoding="utf-8")
    temp.replace(path)
    for symbol, entry in snapshot["series"].items():
        print(symbol, entry["name"], entry["listing"], len(entry["prices"]), max(entry["prices"]))
