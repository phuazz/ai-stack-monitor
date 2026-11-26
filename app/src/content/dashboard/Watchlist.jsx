import DashboardNav from "./DashboardNav.jsx";
import React, {useState} from "react";
import {shortDate} from "./HistoryChart.jsx";
import {WeekControl,stockName} from "./Weekly.jsx";

const titleFor = side => side === "Bullish" ? "Bullish divergence" : "Relative exhaustion";
const signed = value => (value > 0 ? "+" : "") + value.toFixed(2);
const signalId = item => [item.id,item.event.known,item.event.side].join("/");

function Signal({item,snapshot,end,onPick}) {
  const {id,g,event:e}=item;
  const bull=e.side==="Bullish", extreme=bull?"low":"high";
  const closed=Boolean(e.resolution && e.resolution<=end);
  const date=closed?e.resolution:end;
  const rows=snapshot.queries[id].rows;
  const i=rows.findIndex(row=>row.date===date);
  const age=i-rows.findIndex(row=>row.date===e.known);
  const ratio=rows[i].ratio;
  const drivers=[...e.drivers].sort((a,b)=>Math.abs(b.points)-Math.abs(a.points));
  const name=d=>({ESTC:"Elastic",SNOW:"Snowflake",MDB:"MongoDB"}[d.symbol]||stockName(snapshot,d.symbol).replace(/,? (Inc\.?|Corporation|Corp\.?|plc|Ltd\.?).*$/i,""));
  const names=list=>new Intl.ListFormat("en-GB",{style:"long",type:"conjunction"}).format(list.map(name));
  const earlier=drivers.filter(d=>d.first), later=drivers.filter(d=>d.pivot);
  const knownRatio=rows.find(row=>row.date===e.known).ratio;
  const history=snapshot.forwardReturns.filter(r=>r.layer===id && r.side===e.side &&
    r.stage==="observed" && r.lag===1 && r.horizon===21 && r.observed<e.known && r.end && r.end<=date);
  const historicalMean=history.length?history.reduce((sum,r)=>sum+r.value,0)/history.length:null;
  const eventId=e.known+e.side;
  function level(label,threshold,above) {
    const gap=100*(threshold/(closed?knownRatio:ratio)-1);
    return <div><small>{label}</small><strong>{closed && ((above && gap<0)||(!above && gap>0))?"Already crossed":(above?"Gain over ":"Lose over ")+Math.abs(gap).toFixed(2)+"%"}</strong></div>;
  }
  return <section className="watch-card" data-reviewed-rows data-event={signalId(item)}>
    <div className="watch-heading"><div><small>{titleFor(e.side)}</small><h3>{g.name} · {bull?"weakness narrowed":"leadership narrowed"}</h3></div>
      <b className="watch-state">{closed?e.status:"Watching"}</b></div>
    <p className="basis">Flagged {shortDate(e.known)} · {closed?e.status+" "+shortDate(date):"awaiting confirmation"}</p>
    <p>{g.name} {bull?"fell further behind":"pulled further ahead of"} {g.label}. <b>{later.length===0?"No stock":later.length===1?"Only "+names(later):names(later)}</b> reached a fresh 20-session {extreme} against the benchmark. At the previous {extreme}, {names(earlier)} did so.</p>
    <p className="basis">Relative move needed at a daily close, measured from {shortDate(closed?e.known:date)}</p>
    <div className="watch-levels">{level("To confirm",e.trigger,bull)}{level("To cancel",e.boundary,!bull)}</div>
    <p className="watch-history">{history.length?<><b>{history.length} earlier {history.length===1?"flag":"flags"} in this basket.</b> Average relative return over the next 21 sessions, measured from the following close, was <b>{signed(historicalMean)}%</b>.</>:"No earlier flag of this type in this basket had a complete 21-session result by this close."} <a href={bull?"#outcomes":"#outcomes-exhaustion"}>Compare past outcomes →</a></p>
    <details className="watch-drivers"><summary>What each stock contributed</summary>
      <p>{name(drivers[0])} had the largest impact, contributing {signed(drivers[0].points)} percentage points to the basket’s relative return.</p>
      <p className="basis">{shortDate(e.first)} to {shortDate(e.pivot)} · relative return contribution in percentage points · select a name for its chart at first observation</p>
      <table><thead><tr><th>Stock</th><th>First {extreme}</th><th>Second {extreme}</th><th>Contribution</th></tr></thead>
        <tbody>{drivers.map(d=><tr key={d.symbol}><td><button className="action" onClick={()=>onPick(id,d.symbol,eventId)}>{d.symbol}</button></td>
          <td>{d.first?"Yes":"No"}</td><td>{d.pivot?"Yes":"No"}</td><td>{signed(d.points)} pp</td></tr>)}</tbody>
      </table>
      <p className="basis">Exact basket / benchmark closing levels · confirm {bull?"above":"below"} {e.trigger.toFixed(5)} · cancel {bull?"below":"above"} {e.boundary.toFixed(5)}. Ratio {ratio.toFixed(5)} on {shortDate(date)}. {!closed && (42-age)+" sessions remaining."} Yahoo Finance adjusted closes.</p></details>
    <button className="action watch-replay" onClick={()=>onPick(id,null,eventId,closed)}>View {closed?"resolution":"first observation"} on chart →</button>
  </section>;
}

