"""Publish the same two weekly reviews used on the investor map, with exchange-calendar checks."""
import json
import subprocess
from datetime import date, timedelta
from pathlib import Path

import exchange_calendars as xcals


def week_dates(close, calendar):
    # Python months are one-indexed. weekday() starts with Monday at zero.
    end = date.fromisoformat(close)
    friday = end + timedelta(days=4 - end.weekday())
    session = calendar.date_to_session(friday, direction="previous").date()
    return {"weekEnding": friday.isoformat(), "lastSession": session.isoformat(), "complete": end == session}


def main():
    root = Path(__file__).resolve().parents[1]
    javascript = """
      import fs from 'node:fs';
      import {weeklyBrief} from './app/src/content/dashboard/weekly-brief.mjs';
      const snapshot=JSON.parse(fs.readFileSync('app/src/data.json','utf8'));
      console.log(JSON.stringify({asOf:snapshot.asOf,weeks:[0,1].map(p=>weeklyBrief(snapshot,p))}));
    """
    brief = json.loads(subprocess.check_output(["node", "--input-type=module", "-e", javascript], cwd=root, encoding="utf-8"))
    calendar = xcals.get_calendar("XNYS")
    for week in brief["weeks"]:
        week.update(week_dates(week["end"], calendar))
        if len(week["rows"]) != 13 or week["total"] != 12:
            raise ValueError("Invalid weekly universe")
    if brief["weeks"][0]["end"] != brief["asOf"] or not brief["weeks"][1]["complete"]:
        raise ValueError("Weekly brief does not reconcile to the published close")
    (root / "docs/weekly-brief.json").write_text(json.dumps(brief, ensure_ascii=False), encoding="utf-8")


if __name__ == "__main__":
    main()
