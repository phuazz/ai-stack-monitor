"""Build the reviewed dashboard snapshot from a captured adjusted-close panel."""
import json
from pathlib import Path

import exchange_calendars as calendars
import numpy as np
import pandas as pd
from universe import LAYERS, MAP
from forward_returns import event_study

ROOT = Path(__file__).resolve().parents[1]


def basket(frame):
    """Reset weights at the preceding month-end close, then let them drift."""
    returns = frame.pct_change(fill_method=None).iloc[1:]
    months = returns.index.to_period("M")
    legs = (1 + returns).groupby(months).cumprod().mean(axis=1)
    change = legs.groupby(months).pct_change().fillna(legs - 1)
    wealth = (1 + change).cumprod()
    return pd.concat([pd.Series([1.0], index=frame.index[:1]), wealth])


def divergences(ratio, low_counts, high_counts):
    events = []
    values = ratio.to_numpy()
    for bullish, side, counts in [(True, "Bullish", low_counts), (False, "Bearish", high_counts)]:
        # Multiplication makes bearish highs behave symmetrically to bullish lows.
        v = values if bullish else -values
        previous = None
        for pivot in range(2, len(v) - 2):
            if not all(v[pivot] < v[j] for j in (pivot-2, pivot-1, pivot+1, pivot+2)):
                continue
            first, previous = previous, pivot
            if first is None or pd.isna(counts.iloc[first]) or v[pivot] >= v[first]:
                continue
            if counts.iloc[pivot] >= counts.iloc[first]:
                continue
            known = pivot + 2
            trigger = v[first:pivot + 1].max()
            status, resolution = "Watching", None
            for j in range(known, min(known + 43, len(v))):
                if v[j] > trigger:
                    status, resolution = "Confirmed", j
                    break
                if v[j] < v[pivot]:
                    status, resolution = "Invalidated", j
                    break
                if j == known + 42:
                    status, resolution = "Expired", j
            dates = ratio.index.strftime("%Y-%m-%d")
            events.append(dict(side=side, first=dates[first], pivot=dates[pivot], known=dates[known],
                               firstCount=int(counts.iloc[first]), secondCount=int(counts.iloc[pivot]),
                               trigger=float(trigger if bullish else -trigger), boundary=float(values[pivot]),
                               status=status, resolution=None if resolution is None else dates[resolution]))
    return sorted(events, key=lambda e: e["known"], reverse=True)


def daily_contributions(frame, benchmark):
    """Return each stock's contribution to the daily change in relative wealth."""
    daily = frame.pct_change(fill_method=None).iloc[1:]
    months = daily.index.to_period("M")
    through_yesterday = (1 + daily).groupby(months).cumprod().groupby(months).shift().fillna(1)
    weights = through_yesterday.div(through_yesterday.sum(axis=1), axis=0)
    bench_ret = benchmark.pct_change(fill_method=None).loc[daily.index]
    return weights.mul(daily.sub(bench_ret, axis=0)).div(1 + bench_ret, axis=0)


def contributions_between(active, ratio, base, end):
    window = active.index[(active.index > base) & (active.index <= end)]
    link = ratio.shift(1).loc[window] / ratio.loc[base]
    result = active.loc[window].mul(link, axis=0).sum() * 100
    np.testing.assert_allclose(result.sum(), 100*(ratio.loc[end]/ratio.loc[base]-1), atol=1e-8)
    return result


def attach_signal_drivers(events, relative, low, high, active, ratio):
    for event in events:
        first, pivot = pd.Timestamp(event["first"]), pd.Timestamp(event["pivot"])
        extremes = low if event["side"] == "Bullish" else high
        points = contributions_between(active, ratio, first, pivot)
        event["drivers"] = [
            dict(symbol=s, first=bool(relative.at[first,s] == extremes.at[first,s]),
                 pivot=bool(relative.at[pivot,s] == extremes.at[pivot,s]), points=points[s])
            for s in points.index
        ]


def weekly_attribution(frame, numerator, benchmark, events, active=None):
    if active is None:
        active = daily_contributions(frame, benchmark)
    ratio = numerator / benchmark
    weeks = active.index.to_period("W-FRI")
    result = []
    for week in weeks.unique()[-2:][::-1]:
        window = active.index[weeks == week]
        base = frame.index[frame.index.get_loc(window[0])-1]
        end = window[-1]
        contrib = contributions_between(active, ratio, base, end)
        stock_returns = (frame.loc[end]/frame.loc[base]-1)*100
        absolute = 100*(numerator.loc[end]/numerator.loc[base]-1)
        passive = 100*(benchmark.loc[end]/benchmark.loc[base]-1)
        rel = 100*(ratio.loc[end]/ratio.loc[base]-1)
        np.testing.assert_allclose(contrib.sum(), rel, atol=1e-8)
        start_date, end_date = base.date().isoformat(), end.date().isoformat()
        changes = []
        for event in events:
            for date, state in [(event["known"], "Observed"), (event["resolution"],event["status"])]:
                if date and start_date < date <= end_date:
                    changes.append(dict(date=date,state=state,side=event["side"],known=event["known"]))
        result.append(dict(start=start_date,end=end_date,sessions=len(window),absolute=absolute,
                           benchmark=passive,relative=rel,ahead=int((stock_returns>passive).sum()),
                           drivers=[dict(symbol=s,points=contrib[s],absolute=stock_returns[s]) for s in contrib.index],
                           changes=sorted(changes,key=lambda item:item["date"])))
    return result


