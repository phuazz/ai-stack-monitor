import React,{useState} from "react";
import {leading,periodDrivers,periods} from "./heatmap-data.mjs";
import {shortDate} from "./HistoryChart.jsx";
import {stockName} from "./Weekly.jsx";
import Newsflow from "./Newsflow.jsx";

const signed=n=>(n>0?"+":"")+n.toFixed(2);
const range=(a,b)=>shortDate(a)+" – "+shortDate(b);
const comparisons={wtd:"Week to date",preweek:"Market high to start of week",peak:"Since market high",none:"No comparison"};
function driverCell(d){
  return d?<><strong className={d.points<0?"loss":d.points>0?"gain":""}>{signed(d.points)} pp</strong>
    <small>Stock {signed(d.stockReturn)}%</small></>:"—";
}

export function SignalDrivers({snapshot,id,side,stage,events,onBack}){
  const [eventId,setEventId]=useState("");
  const g=snapshot.groups[id],which=events.find(e=>e.observed===eventId);
  const included=which?[which]:events;
  if(!included.length)return null;
  const totals=Object.fromEntries(g.members.map(s=>[s,0]));
  for(const e of included){
    const window=periodDrivers(g,snapshot.queries[id].rows,e.entry,e.end,snapshot.marketCloses,"own");
    for(const d of window.drivers)totals[d.symbol]+=d.points/included.length;
  }
  const mean=included.reduce((sum,e)=>sum+e.value,0)/included.length;
  return <section id="signal-drivers" className="heat-drivers" tabIndex="-1">
    <div className="watch-heading"><div><small>{g.name} vs {g.label} · {side==="Bullish"?"bullish divergence":"relative exhaustion"} · {stage==="confirmed"?"after confirmation":"first flag"}</small>
      <h3>What drove the forward return?</h3></div><button className="action" onClick={onBack}>Back to heatmap</button></div>
    <label className="choice">Forward return window<select aria-label="Forward return window" value={which?eventId:""} onChange={e=>setEventId(e.target.value)}>
      <option value="">Average of {events.length} completed windows</option>{events.map(e=><option key={e.observed} value={e.observed}>{range(e.entry,e.end)} · flag {shortDate(e.observed)}</option>)}</select></label>
    <p>{which?range(which.entry,which.end):"Each completed forward window has equal weight."} Basket return {signed(mean)}% versus {g.label}.</p>
    <table className="heat-driver-table"><thead><tr><th>Constituent</th><th>{which?"Contribution":"Mean contribution"}</th></tr></thead>
      <tbody>{Object.entries(totals).sort((a,b)=>Math.abs(b[1])-Math.abs(a[1])).map(([s,v])=><tr key={s}><th>{s}<small>{stockName(snapshot,s)}</small></th><td>{signed(v)} pp</td></tr>)}</tbody></table>
    <small>Yahoo Finance adjusted closes · next-close entry · monthly basket rebalancing</small></section>;
}
export default function HeatDrivers({snapshot,id,period,start,end,peak,week,basis,onBack,onStock}){
  const [choice,setChoice]=useState("");
  const g=snapshot.groups[id],rows=snapshot.queries[id].rows,market=snapshot.marketCloses;
  const current=periodDrivers(g,rows,start,end,market,basis);
  const intervals={wtd:[week,end],preweek:[peak,week],peak:[peak,end]};
  const options=Object.entries(comparisons).filter(([key])=>key==="none"||
    (intervals[key][0] && intervals[key][1] && intervals[key][0]<intervals[key][1] &&
      !(intervals[key][0]===start && intervals[key][1]===end)));
  const compare=options.some(([key])=>key===choice)?choice:options[0][0];
  const otherDates=intervals[compare];
  const other=otherDates && periodDrivers(g,rows,...otherDates,market,basis);
  const control=basis==="absolute"?"absolute basket return":basis==="market"?"return versus SPY":"return versus "+g.label;
  const lead=leading(current),second=leading(other);
  if(!current)return <section className="heat-drivers" id="heat-drivers" tabIndex="-1"><h3>{g.name}</h3><p>This basket has no common price history for the selected interval.</p><button className="action" onClick={onBack}>Back to heatmap</button></section>;
  const ordered=[...current.drivers].sort((a,b)=>Math.abs(b.points)-Math.abs(a.points));
  return <section className="heat-drivers" id="heat-drivers" tabIndex="-1" aria-labelledby="heat-driver-title" data-reviewed-rows>
    <div className="watch-heading"><div><small>{g.name} · {control}</small><h3 id="heat-driver-title">Which names drove the move?</h3></div>
      <button className="action" onClick={onBack}>Back to heatmap</button></div>
    <label className="choice">Compare this cell with<select aria-label="Comparison period" value={compare} onChange={e=>setChoice(e.target.value)}>{options.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
    <div className="heat-summary" role="status"><b>{g.name} · {signed(current.value)}% {control}</b>
      <p>{current.ahead} of {current.total} {basis==="absolute"?"constituents rose":"constituents beat the benchmark"}. {lead && lead.symbol+" contributed most to the "+(current.value<0?"decline":"gain")+" ("+signed(lead.points)+" pp)."} {second && (lead?.symbol===second.symbol?"The same name, "+second.symbol:second.symbol)+" contributed most to the comparison period’s "+(other.value<0?"decline":"gain")+" ("+signed(second.points)+" pp)."}</p></div>
    <table className="heat-driver-table"><thead><tr><th>Constituent</th><th>{periods[period]}<small>{range(start,end)}</small></th>
      {otherDates&&<th>{comparisons[compare]}<small>{range(...otherDates)}</small></th>}</tr></thead>
      <tbody>{ordered.map(d=><tr key={d.symbol} data-driver-symbol={d.symbol}><th scope="row"><button className="ticker-link" aria-label={"Chart "+d.symbol} onClick={()=>onStock(d.symbol)}>{d.symbol}</button><small>{stockName(snapshot,d.symbol)}</small></th><td>{driverCell(d)}</td>
        {otherDates&&<td>{driverCell(other?.drivers.find(v=>v.symbol===d.symbol))}</td>}</tr>)}</tbody>
      <tfoot><tr><th>Basket total</th><td>{signed(current.value)}%</td>{otherDates&&<td>{other?signed(other.value)+"%":"—"}</td>}</tr></tfoot></table>
    {otherDates&&!other&&<p>This basket has insufficient history for the comparison interval.</p>}
    <p className="basis">Absolute basket return for the selected cell: {signed(current.absolute)}%. {basis!=="absolute"&&<>The benchmark returned {signed(100*((1+current.absolute/100)/(1+current.value/100)-1))}%. </>}Contributions in percentage points sum to each column’s displayed return before rounding. Stock returns are absolute. Weights reset monthly and drift between resets. Yahoo Finance adjusted closes.</p>
    <Newsflow snapshot={snapshot} id={id} windows={[{label:periods[period],start,end},other&&{label:comparisons[compare],start:other.start,end:other.end}]}/>
    <a className="action" href={"?asof="+end+"#reversals"}>Compare weekly reversals across all 13 layers →</a>
  </section>;
}
