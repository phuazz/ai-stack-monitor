"""Forward wealth-ratio returns for observable, unchanged breadth flags."""
from collections import defaultdict
from datetime import date
from statistics import fmean, median

HORIZONS = (5, 21, 63)
STAGES = ("observed", "confirmed")


def event_study(queries, groups):
    """Summarise completed windows; match the normal return to layer and anchor year."""
    output = []
    for layer, group in groups.items():
        rows = queries[layer]["rows"]
        lookup = {r["date"]: i for i, r in enumerate(rows)}
        dates = [r["date"] for r in rows]
        # Python months are one-indexed. Years refer to the signal or confirmation close.
        years = [date.fromisoformat(d).year for d in dates]
        ratios = [r["basket"]/r["benchmark"] for r in rows]
        for lag in (0, 1):
            for horizon in HORIZONS:
                fwd = {i: 100*(ratios[i+lag+horizon]/ratios[i+lag]-1)
                       for i in range(23,len(rows)-lag-horizon)}
                periods = defaultdict(list)
                for i, value in fwd.items():
                    periods[years[i]].append(value)
                normal = {year:fmean(values) for year,values in periods.items()}
                for event in group["events"]:
                    anchors = [("observed",event["known"])]
                    if event["status"] == "Confirmed":
                        anchors.append(("confirmed",event["resolution"]))
                    for stage, anchor in anchors:
                        i = lookup[anchor]
                        entry, end = i+lag, i+lag+horizon
                        output.append(dict(layer=layer,side=event["side"],stage=stage,
                            observed=event["known"],anchor=anchor,lag=lag,horizon=horizon,
                            policyMature=lookup[event["known"]]+42+lag+horizon<len(rows),
                            entry=dates[entry] if entry<len(rows) else None,
                            end=dates[end] if end<len(rows) else None,
                            value=fwd.get(i),normal=normal.get(years[i]) if i in fwd else None))
    return output


def summary(records):
    completed = [r for r in records if r["value"] is not None]
    if not completed:
        return dict(n=0,total=len(records))
    values = [r["value"] for r in completed]
    hits = sum(r["value"]*(1 if r["side"]=="Bullish" else -1)>0 for r in completed)
    return dict(n=len(values),total=len(records),mean=fmean(values),median=median(values),
                normal=fmean(r["normal"] for r in completed),hits=hits)
