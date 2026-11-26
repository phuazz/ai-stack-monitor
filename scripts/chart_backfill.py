"""Extend the chart history before each layer's first reviewed row, on the same price basis."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
import json
import math
from pathlib import Path
import subprocess
import time

import pandas as pd
import exchange_calendars as calendars
from fetch_prices import get, NEW_YORK
from pipeline import basket

ROOT = Path(__file__).resolve().parents[1]
CHART = ROOT / "app/src/content/dashboard"


def read(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def main():
    core = read(ROOT / "data/prices.json")["series"]
    refs = read(CHART / "reference-prices.json")["series"]
    series = {s: item["prices"] for s, item in {**core, **refs}.items()}
    reviewed = read(ROOT / "app/src/data.json")
    anchor = min(reviewed["marketCloses"])
    # Python calendar months are 1-indexed. Start ahead of the five-year window for MA warm-up.
    start = datetime(2020, 1, 1, tzinfo=timezone.utc)
    stop = datetime.fromisoformat(anchor).replace(tzinfo=timezone.utc) + timedelta(days=3)
    def extend(symbol):
        current = series[symbol]
        if anchor not in current:
            return
        url = (f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}"
               f"?period1={int(start.timestamp())}&period2={int(stop.timestamp())}&interval=1d")
        for attempt in range(3):
            try:
                result = json.loads(get(url))["chart"]["result"][0]
                break
            except OSError:
                if attempt == 2:
                    raise
                time.sleep(2**attempt)
        assert result["meta"]["symbol"] == symbol and result["meta"]["currency"] == "USD"
        older = {datetime.fromtimestamp(t, NEW_YORK).date().isoformat(): p
                 for t,p in zip(result["timestamp"],result["indicators"]["adjclose"][0]["adjclose"],strict=True)
                 if p is not None}
        scale = current[anchor] / older[anchor]
        for day in older.keys() & current.keys():
            assert math.isclose(older[day]*scale,current[day],rel_tol=1e-5), (symbol,day)
        assert all(p > 0 and math.isfinite(p) for p in older.values())
        current.update({day:p*scale for day,p in older.items() if day<anchor})

    with ThreadPoolExecutor(max_workers=4) as executor:
        list(executor.map(extend,series))
    last = max(q["rows"][0]["date"] for q in reviewed["queries"].values())
    sessions = calendars.get_calendar("XNYS").sessions_in_range(start.date(),last).strftime("%Y-%m-%d")
    frame = pd.DataFrame(series).reindex(sessions)
    assert frame.SPY.notna().all()
    output = {"source":"Yahoo Finance adjusted closes","layers":{}}
    roles = json.loads(subprocess.check_output(["node","--input-type=module","-e",
        "import {roles} from './stock-roles.mjs'; console.log(JSON.stringify(roles))"],cwd=CHART,text=True))
    # Columns are normalised to one at the join. The client matches them to the current snapshot.
    for key,g in reviewed["groups"].items():
        join = reviewed["queries"][key]["rows"][0]["date"]
        contextual = [r["symbol"] for r in roles if key in (r["main"],r.get("also"))]
        columns = list(dict.fromkeys(["SPY",*g["members"],*g["controls"],*contextual]))
        history = frame.loc[:join,columns].copy()
        for col,names in [("basket",g["members"]),("benchmark",g["controls"])]:
            subset = history[names]
            complete = subset.dropna().index
            if complete.empty:
                raise ValueError(f"No join for {key} {col}")
            eligible = subset.loc[complete[0]:]
            assert eligible.notna().all().all(), (key,col)
            eligible = eligible.copy()
            eligible.index = pd.to_datetime(eligible.index)
            wealth = basket(eligible)
            history.loc[complete,col] = wealth.to_numpy()
        normalized = history.div(history.iloc[-1]).iloc[:-1]
        output["layers"][key] = {"join":join,"dates":normalized.index.tolist(),
            "series":{col:[round(v,9) if pd.notna(v) else None for v in normalized[col]]
                      for col in normalized if normalized[col].notna().any()}}
    target = CHART / "chart-backfill.json"
    temp = target.with_suffix(".tmp")
    temp.write_text(json.dumps(output,separators=(",",":"),allow_nan=False),encoding="utf8")
    temp.replace(target)
    print("Verified",len(series),"price series and",len(output["layers"]),"layer joins")


if __name__ == "__main__":
    main()
