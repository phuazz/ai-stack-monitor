import React,{useMemo,useState} from "react";
import {shortDate} from "./HistoryChart.jsx";
import {rowIndex,layerReferences,referenceWindow} from "./reference-review.js";

const number=v=>(v>0?"+":"")+v.toFixed(2);
const classifications=["All comparisons","Diverged since high, confirms this week","Confirmed since high, diverges this week"];
function WindowCell({value,id,symbol,period,end}){
  if(!value)return <td>—</td>;
  return <td><a href={"?layer="+id+"&reference="+symbol+"&period="+period+"&asof="+end+"&basis=own#heatmap"}>{number(value.gap)} pp</a>
    <small>{value.status}</small></td>;
}
export default function ReferenceGaps({snapshot,peak,base,end}){
  const [filter,setFilter]=useState(0),[sort,setSort]=useState("high");
  const index=useMemo(()=>rowIndex(snapshot),[snapshot]);
  const rows=Object.entries(snapshot.groups).flatMap(([id,g],i)=>layerReferences(id,g).map(role=>{
    const window=start=>referenceWindow(snapshot,index,id,role,start,end,"own");
    const high=window(peak),week=window(base);
    const flip=high?.status==="Diverges"&&week?.status==="Confirms"?1:
      high?.status==="Confirms"&&week?.status==="Diverges"?2:0;
    return {id,i,g,role,week,high,flip};
  }));
  const displayed=rows.filter(r=>!filter||r.flip===filter).sort((a,b)=>
    (b[sort]?Math.abs(b[sort].gap):-1)-(a[sort]?Math.abs(a[sort].gap):-1)||a.i-b.i||a.role.symbol.localeCompare(b.role.symbol));
  return <section className="gap-review" data-reviewed-rows><h2>Where stocks agree with their layer</h2>
    <p><b>{rows.filter(r=>r.flip===1).length}</b> diverged since the high and confirmed this week. <b>{rows.filter(r=>r.flip===2).length}</b> confirmed since the high and diverged this week.</p>
    <p className="basis">{rows.filter(r=>r.week&&r.high).length} of {rows.length} stock–layer comparisons have both windows. Both end at {shortDate(end)}. The full period starts {shortDate(peak)} and includes any overlapping weekly sessions. The week starts at the {base?shortDate(base):"unavailable"} baseline close.</p>
    <div className="selectors"><label className="choice">Direction filter<select value={filter} onChange={e=>setFilter(Number(e.target.value))}>{classifications.map((s,i)=><option value={i} key={s}>{s}</option>)}</select></label>
      <label className="choice">Rank by largest gap<select value={sort} onChange={e=>setSort(e.target.value)}><option value="high">Since market high</option><option value="week">This week</option></select></label></div>
    <p className="basis">Gap is stock return minus layer return in percentage points, both measured against the layer benchmark. Ranked by gap size in either direction. A positive gap means the stock led the layer. Select a gap for both returns.</p>
    <table className="heat-driver-table"><thead><tr><th>Stock · layer</th><th>Since high</th><th>This week</th></tr></thead>
      <tbody>{displayed.map(({id,i,g,role,week,high})=><tr key={id+role.symbol} data-gap-pair={id+"-"+role.symbol}>
        <th scope="row">{role.symbol} · {role.name}<small>L{i} · {g.name}{g.controls.includes(role.symbol)?" · in benchmark":""}</small></th>
        <WindowCell value={high} id={id} symbol={role.symbol} end={end} period="peak"/><WindowCell value={week} id={id} symbol={role.symbol} end={end} period="wtd"/></tr>)}</tbody></table>
    {!displayed.length&&<p>No stock–layer pairs match this direction at the selected close.</p>}
    <p className="basis">Source · Yahoo Finance adjusted closes. Equal signs of the two returns confirm direction. Opposite signs diverge. Either return below 0.05% in magnitude is flat. A dash indicates missing history.</p>
  </section>;
}
