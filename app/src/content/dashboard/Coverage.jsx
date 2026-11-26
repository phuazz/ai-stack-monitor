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
  return <section className="coverage-view heat-view"><a className="action" href="#map">← Investor map</a> <a className="action" href="#reversals">Weekly reversals →</a> <a className="action" href={"?period="+period+"#heatmap"}>Compare references in the heatmap →</a>
    <h1>Stock and basket coverage</h1><p>Each layer names the business its basket measures and the exposures it misses. Only basket members contribute to the layer’s returns and breadth. The roles describe current products. Returns cover the whole company, and its AI share of revenue can change over time.</p>
    <label className="choice">Find a company, ticker or layer<input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="e.g. Cloudflare, SHOP or networking"/></label>
    {display.length>0&&<><h2>Stocks in focus</h2><label className="choice">Stock return period<select value={period} onChange={e=>setPeriod(e.target.value)}>{["wtd","peak","quarter","ytd"].map(k=><option value={k} key={k}>{periods[k]}</option>)}</select></label>
    <p className="basis">Individual USD returns · {start?shortDate(start):"Unavailable"} – {shortDate(end)} · Yahoo Finance adjusted closes, listings checked against Nasdaq Trader.</p>
    <div className="coverage-cards">{display.map(r=>{
      const price=day=>refs.series[r.symbol]?.prices[day]??prices.find(p=>p.date===day)?.[r.symbol];
      const a=price(start),b=price(end),marketGross=snapshot.marketCloses[end]/snapshot.marketCloses[start];
      return <article key={r.symbol}><small>{r.role}</small><h3>{r.name} · {r.symbol}</h3><b>{a&&b?signed(100*(b/a-1)):"Unavailable"} absolute</b>
        <div>{a&&b?signed(100*(b/a/marketGross-1)):"Unavailable"} versus SPY</div>
        <p><a href={"#layer-"+r.main}>{layerName(r.main)}</a>{r.also&&<><br/>Also exposed to <a href={"#layer-"+r.also}>{layerName(r.also)}</a></>}</p>
        <p>{r.exposure} <a href={r.url} target="_blank" rel="noreferrer">{r.source} ↗</a></p></article>;
    })}</div></>}
    <h2>Basket coverage by layer</h2><p>The largest gaps for a private-market investor are model providers, memory and custom chips, and the economics of renting data-centre capacity. Meta includes advertising, the GPU basket omits memory, and power-equipment sales measure supplier orders while landlords earn rent.</p>
    {shown.length===0&&<p>No matching company or layer in this map.</p>}
    {shown.map(([id,g])=><article className="coverage-row" key={id}><h3><a href={"#layer-"+id}>{layerName(id)}</a></h3>
      <p><b>{g.name}</b> · {g.members.join(", ")}{g.members.length===1?" · Single-stock reference":""}<br/>
      Benchmark · {g.controls.join(", ")} ({g.label})</p><p><b>Coverage gap</b> · {gaps[id]}</p></article>)}
    <p className="basis">The 13 layers form an investor map. The 12 baskets are selected peer groups, with monthly equal weighting. A layer with two members changes its participation rate by 50 percentage points when one member changes direction. Separate references have zero basket weight.</p>
  </section>;
}
