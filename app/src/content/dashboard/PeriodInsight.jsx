import React,{useRef,useState} from "react";
import {leading,periodDrivers} from "./heatmap-data.mjs";
import {inWindow} from "./newsflow.mjs";
import {roles} from "./stock-roles.mjs";
import {referenceWindow} from "./reference-review.js";
import {shortDate} from "./HistoryChart.jsx";
import {stockName} from "./Weekly.jsx";
import LayerTrend from "./LayerTrend.jsx";

const signed=n=>(n>0?"+":"")+n.toFixed(2);
function stockCatalogue(snapshot){
  const catalogue=new Map();
  for(const [main,g] of Object.entries(snapshot.groups))for(const symbol of g.members){
    catalogue.set(symbol,{symbol,name:stockName(snapshot,symbol),main});
  }
  for(const role of roles)catalogue.set(role.symbol,role);
  return catalogue;
}

export function PeriodInsight({ranked,snapshot,index,start,end,week,basis}){
  const [universe,setUniverse]=useState("stocks"),[chart,setChart]=useState(null);
  const panel=useRef(null),opener=useRef(null);
  if(!ranked.length||start===end)return null;
  const selected=[ranked[0],ranked.at(-1)].filter((r,i,arr)=>i===0||r.id!==arr[0].id);
  const rising=ranked.filter(({r})=>r.absolute>0).length;
  const relativeOnly=ranked.filter(({r})=>r.value>0&&r.absolute<0);
  const measure=basis==="absolute"?"USD return":"relative return";
  const catalogue=stockCatalogue(snapshot);
  const stockRows=[];
  for(const role of catalogue.values()){
    const result=referenceWindow(snapshot,index,role.main,role,start,end,basis);
    if(result)stockRows.push({id:role.main,symbol:role.symbol,name:role.name,value:result.stock});
  }
  stockRows.sort((a,b)=>b.value-a.value||a.symbol.localeCompare(b.symbol));
  const rows=universe==="stocks"?stockRows:ranked.map(({id,name,r})=>({id,name,value:r.value}));
  const high=rows.slice(0,Math.min(5,Math.ceil(rows.length/2)));
  const low=rows.slice(high.length).slice(-5).reverse();
  function openChart(row,button){
    opener.current=button;setChart(row);
    requestAnimationFrame(()=>panel.current?.focus());
  }
  function closeChart(){setChart(null);opener.current?.focus();}
  function driverChart(id,symbol,button){
    openChart({id,symbol,name:catalogue.get(symbol)?.name||symbol},button);
  }
  return <section className="period-insight" aria-label="Selected period commentary"><h3>Period leaders and laggards</h3>
    <div className="heat-summary">
      {basis!=="absolute"&&<b>{ranked.filter(x=>x.r.value>0).length} of {ranked.length} baskets beat {basis==="market"?"the S&P 500 ETF":"their own benchmarks"}.</b>}
      <p>{rising} of {ranked.length} baskets rose in USD. {relativeOnly.length>0&&
        <>{relativeOnly.length} {relativeOnly.length===1?"basket outperformed":"baskets outperformed"} while losing money in USD.</>}</p>
    </div>
    <div className="selectors rank-switch" role="group" aria-label="Rank by">
      {[["stocks","Stocks"],["baskets","Layer baskets"]].map(([key,label])=><button className="action" key={key} aria-pressed={universe===key}
        onClick={()=>{setUniverse(key);setChart(null);}}>{label}</button>)}</div>
    <p className="basis">{shortDate(start)} – {shortDate(end)} · {basis==="absolute"?"USD returns":basis==="market"?"Returns versus SPY":"Returns versus each layer’s benchmark"} · {universe==="stocks"?
      `${rows.length} of ${catalogue.size} covered stocks with comparable closes. Each stock appears once in its primary layer.`:`${rows.length} multi-stock baskets with comparable closes.`}</p>
    <div className="period-pair rank-sides">{[[high,"Highest"],[low,"Lowest"]].map(([side,label])=><section key={label}><h4>{label} {measure}s</h4>
      {side.map((row,i)=><button key={row.symbol||row.id} className="rank-stock" aria-label={"Chart "+(row.symbol||row.name)+" · "+label.toLowerCase()+" returns"}
        onClick={e=>openChart(row,e.currentTarget)}><span>{i+1}</span><span><b>{row.symbol?row.symbol+" · ":""}{row.name}</b>
          {row.symbol&&<small>{snapshot.groups[row.id].title} · {snapshot.groups[row.id].members.includes(row.symbol)?"Basket member":snapshot.groups[row.id].controls.includes(row.symbol)?"Benchmark member":"Reference"}</small>}
          {basis==="own"&&<small>vs {snapshot.groups[row.id].label}</small>}</span>
        <strong className={row.value<0?"loss":row.value>0?"gain":""}>{signed(row.value)}%</strong></button>)}
      {!side.length&&<p>No additional names with comparable closes.</p>}</section>)}</div>
    {chart&&<section className="rank-chart" ref={panel} tabIndex="-1" onKeyDown={e=>{if(e.key==="Escape")closeChart();}}>
      <header><h4>{chart.symbol?chart.symbol+" · ":""}{chart.name}</h4><button className="action" onClick={closeChart}>Close chart</button></header>
      <LayerTrend key={chart.id+"/"+(chart.symbol||"basket")} {...{snapshot,start,end,basis}} id={chart.id} role={catalogue.get(chart.symbol)}
        series={chart.symbol||"basket"}/></section>}
    <div className="period-pair">{selected.map(({id,name,r},index)=>{
      const group=snapshot.groups[id],rows=snapshot.queries[id].rows,market=snapshot.marketCloses;
      const calc=(a,b)=>periodDrivers(group,rows,a,b,market,basis);
      const move=calc(start,end),driver=leading(move);
      const reports=inWindow(id,{start,end});
      const story=reports.find(n=>n.subject===driver?.symbol)||reports[0];
      const recent=week&&start<week&&week<end?calc(week,end):null;
      const control=basis==="market"?"SPY":group.label;
      return <article key={id} className="period-card">
        <small>{index===0?"Highest":"Lowest"} {measure}</small>
        <header><h4>{name}</h4><strong className={r.value>0?"gain":r.value<0?"loss":""}>{signed(r.value)}%</strong></header>
        <dl>{basis!=="absolute"&&<><dt>Basket return in USD</dt><dd>{signed(r.absolute)}%</dd>
          <dt>{control} benchmark in USD</dt><dd>{signed(100*((1+r.absolute/100)/(1+r.value/100)-1))}%</dd></>}
          <dt>{basis==="absolute"?"Stocks that rose":"Stocks ahead of benchmark"}</dt><dd>{r.ahead} of {r.total}</dd></dl>
        {driver&&<p><button className="ticker-link" aria-label={"Chart "+driver.symbol+" contribution driver"} onClick={e=>driverChart(id,driver.symbol,e.currentTarget)}>{driver.symbol}</button> contributed {signed(driver.points)} pp to the {basis==="absolute"?"USD":"relative"} return.</p>}
        {recent&&recent.value*move.value<0&&<p>Week to date, the move reversed ({signed(recent.value)}% {measure}).</p>}
        {story&&<details><summary>{story.subject} · {story.scope} · {shortDate(story.published)}</summary><p className="basis">{story.text} <a href={story.url} target="_blank" rel="noreferrer">{story.source} ↗</a></p></details>}
      </article>;
    })}</div>
    <small>{shortDate(start)} – {shortDate(end)} · Yahoo Finance adjusted closes. Dated disclosures give business context for the period.</small>
  </section>;
}

