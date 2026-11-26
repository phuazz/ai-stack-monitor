import React from "react";
import {shortDate} from "./HistoryChart.jsx";
import {weeklyBrief,pct,pp} from "./weekly-brief.mjs";

const tone=n=>n>0?"gain":n<0?"loss":"";
export default function InvestorMap({snapshot,period,control,onPick,onWatch}){
  const b=weeklyBrief(snapshot,period);
  const focus=b.focal,split=b.dispersion,news=b.news[0];
  const focusTitle=focus.change==="Rebounding"?"Strongest rebound":focus.change==="Turning down"?"Largest reversal down":"Relative leader";
  return <section className="pm-map">
    <header className="pm-header"><div><h1>AI investor map</h1><p className="basis">{shortDate(b.start)} – {shortDate(b.end)} · {b.sessions} US sessions · Yahoo Finance adjusted closes</p></div>{control}</header>
    <h2 className="pm-headline">{b.headline}</h2>
    <p className="pm-market">{b.marketRead}</p>
    <div className="pm-reads">
      <article><small>{focusTitle}</small><h3>{focus.name}</h3><p>{b.shiftRead}</p>
        <button onClick={()=>onPick(focus.id)}>See stock contributions →</button></article>
      <article><small>{split?"Largest offsetting stock moves":"Relative laggard"}</small><h3>{split?.name??b.lag.name}</h3><p>{b.dispersionRead??b.lagRead}</p>
        <button onClick={()=>onPick(split?.id??b.lag.id)}>See stock contributions →</button></article>
      <article><small>Fundamental question</small><h3>{focus.question}</h3>
        {news?<><p>{news.text}</p><a href={news.url} target="_blank" rel="noreferrer">{news.source} · {shortDate(news.published)} ↗</a></>:
          <p>Use the next operating update from {focus.name.toLowerCase()} to test the price signal.</p>}</article>
    </div>
    <h2>Where leadership shifted</h2>
    <p className="pm-market">{b.rebounds} of {b.total} baskets moved from lagging to beating their benchmarks. {b.turns} moved the other way.</p>
    <p className="basis pm-periods">Prior trend runs from the SPY closing high on {shortDate(b.peak)} to {shortDate(b.start)}, using the 252 sessions through the start of the week to find the high. Both relative columns use the benchmark under each basket.</p>
    <div className="pm-table-heading pm-columns"><span>Layer and benchmark</span><span>Prior trend</span><span>Week vs peers</span><span>Week in USD</span><span>Stocks ahead</span><span>Largest driver</span></div>
    {b.segments.map(segment=>{
      const rows=segment.ids.map(id=>b.rows.find(r=>r.id===id));
      const baskets=rows.filter(r=>r.count>1);
      return <section key={segment.name} className="pm-segment"><header><h3>{segment.name}</h3><span>{baskets.filter(r=>r.relative>0).length}/{baskets.length} baskets beat peers</span></header>
        <p>{segment.description}</p>
        {rows.map(r=><button type="button" className="pm-layer pm-columns" key={r.id} onClick={()=>onPick(r.id)} data-layer={r.id}>
          <span className="pm-layer-name"><b>L{r.index} · {r.name}</b><small>{r.count===1?"Single-stock reference · ":""}vs {r.benchmark}</small></span>
          <span data-label="Prior trend" className={tone(r.before)}>{r.before===null?"—":pct(r.before)}</span>
          <span data-label="Week vs peers" className={tone(r.relative)}><b>{pct(r.relative)}</b><small>{r.change}</small></span>
          <span data-label="Week in USD" className={tone(r.usd)}>{pct(r.usd)}</span>
          <span data-label="Stocks ahead">{r.count===1?"Single name":r.ahead+" of "+r.count}</span>
          <span data-label="Largest driver">{r.driver.symbol} <b className={tone(r.driver.points)}>{pp(r.driver.points)}</b></span>
        </button>)}</section>;
    })}
    <p className="basis">Foundation models use Meta as a single-stock reference. The headline counts each of the 12 multi-stock baskets once. Stock contributions are percentage points of the basket’s relative return. US-listed share prices reflect each company’s full business.</p>
    <details className="pm-signals"><summary>Signal changes this week ({b.rows.reduce((n,r)=>n+r.events.length,0)})</summary>
      {b.rows.flatMap(r=>r.events.map(e=><button key={[r.id,e.known,e.date,e.state].join("-")} onClick={()=>onPick(r.id,null,e.known+e.side,e.state!=="Observed")}>{r.name} · {e.side} divergence {e.state.toLowerCase()} · {shortDate(e.date)}</button>))}</details>
    <nav aria-label="More AI stack research"><a href="#heatmap">Heatmap</a><a href="#reversals">Weekly reversals</a><button onClick={onWatch}>Signal watchlist</button><a href="#outcomes">Historical signal returns</a><a href="#coverage">Stock coverage</a></nav>
  </section>;
}
