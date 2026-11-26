import React,{useState} from "react";
import {shortDate} from "./HistoryChart.jsx";
import {guidance,upcoming} from "./investor-context.mjs";

export default function InvestorContext({ranked,start,end,label,select,groups}){
  const [panel,setPanel]=useState(()=>{
    const query=new URLSearchParams(window.location.search);
    return query.has("basket")||query.has("reference")?"":"Period ranking";
  });
  const events=upcoming(end),reports=guidance.filter(r=>r[1]<=end);
  const maximum=Math.max(1,...ranked.map(x=>Math.abs(x.r.value)));
  return <section className="investor-context" aria-label="Investor context">
    <div className="selectors">{["Period ranking","Capital spending","Upcoming earnings"].map(p=><button className="action" key={p} aria-expanded={panel===p} onClick={()=>setPanel(panel===p?"":p)}>{p}</button>)}</div>
    {panel==="Period ranking"&&<div><p className="basis">Basket {label} · {shortDate(start)} – {shortDate(end)} · Yahoo Finance adjusted closes. Select a basket for its chart and drivers.</p>
      {ranked.map(({id,name,r})=><button className="rank-line" key={id} onClick={()=>select(id)}><span>{name}</span><span className="rank-scale"><i style={{width:Math.abs(r.value)/maximum*50+"%",[r.value<0?"right":"left"]:"50%",background:r.value<0?"var(--r-text)":"var(--g-text)"}}/></span><b>{r.value>0?"+":""}{r.value.toFixed(1)}%</b></button>)}</div>}
    {panel==="Capital spending"&&<div><h3>Who is funding capacity?</h3><p className="basis">Calendar 2026 company-wide guidance. The companies include other businesses and use different lease conventions.</p>
      {reports.length?<div className="guidance-grid">{reports.map(([name,date,value,basis,url])=><article key={name}><b>{name}</b><strong>{value}</strong><span>{basis}</span><a href={url} target="_blank" rel="noreferrer">Issuer · {shortDate(date)}</a></article>)}</div>:<p>No guidance in the source set by this close.</p>}</div>}
    {panel==="Upcoming earnings"&&<div><h3>Company-confirmed earnings</h3><p className="basis">Selected covered companies · next 30 calendar days after {shortDate(end)} · US reporting dates.</p>
      {events.length?<ul>{events.map(([name,id,,date,url])=><li key={name}><time dateTime={date}>{shortDate(date)}</time> · <a href={url} target="_blank" rel="noreferrer">{name}</a> · {groups[id].title}</li>)}</ul>:<p>No issuer-confirmed dates in the tracked calendar for this window.</p>}</div>}
  </section>;
}