export function StockLookup({snapshot,index,start,end,basis}){
  const [symbol,setSymbol]=useState("");
  const groups=Object.entries(snapshot.groups),catalogue=stockCatalogue(snapshot);
  const role=catalogue.get(symbol);
  return <section className="stock-lookup"><label className="choice">Compare a stock with its layers<select value={symbol} onChange={e=>setSymbol(e.target.value)}>
    <option value="">Choose a company or ticker</option>{[...catalogue.values()].sort((a,b)=>a.name.localeCompare(b.name)).map(r=><option key={r.symbol} value={r.symbol}>{r.name} · {r.symbol}</option>)}</select></label>
    <div className="selectors">{["NET","NVDA","SHOP","AAPL","MSFT","GOOGL","AMZN"].map(s=><button className="action" key={s} aria-pressed={s===symbol} onClick={()=>setSymbol(s)}>{catalogue.get(s).name}</button>)}</div>
    {role&&<div data-stock-comparison><h3>{role.name} · {symbol}</h3><small>{shortDate(start)} – {shortDate(end)} · Yahoo Finance adjusted closes</small>
      {groups.filter(([id,g])=>g.members.includes(symbol)||[role.main,role.also].includes(id)).map(([id,g])=>{
        const r=referenceWindow(snapshot,index,id,role,start,end,basis);
        const member=g.members.includes(symbol),denom=basis==="own"?"vs "+g.label:basis==="market"?"vs SPY":"absolute";
        return <p key={id}><b>{g.name}</b> · {member?"Basket member":g.controls.includes(symbol)?"Benchmark member":"Reference stock"}<br/>
          {r?<>{symbol} {signed(r.stock)}% · Layer {signed(r.basket)}% ({denom}) · Gap {signed(r.gap)} pp{!member&&" · "+r.status}</>:"Insufficient common price history."}</p>;
      })}</div>}
  </section>;
}
