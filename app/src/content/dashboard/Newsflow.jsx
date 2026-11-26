import React from "react";
import {inWindow} from "./newsflow.mjs";
import {shortDate} from "./HistoryChart.jsx";

function sessionReturn(snapshot,id,event){
  if(event.scope!=="Company disclosure"||!snapshot.groups[id].members.includes(event.subject))return null;
  const rows=snapshot.queries[id].rows,index=rows.findIndex(r=>r.date===event.session);
  if(index<1)return null;
  const a=rows[index-1],b=rows[index],pct=n=>(n>0?"+":"")+n.toFixed(2)+"%";
  return <small className="event-price">First review session · {shortDate(b.date)} · {event.subject} {pct(100*(b[event.subject]/a[event.subject]-1))} · {snapshot.groups[id].label} {pct(100*(b.benchmark/a.benchmark-1))}</small>;
}
export default function Newsflow({snapshot,id,windows}){
  return <section className="review-news" data-reviewed-rows><h3>What was in the news?</h3>
    <p className="basis">Selected reports available by each closing date. Price contributions above measure the move. A company disclosure supplies context unless a source explicitly links it to trading.</p>
    {windows.filter(w=>w?.start&&w?.end).map(w=>{
      const items=inWindow(id,w);
      return <div key={w.label}><h4>{w.label} · {shortDate(w.start)} – {shortDate(w.end)}</h4>
        {items.length?items.map(n=><p key={n.subject+n.session}><b>{n.subject}</b> · {shortDate(n.published)} · {n.scope}<br/>{n.text} <a href={n.url} target="_blank" rel="noreferrer">{n.source} ↗</a>{sessionReturn(snapshot,id,n)}</p>):
          <p className="basis">No reviewed report for this layer in this interval.</p>}</div>;
    })}</section>;
}
