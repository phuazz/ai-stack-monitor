import React,{useState} from "react";
import {compareLegs,onOrBefore,periodDrivers,startIndex} from "./heatmap-data.mjs";
import {shortDate} from "./HistoryChart.jsx";
import Newsflow from "./Newsflow.jsx";
import ReferenceGaps from "./ReferenceGaps.jsx";

const signed=(v,unit)=>v==null?"—":(v>0?"+":"")+v.toFixed(2)+unit;
function Leg({title,window,lead}){
  return <span><small>{title}</small><strong className={window?.value<0?"loss":"gain"}>{signed(window?.value,"%")}</strong>
    <span>{lead?lead.symbol+" "+signed(lead.points," pp"):window?"No unique leader":"—"}</span></span>;
}
export default function Reversals({snapshot}){
  const market=snapshot.marketCloses,dates=Object.keys(market).sort();
  const initial=new URLSearchParams(location.search).get("asof");
  const [asof,setDate]=useState(Object.hasOwn(market,initial)?initial:snapshot.asOf);
  const ei=onOrBefore(dates,asof),end=dates[ei],base=dates[startIndex("wtd",dates,ei,{})];
  const peak=dates[startIndex("peak",dates,ei,{SPY:market})],valid=end&&asof<=snapshot.asOf;
  const data=Object.entries(snapshot.groups).map(([id,g],i)=>{
    const calc=(a,b)=>a&&b&&a<b?periodDrivers(g,snapshot.queries[id].rows,a,b,market,"own"):null;
    return {id,g,i,...compareLegs(calc(peak,base),calc(base,end))};
  }).sort((a,b)=>Number(b.reversed&&b.g.members.length>1)-Number(a.reversed&&a.g.members.length>1)||a.i-b.i);
  const eligible=data.filter(r=>r.comparable&&r.g.members.length>1),flips=eligible.filter(r=>r.reversed);
  const known=flips.filter(r=>r.weekLead&&r.priorLead),same=known.filter(r=>r.weekLead.symbol===r.priorLead.symbol);
  return <section className="heat-view reversal-view"><a className="action" href="#map">← Investor map</a> <a className="action" href="#heatmap">Heatmap</a> <a className="action" href="#coverage">Stock coverage</a>
    <h1>Weekly reversals across the AI stack</h1>
    <label className="choice">Review close<input type="date" min={dates[0]} max={snapshot.asOf} value={asof} onChange={e=>setDate(e.target.value)}/></label>
    {!valid?<p>Choose a date within the available history.</p>:<>
    <p>Each layer is measured against its own benchmark. The first leg runs from the most recent S&amp;P 500 ETF closing high in 252 sessions to the prior week’s close. The second leg starts at that same close.</p>
    <p className="basis">Market high · {shortDate(peak)}　 Prior close · {base?shortDate(base):"Unavailable"}　 Review close · {shortDate(end)}<br/>Source · Yahoo Finance adjusted closes, monthly equal-weight baskets.</p>
    {!base||peak>=base?<p className="heat-summary">There is no pre-week interval from this market high. Weekly returns are shown where available.</p>:
    <div className="heat-summary"><b>{flips.length} of {eligible.length} comparable baskets changed direction this week.</b>
      <p>{flips.filter(r=>r.week.value>0).length} turned up and {flips.filter(r=>r.week.value<0).length} turned down.
      {known.length>0&&" The same stock led both legs in "+same.length+" baskets. Leadership changed in "+(known.length-same.length)+"."}</p></div>}
    <ReferenceGaps snapshot={snapshot} peak={peak} base={base} end={end}/>
    <h2>Basket reversals and stock contributions</h2>
    {data.map(r=>{
      const {id,i,g,before,week,priorLead,weekLead}=r,single=g.members.length===1;
      const both=priorLead&&weekLead;
      return <details key={id} className="reversal-row" data-layer-review={id}><summary>
        <span><small>L{i} · {single?"Single-stock reference":r.status}</small><b>{g.name}</b><small>vs {g.label}</small></span>
        <Leg title="High to prior close" window={before} lead={priorLead}/><Leg title="This week" window={week} lead={weekLead}/>
        <span><small>Leading stock</small><b>{single?"Single name":both?(priorLead.symbol===weekLead.symbol?"Same leader":"New leader"):"—"}</b>
          <span>{both&&!single?priorLead.symbol+" → "+weekLead.symbol:r.status}</span></span>
      </summary><div className="reversal-detail"><p>{r.overlap&&<>Moved in the basket’s direction in both legs · <b>{r.overlap.join(", ")||"No names"}</b>. </>}
        {r.net!=null&&<>Cumulative return versus {g.label} since the high · <b>{signed(r.net,"%")}</b>.</>}</p>
        <table className="heat-driver-table"><thead><tr><th>Stock</th><th>High to prior close</th><th>This week</th></tr></thead><tbody>
          {g.members.map(s=><tr key={s}><th>{s}</th>{[before,week].map((w,j)=><td key={j}>{signed(w?.drivers.find(d=>d.symbol===s)?.points," pp")}</td>)}</tr>)}</tbody></table>
        <Newsflow snapshot={snapshot} id={id} windows={[before&&{...before,label:"High to prior close"},week&&{...week,label:"This week"}]}/></div>
      </details>;
    })}<p className="basis">Rows with reversals appear first. The leader is the largest contributor in the direction of the leg. Expand a row for every stock. Meta is shown separately from the basket count. A one-week turn can leave the basket below its market-high starting level.</p></>}
  </section>;
}
