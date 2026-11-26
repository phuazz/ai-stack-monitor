"""Independently reconcile every observed index and test point-in-time event visibility."""
import json
from pathlib import Path

import numpy as np
import pandas as pd
import exchange_calendars as calendars

from pipeline import LAYERS, basket, divergences, weekly_attribution

ROOT = Path(__file__).resolve().parents[1]


def holdings_index(panel):
    shares = 1 / (len(panel.columns) * panel.iloc[0].to_numpy())
    wealth = []
    for i, prices in enumerate(panel.to_numpy()):
        value = float(prices @ shares)
        wealth.append(value)
        # Python calendar months are 1-indexed. Set new units at the last observed monthly close.
        if i+1 < len(panel) and panel.index[i].month != panel.index[i+1].month:
            shares = value / (len(prices) * prices)
    return np.array(wealth)


def verify_week(week, prices, control_prices):
    """Reconcile relative P&L from actual units held and benchmark currency growth."""
    bench = pd.Series(holdings_index(control_prices), index=prices.index)
    first, last = pd.Timestamp(week["start"]), pd.Timestamp(week["end"])
    left, right = prices.index.get_loc(first), prices.index.get_loc(last)
    assert right-left == week["sessions"]
    assert first.to_period("W-FRI") < last.to_period("W-FRI")
    assert all(d.to_period("W-FRI")==last.to_period("W-FRI") for d in prices.index[left+1:right+1])
    units = 1 / (len(prices.columns)*prices.iloc[0])
    contributions = pd.Series(0.0,index=prices.columns)
    initial_nav = None
    for i in range(1,right+1):
        current, prior = prices.iloc[i], prices.iloc[i-1]
        capital = units*prior
        if prices.index[i].to_period("M") != prices.index[i-1].to_period("M"):
            capital[:] = capital.sum()/len(capital)
            units = capital/prior
        if i == left+1:
            initial_nav = capital.sum()
        if i>left:
            profit = units*(current-prior)
            opportunity_cost = capital*(bench.iloc[i]/bench.iloc[i-1]-1)
            contributions += (profit-opportunity_cost)/initial_nav*bench.iloc[left]/bench.iloc[i]*100
    rows={row["symbol"]:row for row in week["drivers"]}
    assert set(rows)==set(prices.columns)
    for symbol,value in contributions.items():
        np.testing.assert_allclose(value,rows[symbol]["points"],atol=1e-9)
        np.testing.assert_allclose((prices.iloc[right][symbol]/prices.iloc[left][symbol]-1)*100,
                                   rows[symbol]["absolute"],atol=1e-9)
    np.testing.assert_allclose(contributions.sum(), week["relative"],atol=1e-9)
    assert week["ahead"] == sum(row["absolute"]>week["benchmark"] for row in rows.values())


for start in ("2024-01-30", "2024-12-30"):
    test = pd.DataFrame({"a":[100,115,200,200,150],"b":[100,95,90,88,130]},
                        index=pd.date_range(start, periods=5))
    np.testing.assert_allclose(basket(test), holdings_index(test))

for start in ("2024-01-19", "2024-12-20"):
    dates=pd.bdate_range(start,periods=12)
    sample=pd.DataFrame({"a":100+np.arange(12)**1.4,"b":80-np.arange(12)},index=dates)
    control=sample[["a"]]
    for week in weekly_attribution(sample,basket(sample),basket(control),[]):
        verify_week(week,sample,control)

