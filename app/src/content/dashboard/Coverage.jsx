import React,{useState} from "react";
import {shortDate} from "./HistoryChart.jsx";
import {periods,startIndex} from "./heatmap-data.mjs";
import {roles} from "./stock-roles.mjs";
import refs from "./reference-prices.json";

const gaps={
  energy:"Grid transmission, fuel supply and regulated utilities.",
  power:"Data-centre landlords and server assemblers. Their drivers are occupancy and hardware margins respectively.",
  equipment:"Chip-design software and processor IP earn licences and royalties.",
  foundry:"Advanced packaging, substrates and outsourced assembly. Node and packaging mix also vary across foundries.",
  compute:"Custom accelerators, memory and processor IP. Two GPU designers give narrow breadth.",
  network:"Network engineering software and network services. The basket already spans switching and optics.",
  cloud:"Edge/serverless cloud and content delivery. The hyperscalers form the benchmark.",
  models:"Direct model-provider economics. Meta also earns advertising revenue. Anthropic has only a short listed history.",
  data:"Data governance, labelling and model evaluation. The basket measures public data platforms.",
  security:"Agent runtimes, identity and permissions. Established security budgets dominate the listed platforms.",
  payments:"Storefront software, merchant acquiring and checkout. Card-network fees capture only one part of commerce.",
  apps:"Vertical applications, consumer assistants and AI-native agents. Incumbent workflow vendors are the measured slice.",
  devices:"Device makers, robotics integrators and autonomous systems. Chip content is the measured slice."
};
const signed=v=>(v>0?"+":"")+v.toFixed(2)+"%";
export default function Coverage({snapshot}){
  const [search,setSearch]=useState("");
  const [period,setPeriod]=useState("wtd");
  const groups=Object.entries(snapshot.groups),term=search.trim().toLowerCase();
  function match(...words){return words.filter(Boolean).some(s=>s.toLowerCase().includes(term));}
  const layerName=id=>id?"L"+groups.findIndex(([k])=>k===id)+" · "+snapshot.groups[id].title:"";
  const shown=groups.filter(([id,g])=>match(layerName(id),g.name,g.label,gaps[id],...g.members,...g.controls,
    ...[...g.members,...g.controls].map(s=>snapshot.instruments[s]?.name),
    ...roles.filter(r=>[r.main,r.also].includes(id)).flatMap(r=>[r.name,r.symbol])));
  const dates=Object.keys(snapshot.marketCloses).sort(),end=snapshot.asOf;
  const start=dates[startIndex(period,dates,dates.indexOf(end),{SPY:snapshot.marketCloses})],prices=snapshot.queries.compute.rows;
  const display=roles.filter(r=>match(r.symbol,r.name,layerName(r.main),layerName(r.also),r.role));
  const [basis,setBasis]=useState("market");
  const [mobileView,setMobileView]=useState("stocks");
  const marketGross=snapshot.marketCloses[end]/snapshot.marketCloses[start];
  const ranked=roles.map(role=>{
    const close=day=>refs.series[role.symbol]?.prices[day]??prices.find(row=>row.date===day)?.[role.symbol];
    const a=close(start),b=close(end),gross=a>0&&b>0?b/a:null;
    const usd=gross===null?null:100*(gross-1);
    const relative=gross===null?null:100*(gross/marketGross-1);
    return {role,usd,relative,value:basis==="market"?relative:usd};
  }).sort((a,b)=>(b.value??-Infinity)-(a.value??-Infinity));
  const limit=Math.max(1,...ranked.map(r=>Math.abs(r.value??0)));
  const stocks=ranked.filter(r=>display.includes(r.role));
  const measured=stocks.filter(r=>r.value!==null);
  const countUp=measured.filter(r=>r.value>0).length;
  const chartLink=(r)=>snapshot.groups[r.main].members.includes(r.symbol)?"#layer-"+r.main:
    "?reference="+r.symbol+"&layer="+r.main+"&basis="+(basis==="market"?"market":"absolute")+"&period="+period+"&asof="+end+"#heatmap";
  return <section className="coverage-view heat-view">
    <nav className="cov-nav" aria-label="AI research"><a href="#map">Investor map</a><a href="#reversals">Weekly reversals</a><a href={"?period="+period+"#heatmap"}>Heatmap</a></nav>
    <header className="cov-header"><div><h1>Stock and basket coverage</h1>
      <p>Explore {groups.length} AI layers and see where individual stocks fit.</p></div>
      <label className="choice">Find a company, ticker or layer<input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="e.g. NET or cloud"/></label></header>
    <div className="cov-switch" aria-label="Coverage view">{[["stocks","Stocks in focus"],["layers","Layer baskets"]].map(([id,label])=>
      <button key={id} aria-pressed={mobileView===id} onClick={()=>setMobileView(id)}>{label}{term&&" ("+(id==="stocks"?stocks.length:shown.length)+")"}</button>)}</div>
    <div className="cov-grid" data-view={mobileView}>
      <section className="cov-panel cov-stocks"><header><h2>Stocks in focus</h2>
        <div className="cov-controls"><label>Period<select aria-label="Period" value={period} onChange={e=>setPeriod(e.target.value)}>{["wtd","peak","quarter","ytd"].map(k=><option value={k} key={k}>{periods[k]}</option>)}</select></label>
        <label>Return<select aria-label="Return" value={basis} onChange={e=>setBasis(e.target.value)}><option value="market">Versus SPY</option><option value="usd">Absolute USD</option></select></label></div></header>
        <p className="cov-read">{measured.length>0?<><b>{countUp} of {measured.length}</b> {basis==="market"?"beat the S&P 500 ETF":"gained in USD"}.</>:"No priced stocks match this selection."}</p>
        <p className="cov-source">{start?shortDate(start):"Unavailable"} – {shortDate(end)} · Yahoo Finance adjusted closes</p>
        <div className="cov-stock-row cov-axis"><span>Company</span><span className="cov-axis-labels"><span>−{limit.toFixed(1)}%</span><span>0</span><span>+{limit.toFixed(1)}%</span></span><span>Return</span></div>
        {stocks.map(({role:r,usd,relative,value})=><details className="cov-item" key={r.symbol}><summary className="cov-stock-row">
          <span className="cov-name"><b>{r.symbol}</b> <span className="cov-number">L{groups.findIndex(([id])=>id===r.main)}</span><small>{r.name}</small></span>
          <span className="cov-track" aria-hidden="true">{value!==null&&<i className={value<0?"negative":"positive"} style={{width:50*Math.abs(value)/limit+"%"}}/>}</span>
          <strong className={value>0?"gain":value<0?"loss":""}>{value===null?"N/A":signed(value)}</strong></summary>
          <div className="cov-detail"><b>{r.role}</b><p><a href={"#layer-"+r.main}>{layerName(r.main)}</a>{r.also&&<> · Also exposed to <a href={"#layer-"+r.also}>{layerName(r.also)}</a></>}</p>
          <p>{r.exposure} <a href={r.url} target="_blank" rel="noreferrer">{r.source} ↗</a></p>
          <p>{usd===null?"Insufficient price history for this period.":signed(usd)+" USD · "+signed(relative)+" versus SPY"} · <a href={chartLink(r)}>{snapshot.groups[r.main].members.includes(r.symbol)?"Basket and constituents":"Stock chart"}</a></p></div>
        </details>)}
        <footer>Returns cover the whole company. Select a stock for its exposure and source. Listings checked against Nasdaq Trader.</footer>
      </section>
      <section className="cov-panel cov-layers"><header><h2>Layer baskets</h2><small>{shown.length} of {groups.length} layers</small></header>
        <p className="cov-read">Basket members drive returns and breadth. Separate references carry zero weight.</p>
        {shown.length===0&&<p className="cov-source">No matching layer.</p>}
        {shown.map(([id,g])=>{
          const layerRoles=roles.filter(r=>[r.main,r.also].includes(id)&&!g.members.includes(r.symbol));
          return <details className="cov-item" key={id}><summary className="cov-layer-row"><span className="cov-number">L{groups.findIndex(([key])=>key===id)}</span>
            <span><b>{g.title}</b><small>{g.members.length===1?"Single-stock reference":g.name}</small></span>
            <span className="cov-tickers">{g.members.map(s=><span key={s}>{s}</span>)}</span></summary>
            <div className="cov-detail"><p><b>Benchmark</b> · {g.label} ({g.controls.join(", ")})</p>
              {layerRoles.length>0&&<p><b>Related stocks</b> · {layerRoles.map(r=>r.symbol).join(", ")}</p>}
              <p><b>Coverage gap</b> · {gaps[id]}</p><a href={"?basket="+id+"&period="+period+"&basis=own&asof="+end+"#heatmap"}>Basket chart and contributions</a></div>
          </details>;
        })}
        <footer>12 monthly equal-weight baskets and one single-stock reference. In a two-stock basket, one name changing direction shifts breadth by 50 percentage points.</footer>
      </section>
    </div>
  </section>;
}
