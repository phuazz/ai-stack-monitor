# AI stack monitor

[Open the heatmap](https://phuazz.github.io/ai-stack-monitor/) · [Refresh history](https://github.com/phuazz/ai-stack-monitor/actions/workflows/dashboard.yml) · [Published close and release identifier](https://phuazz.github.io/ai-stack-monitor/version.json)

The root URL opens a full-width, standalone heatmap of 13 AI layers. The investor map, weekly reversals, reference stocks, signal history, individual charts and PowerPoint exports are available from the dashboard. Prices are Yahoo Finance adjusted US closes. The price date appears above the heatmap. News and company disclosures carry their own dates.

GitHub Actions checks at 09:00 Singapore time Tuesday through Saturday, then hourly through 15:00. The runner uses the New York exchange calendar and a two-hour allowance after the close. A holiday or a current, verified release needs no new publication. Publishing a new close requires complete layer and reference coverage, independent return and attribution checks, and a browser test at 390, 844, 768 and 1280 px. After deployment, the workflow compares the live HTML with the tested build. A failed data or build check preserves the prior release. The GitHub job runs independently of the ChatGPT Site and the owner's computer.

## Local use

The navigation switches between English and Simplified Chinese without closing the current chart. The language applies to all six views and both PowerPoint image exports. [Open the Chinese heatmap](https://phuazz.github.io/ai-stack-monitor/?lang=zh-CN#heatmap). A language in a shared link takes precedence over the browser’s saved preference. The Chinese view uses the same prices, baskets, attribution and signal calculations as English.

The [investor map](https://phuazz.github.io/ai-stack-monitor/#map) groups the 13 layers by economic exposure. Each weekly review compares USD returns, returns versus SPY and returns versus each basket’s benchmark. The prior relative trend ends at the close where the review begins. Meta is a separate reference in the map. The weekly brief at `weekly-brief.json` carries the same figures for the two displayed weeks, with the NYSE final session and a completion flag. Its digest is published in `version.json`.

Use Node 24 and Python 3.12. Run `npm ci` and `npm run dev` for the standalone interface. Run `npm run build` to create `docs/index.html`. With Chrome installed, `npm run smoke` exercises the built page and its chart export.

Install `requirements.txt` and run `python scripts/refresh.py` to check the saved close or rebuild from market sources. Use a clean checkout for a refresh. The runner captures in its isolated checkout and stages only verified data. The core construction lives in `scripts/pipeline.py`. Reference history and longer chart histories are separate inputs. The **Run workflow** control supports a manual check and optional vendor revalidation.
