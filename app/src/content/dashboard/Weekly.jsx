import React from "react";
import {shortDate} from "./HistoryChart.jsx";

const signed=v=>(v>0?"+":"")+v.toFixed(2);
const tone=v=>v<0?"loss":v>0?"gain":"";
const byMagnitude=(a,b)=>Math.abs(b.points)-Math.abs(a.points);
const driverOf=w=>[...w.drivers].sort(byMagnitude)[0];
const commonNames={TSM:"TSMC",UMC:"United Microelectronics",NVDA:"Nvidia",AMD:"AMD",STM:"STMicroelectronics",NXPI:"NXP Semiconductors"};
export const stockName=(snapshot,s)=>commonNames[s]||snapshot.instruments[s].name;

export function WeekControl({period,onChange}){
  return <label className="choice">Review period<select aria-label="Review period" value={period} onChange={e=>onChange(Number(e.target.value))}>
    <option value={0}>This week</option><option value={1}>Previous week</option>
  </select></label>;
}

export function WeeklyMap({snapshot,period,onPeriod,onPick,onWatch}){
  const groups=Object.entries(snapshot.groups);
  const baskets=groups.filter(([,g])=>g.members.length>1);
  const ranked=[...baskets].sort((a,b)=>b[1].weeks[period].relative-a[1].weeks[period].relative);
  const w=ranked[0][1].weeks[period];
  const ahead=baskets.filter(([,g])=>g.weeks[period].relative>0).length;
  const changes=baskets.flatMap(([id,g])=>g.weeks[period].changes.map(e=>({...e,id,name:g.name})));
  const offsets=baskets.map(([id,g])=>{
    const week=g.weeks[period],sorted=[...week.drivers].sort((a,b)=>b.points-a.points);
    const positive=sorted.reduce((sum,d)=>sum+Math.max(0,d.points),0);
    const negative=sorted.reduce((sum,d)=>sum+Math.max(0,-d.points),0);
    return {id,g,week,best:sorted[0],worst:sorted.at(-1),offset:Math.min(positive,negative)};
  }).sort((a,b)=>b.offset-a.offset)[0];
  return <>
    <div className="mast"><div><div className="kicker">US-listed equities · 13 layers</div><h1>AI stack monitor</h1></div><WeekControl period={period} onChange={onPeriod}/></div>
    <a className="action" href="#heatmap">Explore the heatmap →</a> <button className="action" onClick={onWatch}>Open signal watchlist →</button>
    <a className="action" href="#outcomes">Historical signal returns →</a>
    <a className="action" href="#reversals">Weekly reversals →</a> <a className="action" href="#coverage">Stock and basket coverage →</a>
    <h2>Weekly review</h2>
    <p className="basis">{shortDate(w.start)} to {shortDate(w.end)} · {w.sessions} US sessions · USD adjusted closes, Yahoo Finance</p>
    <p className="week-lead"><b>{ahead} of {baskets.length} baskets</b> gained against their own benchmarks.</p>
    <div className="weekly-highlights">{[ranked[0],ranked.at(-1)].map(([id,g],i)=>{
      const week=g.weeks[period],driver=driverOf(week);
      return <button className="week-card" key={id} onClick={()=>onPick(id)}><small>{i===0?"Highest relative return":"Lowest relative return"}</small>
        <b>{g.name}</b><strong className={tone(week.relative)}>{signed(week.relative)}%</strong>
        <span>vs {g.label} · {week.ahead}/{g.members.length} ahead</span><span>{driver.symbol} contributed {signed(driver.points)} pp</span></button>;
    })}</div>
    {offsets.offset>0 && <div className="split-summary"><b>Largest offsetting contributions</b>
      <p>{offsets.g.name} returned {signed(offsets.week.relative)}% relative. {offsets.best.symbol} contributed {signed(offsets.best.points)} pp and {offsets.worst.symbol} {signed(offsets.worst.points)} pp.</p>
      <button className="action" onClick={()=>onPick(offsets.id)}>Inspect constituents</button></div>}
    <div className="week-events"><b>Signal changes</b>{changes.length?changes.map(e=><button key={[e.id,e.known,e.date,e.state].join("-")} onClick={()=>onPick(e.id,null,e.known+e.side,e.state!=="Observed")}>
      {e.name} · {e.side.toLowerCase()} divergence {e.state.toLowerCase()} · {shortDate(e.date)} ↗</button>):<span>No new or resolved divergences in the period.</span>}</div>
    <h2>Investor map</h2><p className="basis">Select a layer for weekly attribution and price history. The driver is the largest contribution by magnitude.</p>
    <div className="map-head map-grid" aria-hidden="true"><span>Layer / measured exposure</span><span>Relative return</span><span>Names ahead</span><span>Largest driver</span></div>
    <div className="map-body">{groups.map(([id,g],i)=>{
      const week=g.weeks[period],driver=driverOf(week),single=g.members.length===1;
      return <button className="map-row map-grid" key={id} data-layer={id} onClick={()=>onPick(id)}>
        <span className="map-identity"><small>L{i}</small><span><b>{g.title}</b><small>{single?"Single-stock reference · ":""}{g.name} vs {g.label}</small></span></span>
        <strong className={tone(week.relative)}>{signed(week.relative)}%</strong>
        <span className="map-part">{single?"Single name":week.ahead+" / "+g.members.length+" ahead"}</span>
        <span className="map-driver">{driver.symbol} <b className={tone(driver.points)}>{signed(driver.points)} pp</b></span>
      </button>;
    })}</div>
    <p className="basis">Each comparison uses its own opportunity cost. Foundation models have one diversified listed reference and are excluded from the basket count. Returns reflect all of each issuer’s businesses.</p>
  </>;
}

export function WeeklyDetail({snapshot,id,period,onPickStock,onPickEvent}){
  const g=snapshot.groups[id],w=g.weeks[period],single=g.members.length===1;
  return <section className="week-detail" data-reviewed-rows>
    <h3>{single?"Listed reference return":"Weekly return drivers"}</h3><p className="basis">{shortDate(w.start)} to {shortDate(w.end)} · {w.sessions} US sessions · Yahoo Finance</p>
    <div className="week-stats">{[["Absolute return",w.absolute],[g.label,w.benchmark],["Relative return",w.relative]].map(([label,v])=><div key={label}><small>{label}</small><b className={tone(v)}>{signed(v)}%</b></div>)}</div>
    {single?<p className="basis">{g.context}</p>:<>
      <div className="driver-grid driver-head"><span>Constituent</span><span>Stock return</span><span>Contribution</span></div>
      {[...w.drivers].sort(byMagnitude).map(d=><button className="driver-grid driver-row" key={d.symbol} onClick={()=>onPickStock(d.symbol)}><span><b>{d.symbol}</b><small>{stockName(snapshot,d.symbol)}</small></span><span>{signed(d.absolute)}%</span><b className={tone(d.points)}>{signed(d.points)} pp</b></button>)}
      <p className="basis">{w.ahead} of {g.members.length} names beat {g.label}. Contributions use daily portfolio weights and add to the relative return before rounding.</p>
      {w.changes.map(e=><button className="action" key={e.date+e.known+e.state} onClick={()=>onPickEvent(e.known+e.side,e.state!=="Observed")}>{e.side} divergence · {e.state} · {shortDate(e.date)}</button>)}</>}
  </section>;
}