capture = json.loads((ROOT / "data/prices.json").read_text())
published = json.loads((ROOT / "app/src/data.json").read_text(encoding="utf-8-sig"))
expected = calendars.get_calendar("XNYS").date_to_session(pd.Timestamp(capture["endExclusive"])-pd.Timedelta(days=1), direction="previous")
assert published["asOf"] == expected.date().isoformat()
for key, (_, names, controls, _) in LAYERS.items():
    rows = pd.DataFrame(published["queries"][key]["rows"]).set_index("date")
    rows.index = pd.to_datetime(rows.index)
    panel = pd.DataFrame({s: capture["series"][s]["prices"] for s in names+controls})
    panel.index = pd.to_datetime(panel.index)
    panel = panel.loc[rows.index]
    for week in published["groups"][key]["weeks"]:
        verify_week(week,panel[names],panel[controls])
    for group, column in [(names,"basket"),(controls,"benchmark")]:
        np.testing.assert_allclose(holdings_index(panel[group]),rows[column],rtol=1e-10)
    for symbol in (names if len(names)>1 else []):
        peers = holdings_index(panel[[s for s in names if s != symbol]])
        np.testing.assert_allclose(rows[symbol+"_peer"], peers)
        np.testing.assert_allclose(rows[symbol+"_relative"], panel[symbol]/panel[symbol].iloc[0]/peers)
    ratios = panel[names].div(holdings_index(panel[controls]),axis=0).to_numpy()
    for i in range(19,len(rows)):
        last20 = ratios[i-19:i+1]
        assert sum(ratios[i] <= last20.min(axis=0)) == rows.lows.iloc[i]
        assert sum(ratios[i] >= last20.max(axis=0)) == rows.highs.iloc[i]
        if i>=21:
            assert sum(ratios[i] > ratios[i-21]) == rows.winners.iloc[i]
    # With benchmark-denominated stock prices, held units times price changes
    # reconcile independently to each stock's relative contribution across any pivot pair.
    member_prices = panel[names].to_numpy()
    basket_nav = holdings_index(panel[names])
    control_nav = holdings_index(panel[controls])
    from collections import Counter
    forward = [r for r in published["forwardReturns"] if r["layer"]==key]
    events = published["groups"][key]["events"]
    expected_keys = {(e["known"],e["side"],stage,h,lag)
                     for e in events for stage in (["observed","confirmed"] if e["status"]=="Confirmed" else ["observed"])
                     for h in [5,21,63] for lag in [0,1]}
    actual = Counter((r["observed"],r["side"],r["stage"],r["horizon"],r["lag"]) for r in forward)
    assert set(actual)==expected_keys and all(v==1 for v in actual.values())
    anchors={(e["known"],e["side"]):e for e in events}
    for r in forward:
        e=anchors[r["observed"],r["side"]]
        anchor=e["known"] if r["stage"]=="observed" else e["resolution"]
        a=rows.index.get_loc(pd.Timestamp(anchor))
        i,j=a+r["lag"],a+r["lag"]+r["horizon"]
        assert r["anchor"]==anchor
        assert r["policyMature"]==(rows.index.get_loc(pd.Timestamp(e["known"]))+42+r["lag"]+r["horizon"]<len(rows))
        assert r["entry"]==(rows.index[i].date().isoformat() if i<len(rows) else None)
        if j>=len(rows):
            assert r["end"] is None and r["value"] is None and r["normal"] is None
            continue
        assert r["end"]==rows.index[j].date().isoformat()
        direct=(basket_nav[j]/basket_nav[i])/(control_nav[j]/control_nav[i])-1
        np.testing.assert_allclose(100*direct,r["value"],atol=1e-8)
        available=np.arange(23,len(rows)-r["lag"]-r["horizon"])
        starts=available[rows.index[available].year==rows.index[a].year]+r["lag"]
        ends=starts+r["horizon"]
        normal=100*((basket_nav[ends]/basket_nav[starts])/(control_nav[ends]/control_nav[starts])-1)
        np.testing.assert_allclose(normal.mean(),r["normal"],atol=1e-8)
    units = 1 / (len(names)*member_prices[0])
    daily_profit = np.zeros_like(member_prices)
    for i in range(1,len(rows)):
        if rows.index[i].to_period("M") != rows.index[i-1].to_period("M"):
            units = basket_nav[i-1] / (len(names)*member_prices[i-1])
        daily_profit[i] = units * (ratios[i] - ratios[i-1])
    # Reproduce the information available a session before and at first observation.
    for event in published["groups"][key]["events"]:
        j = rows.index.get_loc(pd.Timestamp(event["known"]))
        first = rows.index.get_loc(pd.Timestamp(event["first"]))
        pivot = j-2
        bullish = event["side"]=="Bullish"
        extremum = np.min if bullish else np.max
        assert list(names)==[d["symbol"] for d in event["drivers"]]
        for idx, field in [(first,"first"),(pivot,"pivot")]:
            mask=ratios[idx]==extremum(ratios[idx-19:idx+1],axis=0)
            assert mask.tolist()==[d[field] for d in event["drivers"]]
            assert mask.sum()==event["firstCount" if field=="first" else "secondCount"]
        points=daily_profit[first+1:pivot+1].sum(axis=0)*100*control_nav[first]/basket_nav[first]
        np.testing.assert_allclose(points,[d["points"] for d in event["drivers"]],atol=1e-8)
        raw_ratio=basket_nav/control_nav
        trigger=(max if bullish else min)(raw_ratio[first:pivot+1])
        np.testing.assert_allclose([trigger,raw_ratio[pivot]],[event["trigger"],event["boundary"]])
        # Use vendor-series precision at the boundary to avoid round-off on exact retests.
        direction=1 if bullish else -1
        confirmed=direction*(raw_ratio[j:j+43]-trigger)>1e-12
        invalid=direction*(raw_ratio[j:j+43]-raw_ratio[pivot]) < -1e-12
        exits=np.flatnonzero(confirmed|invalid)
        if len(exits):
            n=exits[0]
            result=("Confirmed" if confirmed[n] else "Invalidated", rows.index[j+n].date().isoformat())
        elif j+42<len(rows):
            result=("Expired", rows.index[j+42].date().isoformat())
        else:
            result=("Watching",None)
        assert result==(event["status"],event["resolution"]), (key,event["known"],result)
        assert rows.index[j-2] == pd.Timestamp(event["pivot"])
        for length in (j,j+1):
            events = divergences(rows.ratio.iloc[:length],rows.lows.iloc[:length],rows.highs.iloc[:length])
            seen = [e for e in events if (e["known"],e["side"]) == (event["known"],event["side"])]
            assert bool(seen) == (length == j+1)
            if seen and event["resolution"] != event["known"]:
                assert seen[0]["status"] == "Watching"
    print(key, len(rows), "rows reconciled,", len(published["groups"][key]["events"]), "event replays passed")
assert len(published["groups"])==13
assert len(published["groups"]["models"]["members"])==1 and not published["groups"]["models"]["events"]
