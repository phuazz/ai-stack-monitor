import React from "react";
import InvestorMap from "./InvestorMap.jsx";
import {shortDate} from "./HistoryChart.jsx";

const signed=v=>(v>0?"+":"")+v.toFixed(2);
const tone=v=>v<0?"loss":v>0?"gain":"";
const byMagnitude=(a,b)=>Math.abs(b.points)-Math.abs(a.points);

const commonNames={TSM:"TSMC",UMC:"United Microelectronics",NVDA:"Nvidia",AMD:"AMD",STM:"STMicroelectronics",NXPI:"NXP Semiconductors"};
export const stockName=(snapshot,s)=>commonNames[s]||snapshot.instruments[s].name;

export function WeekControl({period,onChange}){
  return <label className="choice">Review period<select aria-label="Review period" value={period} onChange={e=>onChange(Number(e.target.value))}>
    <option value={0}>This week</option><option value={1}>Previous week</option>
  </select></label>;
}

export function WeeklyMap({snapshot,period,onPeriod,onPick,onWatch}){
  return <InvestorMap {...{snapshot,period,onPick,onWatch}} control={<WeekControl period={period} onChange={onPeriod}/>}/>;
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