def build(raw):
    series = raw["series"]
    prices = pd.DataFrame({s: v["prices"] for s, v in series.items()}).sort_index()
    prices.index = pd.to_datetime(prices.index)
    sessions = calendars.get_calendar("XNYS").sessions_in_range(prices.index[0], prices.index[-1])
    assert list(prices.index.strftime("%F")) == list(sessions.strftime("%F")), "Missing market session"
    latest = prices.index[-1].date().isoformat()
    assert prices["SPY"].notna().all() and (prices["SPY"]>0).all(), "Incomplete market anchor"
    queries, groups = {}, {}
    for key, (name, members, controls, label) in LAYERS.items():
        all_names = members + controls
        panel = prices[all_names]
        panel = panel.loc[max(panel[s].first_valid_index() for s in all_names):]
        assert np.isfinite(panel.values).all() and (panel > 0).all().all()
        numerator, denominator = basket(panel[members]), basket(panel[controls])
        ratio = numerator / denominator
        relative = panel[members].div(denominator, axis=0)
        low, high = relative.rolling(20).min(), relative.rolling(20).max()
        lows = relative.eq(low).sum(axis=1).where(low.notna().all(axis=1))
        highs = relative.eq(high).sum(axis=1).where(high.notna().all(axis=1))
        outperform = relative.pct_change(21, fill_method=None)
        rows = pd.DataFrame(dict(basket=numerator, benchmark=denominator, ratio=ratio,
                                 lows=lows, highs=highs, winners=(outperform > 0).sum(axis=1).where(outperform.notna().all(axis=1))))
        for symbol in all_names:
            rows[symbol] = panel[symbol]
        for symbol in (members if len(members)>1 else []):
            peer = basket(panel[[s for s in members if s != symbol]])
            rows[symbol + "_peer"] = peer
            rows[symbol + "_relative"] = (panel[symbol] / panel[symbol].iloc[0]) / peer
        rows.insert(0, "date", panel.index.strftime("%Y-%m-%d"))
        query = dict(id=key, title=name, rows=json.loads(rows.to_json(orient="records", double_precision=12)),
                     source=dict(provider="Yahoo Finance", title="USD adjusted daily closes", updatedAt=latest,
                                 description="USD adjusted closes from Yahoo Finance. Listing identities checked against Nasdaq Trader.",
                                 evidenceFlow=[dict(title=s, detail=series[s]["url"]) for s in all_names]),
                     methods=[dict(language="text", code="scripts/pipeline.py builds monthly equal-weight indices, ratios, participation and confirmed-pivot observations from data/prices.json.")])
        queries[key] = query
        events = divergences(ratio,lows,highs) if len(members)>1 else []
        active = daily_contributions(panel[members], denominator)
        attach_signal_drivers(events, relative, low, high, active, ratio)
        groups[key] = dict(**MAP[key], events=events,
                           weeks=weekly_attribution(panel[members],numerator,denominator,events,active))
    return dict(title="AI stack monitor", status="reviewed", buildStatus="complete", filters=[],
                updatedAt=raw["retrieved"], asOf=latest, queries=queries, groups=groups,
                forwardReturns=event_study(queries,groups),
                marketCloses=series["SPY"]["prices"],
                instruments={s: {k:v for k,v in item.items() if k != "prices"} for s,item in series.items()})


if __name__ == "__main__":
    snapshot = build(json.loads((ROOT / "data/prices.json").read_text()))
    target = ROOT / ("app/src/data.json" if (ROOT / "app").is_dir() else "data/snapshot.json")
    if target.exists() and target.parent.name == "src":
        original = json.loads(target.read_text(encoding="utf-8-sig"))
        for key in ("id", "surface", "exportPreferences"):
            snapshot[key] = original[key]
    temp = target.with_suffix(".tmp")
    temp.write_text(json.dumps(snapshot, separators=(",", ":"), allow_nan=False), encoding="utf-8")
    temp.replace(target)
    for key, group in snapshot["groups"].items():
        print(key, len(snapshot["queries"][key]["rows"]), len(group["events"]), group["events"][:1])
