import React,{useState} from "react";
import {compareLegs,onOrBefore,periodDrivers,startIndex} from "./heatmap-data.mjs";
import {shortDate} from "./HistoryChart.jsx";
import Newsflow from "./Newsflow.jsx";
import ReferenceGaps from "./ReferenceGaps.jsx";
import DashboardNav from "./DashboardNav.jsx";

const signed=(v,unit)=>v==null?"—":(v>0?"+":"")+v.toFixed(2)+unit;
function Leg({title,window,lead,limit}){
  const value=window?.value;
  return <span className="rv-leg"><small className="rv-mobile-label">{title}</small><span className="rv-plot">
    <span className="cov-track" aria-hidden="true">{value!=null&&<i className={value<0?"negative":"positive"} style={{width:50*Math.abs(value)/limit+"%"}}/>}</span>
    <strong className={value<0?"loss":value>0?"gain":""}>{signed(value,"%")}</strong></span>
    <small>{lead?lead.symbol+" "+signed(lead.points," pp"):window?"No unique leader":"—"}</small></span>;
}
export default function Reversals({snapshot}){
  const market=snapshot.marketCloses,dates=Object.keys(market).sort();
  const initial=new URLSearchParams(location.search).get("asof");
  const [asof,setDate]=useState(Object.hasOwn(market,initial)?initial:snapshot.asOf);
  const [view,setView]=useState("layers"),[direction,setDirection]=useState("all");
  const ei=onOrBefore(dates,asof),end=dates[ei],base=dates[startIndex("wtd",dates,ei,{})];
  const peak=dates[startIndex("peak",dates,ei,{SPY:market})],valid=end&&asof<=snapshot.asOf;
  const data=Object.entries(snapshot.groups).map(([id,g],i)=>{
    const calc=(a,b)=>a&&b&&a<b?periodDrivers(g,snapshot.queries[id].rows,a,b,market,"own"):null;
    return {id,g,i,...compareLegs(calc(peak,base),calc(base,end))};
  }).sort((a,b)=>Number(b.reversed&&b.g.members.length>1)-Number(a.reversed&&a.g.members.length>1)||Math.abs(b.week?.value??0)-Math.abs(a.week?.value??0)||a.i-b.i);
  const eligible=data.filter(r=>r.comparable&&r.g.members.length>1),flips=eligible.filter(r=>r.reversed);
  const known=flips.filter(r=>r.weekLead&&r.priorLead),same=known.filter(r=>r.weekLead.symbol===r.priorLead.symbol);
  const up=flips.filter(r=>r.week.value>0),down=flips.filter(r=>r.week.value<0);
  const visible=direction==="all"?data:direction==="up"?up:down;
  const limit=Math.max(1,...data.flatMap(r=>[Math.abs(r.before?.value??0),Math.abs(r.week?.value??0)]));
  return <section className="heat-view reversal-view"><DashboardNav active="reversals" links={{heatmap:valid?"?asof="+end+"#heatmap":"#heatmap"}}/>
    <header className="rv-header"><div><h1>Weekly reversals</h1><p>Which AI layers changed direction against their benchmarks?</p></div>
    <label className="choice">Review close<input type="date" min={dates[0]} max={snapshot.asOf} value={asof} onChange={e=>setDate(e.target.value)}/></label></header>
    {!valid?<p>Choose a date within the available history.</p>:<>
    <div className="rv-switch" role="group" aria-label="Reversal analysis">
      <button aria-pressed={view==="layers"} onClick={()=>setView("layers")}>Layer reversals</button>
      <button aria-pressed={view==="stocks"} onClick={()=>setView("stocks")}>Reference stock gaps</button></div>
    {view==="stocks"?<ReferenceGaps snapshot={snapshot} peak={peak} base={base} end={end}/>:<>
    <div className="rv-panel"><div className="rv-header"><div>
      <h2>{eligible.length?flips.length+" of "+eligible.length+" baskets reversed":"No comparable baskets"}</h2>
      <p>{eligible.length?up.length+" turned up · "+down.length+" turned down":"Both periods need a measurable relative move."}{known.length>0&&" · "+same.length+" of "+known.length+" reversals had the same lead stock"}</p></div>
      <label className="choice">Show layers<select aria-label="Show layers" value={direction} onChange={e=>setDirection(e.target.value)}>
        <option value="all">All 13 layers</option><option value="up">Baskets turning up ({up.length})</option><option value="down">Baskets turning down ({down.length})</option>
      </select></label></div>
    <p className="rv-source">Market high {shortDate(peak)} · Prior close {base?shortDate(base):"unavailable"} · Review close {shortDate(end)} · Yahoo Finance adjusted closes</p>
    {(!base||peak>=base)&&<p>No pre-week interval from this market high. Weekly returns are shown where available.</p>}
    <div className="rv-labels"><span>Layer and benchmark</span><span>High to prior close</span><span>This week</span><span>Leading stock</span></div>
    {visible.length===0&&<p>No baskets turned {direction==="up"?"up":"down"} over these closes.</p>}
    {visible.map(r=>{
      const {id,i,g,before,week,priorLead,weekLead}=r,single=g.members.length===1;
      const both=priorLead&&weekLead;
      return <details key={id} className="reversal-row" data-layer-review={id}><summary>
        <span><small>L{i} · {single?"Single-stock reference":r.status}</small><b>{g.name}</b><small>vs {g.label}</small></span>
        <Leg title="High to prior close" window={before} lead={priorLead} limit={limit}/><Leg title="This week" window={week} lead={weekLead} limit={limit}/>
        <span><b>{single?"Single name":both?(priorLead.symbol===weekLead.symbol?"Same leader":"New leader"):"—"}</b>
          <span>{both&&!single?priorLead.symbol+" → "+weekLead.symbol:r.status}</span></span>
      </summary><div className="reversal-detail"><p>{r.overlap&&<>Moved in the basket’s direction in both legs · <b>{r.overlap.join(", ")||"No names"}</b>. </>}
        {r.net!=null&&<>Cumulative return versus {g.label} since the high · <b>{signed(r.net,"%")}</b>.</>}</p>
        <table className="heat-driver-table"><thead><tr><th>Stock</th><th>High to prior close</th><th>This week</th></tr></thead><tbody>
          {g.members.map(s=><tr key={s}><th>{s}</th>{[before,week].map((w,j)=><td key={j}>{signed(w?.drivers.find(d=>d.symbol===s)?.points," pp")}</td>)}</tr>)}</tbody></table>
        <Newsflow snapshot={snapshot} id={id} windows={[before&&{...before,label:"High to prior close"},week&&{...week,label:"This week"}]}/></div>
      </details>;
    })}<p className="rv-source">Bars share a zero line and scale. The high is SPY’s latest closing high in 252 sessions. Each basket is equal-weighted monthly. Expand a layer for contributions in percentage points and dated news. Meta is a single-stock reference.</p></div></>}</>}
  </section>;
}
