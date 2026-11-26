import React,{useState} from "react";
import HistoryChart,{shortDate} from "./HistoryChart.jsx";
import prices from "./reference-prices.json";
import {trendRows} from "./trends.mjs";
import backfill from "./chart-backfill.json";
import TrendExport,{averageLines} from "./TrendExport.jsx";
import {compactCompany,updateQuery} from "../../locale.js";

const lines=[{key:"close",name:"Close",colour:"var(--t1)"},...averageLines];
export default function LayerTrend({snapshot,id,role,basis,start,end,series,onSeriesChange,shareWindow=false}){
  const group=snapshot.groups[id];
  const [localSymbol,choose]=useState(role?.symbol||"basket"),[span,setSpan]=useState(()=>{
    const value=shareWindow&&new URLSearchParams(location.search).get("window");
    return ["0","21","63","126","252","756","1260"].includes(value)?value:"252";
  });
  function changeSpan(value){setSpan(value);if(shareWindow)updateQuery({window:value==="252"?null:value});}
  const symbol=series??localSymbol;
  const live=snapshot.queries[id].rows;
  const home=role&&snapshot.queries[role.main].rows;
  const primary=home&&new Map(home.map(r=>[r.date,r[role.symbol]]));
  const numerator=row=>symbol==="basket"?row.basket:row[symbol]??prices.series[symbol]?.prices[row.date]??(symbol===role?.symbol?primary?.get(row.date):undefined);
  const denominator=row=>basis==="market"?snapshot.marketCloses[row.date]:basis==="absolute"?1:row.benchmark;
  const prefix=backfill.layers[id],join=live[0],previous=[];
  if(join.date===prefix.join){
    const a=prefix.series[symbol],b=prefix.series[basis==="market"?"SPY":"benchmark"];
    const scale=numerator(join)/denominator(join);
    for(const [i,date] of prefix.dates.entries()){
      if(date>end)break;
      const divisor=basis==="absolute"?1:b?.[i];
      previous.push({date,value:a?.[i]>0&&divisor>0?a[i]/divisor*scale:null});
    }
  }
  const rows=previous.concat(live.filter(r=>r.date<=end).map(r=>({date:r.date,value:numerator(r)/denominator(r)})));
  const data=trendRows(rows,row=>row.value,start,Number(span));
  const last=data.at(-1),label=basis==="absolute"?"USD trend":"Trend versus "+(basis==="market"?"SPY":group.label);
  return <section className="layer-trend"><h3>{label}</h3><div className="selectors">
    {(series==null||onSeriesChange)&&<label className="choice">Chart series<select aria-label="Chart series" value={symbol} onChange={e=>(onSeriesChange??choose)(e.target.value)}>
      <option value="basket">{group.name}</option>{[...new Set([...group.members,...(role?[role.symbol]:[])])].map(s=><option key={s} value={s}>{compactCompany(s,snapshot.instruments)}</option>)}</select></label>}
    <label className="choice">Chart window<select aria-label="Chart window" value={span} onChange={e=>changeSpan(e.target.value)}>{[["0","Selected period ("+shortDate(start)+" – "+shortDate(end)+")"],["21","1 month"],["63","3 months"],["126","6 months"],["252","1 year"],["756","3 years"],["1260","5 years"]].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label></div>
    {last?.close?<><HistoryChart rows={data} lines={lines.filter(l=>data.some(p=>Number.isFinite(p[l.key])))} title={label}/>
      <TrendExport rows={data} lines={lines} seriesId={symbol==="basket"?id:id+"-"+symbol} basisId={basis}
        title={symbol==="basket"?group.name:(snapshot.instruments[symbol]?.name??role?.name??symbol)+" · "+symbol}
        basis={basis==="absolute"?"Absolute return in USD":"Relative return versus "+(basis==="market"?"S&P 500 (SPY)":group.label+" ("+group.controls.join(" / ")+")")}/>
      <p>{[50,200].map(n=>last["ma"+n]?`${n} sessions: ${(100*(last.close/last["ma"+n]-1)).toFixed(1)}% from average`:`${n} sessions: insufficient history`).join(" · ")}</p></>:<p>Insufficient common price history.</p>}
    <small>{data.length>0&&<>{shortDate(data[0].date)} – </>}{shortDate(end)} · {data.filter(row=>Number.isFinite(row.close)).length} closes{Number(span)>data.length?" · shorter available history":""}. First available close = 100. Years use 252 sessions. Yahoo Finance adjusted closes.</small></section>;
}
