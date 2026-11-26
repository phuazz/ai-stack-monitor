import DashboardNav from "./DashboardNav.jsx";
import React,{useState} from "react";
import {shortDate} from "./HistoryChart.jsx";

const stages=["observed","confirmed"];
const stagesText=["When first flagged","After confirmation"];
const pct=n=>(n>0?"+":"")+n.toFixed(2)+"%";
const avg=xs=>xs.reduce((a,b)=>a+b,0)/xs.length;
function stats(rows){
  const values=rows.map(r=>r.value).sort((a,b)=>a-b);
  if(!values.length)return null;
  const mid=Math.floor(values.length/2);
  return {mean:avg(values),median:values.length%2?values[mid]:(values[mid-1]+values[mid])/2,
    normal:avg(rows.map(r=>r.normal)),hits:rows.filter(r=>r.side==="Bullish"?r.value>0:r.value<0).length,n:rows.length};
}
function usable(rows,skipOverlap){
  const complete=rows.filter(r=>r.value!==null).sort((a,b)=>a.entry.localeCompare(b.entry)||a.observed.localeCompare(b.observed));
  if(!skipOverlap)return complete;
  const until=new Map();
  return complete.filter(r=>{
    const key=[r.layer,r.stage].join("/");
    if(until.has(key)&&r.entry<until.get(key))return false;
    until.set(key,r.end);return true;
  });
}
function Control({label,value,change,options}){
  return <label className="choice">{label}<select aria-label={label} value={value} onChange={e=>change(e.target.value)}>
    {options.map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>;
}
function policy(rows){
  const eligible=rows.filter(r=>r.policyMature);
  const all=eligible.filter(r=>r.stage==="observed");
  const confirmations=eligible.filter(r=>r.stage==="confirmed");
  function net(r){
    const gross=1+r.value/100;
    const friction=((1-.001)/(1+.001))**2;
    return 100*((r.side==="Bullish"?gross:1/gross)*friction-1);
  }
  return all.length?{n:all.length,c:confirmations.length,now:avg(all.map(net)),
    wait:confirmations.reduce((s,r)=>s+net(r),0)/all.length}:null;
}
export default function Outcomes({snapshot}){
  const [side,setSide]=useState(window.location.hash==="#outcomes-exhaustion"?"Bearish":"Bullish"),[h,setH]=useState("21"),[lag,setLag]=useState("1");
  const [windows,setWindows]=useState("all"),[metric,setMetric]=useState("mean");
  const groups=Object.entries(snapshot.groups);
  const records=snapshot.forwardReturns.filter(r=>r.side===side && r.horizon===Number(h)&&r.lag===Number(lag));
  const completed=usable(records,windows==="distinct");
  const summaries=stages.map(stage=>stats(completed.filter(r=>r.stage===stage)));
  const paired=policy(records), bull=side==="Bullish";
  const signals=groups.reduce((n,[,g])=>n+g.events.length,0);
  const confirmations=groups.reduce((n,[,g])=>n+g.events.filter(e=>e.status==="Confirmed").length,0);
  function layerCell(id,stage){
    const subset=completed.filter(r=>r.layer===id&&r.stage===stage);
    const s=stats(subset),total=records.filter(r=>r.layer===id&&r.stage===stage).length;
    if(!s)return <td>— <small>0 of {total}</small></td>;
    return <td><b>{pct(s[metric])}</b><small>{s.n} of {total} flags</small></td>;
  }
  return <section className="outcomes">
    <DashboardNav active="outcomes"/>
    <h1>What happened after a flag?</h1>
    <p className="basis">{signals} historical flags · {confirmations} confirmed · adjusted US closes through {shortDate(snapshot.asOf)} · Yahoo Finance</p>
    <div className="selectors"><Control label="Signal" value={side} change={setSide} options={[["Bullish","Bullish divergence"],["Bearish","Relative exhaustion"]]}/>
      <Control label="Holding period" value={h} change={setH} options={[["5","5 sessions"],["21","21 sessions"],["63","63 sessions"]]}/>
      <Control label="Start counting from" value={lag} change={setLag} options={[["1","Next trading close"],["0","Signal-day close"]]}/></div>
    <p className="outcome-note">A positive return means the basket beat its benchmark. {bull?"A bullish flag anticipates outperformance.":"An exhaustion flag anticipates underperformance, so a negative return is a hit."}</p>
    <div className="weekly-highlights">{summaries.map((s,i)=><section key={i} className="outcome-tile"><small>{stagesText[i]}</small>
      <strong>{s?pct(s.mean):"—"}</strong><span>average relative return · {s?.n??0} windows</span>
      {s&&<p>{s.hits} of {s.n} moved as signalled. The usual return for the same mix of layers and years was {pct(s.normal)}.</p>}</section>)}</div>
    <p className="basis">The first group includes every eligible flag. The second includes only flags that subsequently confirmed. A window needs all {h} future sessions.</p>
    <h2>Returns by layer</h2>
    <div className="selectors"><Control label="Layer statistic" value={metric} change={setMetric} options={[["mean","Average return"],["median","Median return"]]}/>
      <Control label="Windows included" value={windows} change={setWindows} options={[["all","All completed windows"],["distinct","Avoid overlap within each layer and stage"]]}/></div>
    <table className="outcome-table"><thead><tr><th>Layer / basket</th><th>First flag</th><th>Confirmed</th></tr></thead>
      <tbody>{groups.map(([id,g],i)=><tr key={id} data-outcome-layer={id}><td><b>L{i} · {g.title}</b><small>{g.name} vs {g.label}</small></td>
        {g.members.length===1?<td colSpan="2">Single reference · no breadth signal</td>:stages.map(stage=><React.Fragment key={stage}>{layerCell(id,stage)}</React.Fragment>)}</tr>)}</tbody></table>
    <p className="basis">Counts show included windows out of all flags at that stage. Small samples can turn on one event. The overlap filter keeps the earliest non-overlapping holding windows within each layer and stage. Different layers can still move together.</p>
    <h2>Was it worth waiting?</h2>
    {paired&&<p className="policy-result">Across the same <b>{paired.n} original opportunities</b>, acting on every flag returned <b>{pct(paired.now)}</b> per opportunity. Waiting for confirmation returned <b>{pct(paired.wait)}</b> across those same opportunities, with {paired.c} switches.</p>}
    <details className="methods"><summary>Return calculation and switching costs</summary>
      <p>The holding period starts at the selected close. The signal-day close measures the price response from the flag and assumes a fill at the close that established it. The next close is the delayed-entry comparison. Each return is the percentage change in basket wealth divided by benchmark wealth.</p>
      <p>The usual return averages all complete windows anchored in the same layer and calendar year, from session 24 onward, weighted by the number of included events. This retrospective comparator includes event dates. First flags and confirmations on the same date keep the same anchor.</p>
      <p>The waiting comparison retains every original opportunity with 42 sessions available for confirmation plus the entry delay and full holding period. A bullish switch holds the basket over its benchmark. An exhaustion switch holds the benchmark over the basket. Unconfirmed flags earn zero incremental return under waiting. Each executed switch incurs an illustrative 10 basis points per side on sale and purchase, at entry and exit, for spread, fees and slippage combined. These are relative wealth outcomes per opportunity. They can overlap and cannot be compounded into a portfolio record. The overlap selector applies to the return panels above.</p>
      <p>The constituent roster was selected with hindsight. The horizons and cost assumption are exploratory. This sample has no untouched forward test.</p>
    </details></section>;
}