export default function Watchlist({snapshot,period,onPeriod,onPick}) {
  const [layer,setLayer]=useState("all"),[side,setSide]=useState("all"),[archiveId,setArchiveId]=useState("");
  const groups=Object.entries(snapshot.groups);
  const {start,end}=groups[0][1].weeks[period];
  const eligible=groups.filter(([,g])=>g.members.length>1);
  const all=eligible.flatMap(([id,g])=>g.events.filter(e=>e.known<=end).map(event=>({id,g,event})));
  const open=item=>!item.event.resolution||item.event.resolution>end;
  const filtered=all.filter(item=>(layer==="all"||item.id===layer)&&(side==="all"||side===item.event.side));
  const watching=filtered.filter(open).sort((a,b)=>b.event.known.localeCompare(a.event.known));
  const closed=filtered.filter(item=>!open(item)).sort((a,b)=>b.event.resolution.localeCompare(a.event.resolution));
  const recent=closed.filter(item=>item.event.resolution>start);
  const archived=closed.find(item=>signalId(item)===archiveId);
  const reference=layer!=="all" && snapshot.groups[layer].members.length===1;
  const count=kind=>watching.filter(item=>item.event.side===kind).length;
  const card=item=><Signal key={signalId(item)} item={item} snapshot={snapshot} end={end} onPick={onPick}/>;
  return <>
    <DashboardNav active="watchlist"/>
    <div className="mast"><h1>Signal watchlist</h1><WeekControl period={period} onChange={v=>{setArchiveId("");onPeriod(v)}}/></div>

    <p className="basis">US close {shortDate(end)} · 12 breadth baskets across 13 layers · Yahoo Finance adjusted closes</p>
    <div className="selectors"><label className="choice">Layer<select aria-label="Layer" value={layer} onChange={e=>{setLayer(e.target.value);setArchiveId("")}}>
      <option value="all">All 13 layers</option>{groups.map(([id,g],i)=><option key={id} value={id}>L{i} · {g.title} · {g.members.length===1?"single reference":all.filter(item=>item.id===id&&open(item)).length+" open"}</option>)}
    </select></label><label className="choice">Signal type<select aria-label="Signal type" value={side} onChange={e=>{setSide(e.target.value);setArchiveId("")}}>
      <option value="all">Both signals</option><option value="Bullish">Bullish divergence</option><option value="Bearish">Relative exhaustion</option></select></label></div>
    {reference?<p className="week-lead">Foundation models have one listed reference, Meta. Breadth requires multiple constituents. <button className="action" onClick={()=>onPick(layer)}>Open reference chart →</button></p>:<>
      <h2>Open watches</h2><p className="watch-lead">{count("Bullish")} bullish divergence · {count("Bearish")} relative exhaustion</p>
      {watching.length?<div className="watch-grid">{watching.map(card)}</div>:<p>No open signals for this selection at the review close.</p>}
      <h2>Resolved this week</h2><p className="basis">After the {shortDate(start)} close through {shortDate(end)}</p>
      {recent.length?<div className="watch-grid">{recent.map(card)}</div>:<p>No confirmations, invalidations or expiries for this selection during the week.</p>}
      {closed.length>0 && <div className="watch-archive"><label className="choice">Resolved signal history<select aria-label="Resolved signal history" value={archiveId} onChange={e=>setArchiveId(e.target.value)}>
        <option value="">Select a past signal</option>{closed.map(item=><option key={signalId(item)} value={signalId(item)}>{shortDate(item.event.resolution)} · {item.g.name} · {titleFor(item.event.side)} · {item.event.status} (observed {shortDate(item.event.known)})</option>)}
      </select></label>{archived&&card(archived)}</div>}
    </>}
    <details className="methods"><summary>Watch rules and driver attribution</summary>
      <p>Relative exhaustion flags a higher basket-to-benchmark pivot high with fewer stocks at 20-session relative highs. Bullish divergence flags a lower pivot low with fewer stocks at relative lows. Both use strict closing pivots with two sessions on each side. The watch starts at the second subsequent close.</p>
      <p>Confirmation requires a close beyond the intervening swing, down for exhaustion and up for bullish divergence. A close beyond the second pivot in the opposite direction invalidates the watch. Equality leaves it open. After 42 further sessions, an unresolved watch expires. Comparisons use unrounded ratios.</p>
      <p>Breadth counts names equally. Return contributions use the actual drifting basket weights from the first pivot close through the second. Each stock is compared with the same layer benchmark. The historical roster is fixed. Thin baskets can change breadth by a single name.</p>
    </details></>;
}
