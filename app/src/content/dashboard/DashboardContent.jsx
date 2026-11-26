import DashboardNav from "./DashboardNav.jsx";
import React, { useEffect, useState } from "react";
import snapshot from "../../data.json";
import HistoryChart, {shortDate} from "./HistoryChart.jsx";
import TrendExport from "./TrendExport.jsx";
import "./dashboard.css";

import {WeeklyMap, WeeklyDetail, WeekControl, stockName} from "./Weekly.jsx";
import Watchlist from "./Watchlist.jsx";
import Reversals from "./Reversals.jsx";
import Coverage from "./Coverage.jsx";
import Outcomes from "./Outcomes.jsx";
import Heatmap from "./Heatmap.jsx";

const pct=v=>(v>0?"+":"")+v.toFixed(1)+"%";
const change=(end,start,key)=>100*(end[key]/start[key]-1);
const line=(key,name,colour,dash=false)=>({key,name,colour,dash});
const blue="var(--b-text)", ink="var(--t1)", red="var(--r-text)", green="var(--g-text)";
function rebase(rows,keys){
  return rows.map(row=>Object.fromEntries([["date",row.date],...keys.map(key=>[key,100*row[key]/rows[0][key]])]));
}
function Choices({label,options,value,onChange}){
  return <label className="choice">{label}<select aria-label={label} value={value} onChange={e=>onChange(e.target.value)}>{options.map(([id,text])=><option key={id} value={id}>{text}</option>)}</select></label>;
}
function Panel({snapshot,id,initialEvent="",initialStock,period,initialOutcome=false}){
  const group=snapshot.groups[id], rows=snapshot.queries[id].rows;
  const names=Object.fromEntries(group.members.map(s=>[s,stockName(snapshot,s)]));
  const [symbol,setSymbol]=useState(initialStock||group.members[0]);
  const [eventId,setEventId]=useState(initialEvent);
  const [outcome,setOutcome]=useState(initialOutcome);
  const [span,setSpan]=useState("252");
  const [mode,setMode]=useState("relative");
  const event=group.events.find(e=>e.known+e.side===eventId);
  const weekEnd=group.weeks[period].end;
  const cutoff=event?(outcome?(event.resolution && event.resolution<=weekEnd?event.resolution:weekEnd):event.known):weekEnd;
  const endIndex=rows.findIndex(row=>row.date===cutoff);
  const visible=rows.slice(Math.max(0,endIndex+1-Number(span)),endIndex+1);
  const end=visible.at(-1), prior=rows[endIndex-21];
  const basketLines=mode==="relative"?[line("ratio","Basket / benchmark",blue)]:[line("basket","Basket",ink),line("benchmark",group.label,blue,true)];
  const marks=event?[{date:event.first,symbol:"1",label:"Prior pivot"},{date:event.pivot,symbol:"2",label:"Second pivot"},{date:event.known,symbol:"◆",label:"First observable"}]:[];
  const members=group.members.map(s=>({symbol:s,ret:change(end,prior,s),peer:change(end,prior,s+"_relative"),vsBench:100*((end[s]/prior[s])/(end.benchmark/prior.benchmark)-1),exReturn:100*((end[s+"_peer"]/prior[s+"_peer"])/(end.benchmark/prior.benchmark)-1)})).sort((a,b)=>b.vsBench-a.vsBench);
  const basketRel=change(end,prior,"ratio");
  const driver=members.reduce((a,b)=>Math.abs(a.exReturn-basketRel)>Math.abs(b.exReturn-basketRel)?a:b);
  const stock=members.find(m=>m.symbol===symbol);
  const eventOptions=[["",period===0?"Latest close":"Previous week close"],...group.events.filter(e=>e.known<=weekEnd).map(e=>[e.known+e.side,e.side+" · "+shortDate(e.known)])];
  const sourceStamp=shortDate(cutoff)+" · Yahoo Finance adjusted closes";
  const marksKey=event?.known||"latest";
  const endState=event && event.resolution && event.resolution<=cutoff?event.status:"Watching";
  const extreme=event?.side==="Bullish"?"lows":"highs";
  const stockKeys=[symbol,symbol+"_peer",symbol+"_relative"];
  const stockLines=[line(symbol,names[symbol],ink),line(symbol+"_peer","Peer basket",blue,true),line(symbol+"_relative","Stock / peers","var(--p-text)")];
  const stockRows=rebase(visible,stockKeys),basketRows=rebase(visible,basketLines.map(l=>l.key));
  const levels=event && mode==="relative"?[
    {name:"Confirmation",value:100*event.trigger/visible[0].ratio,colour:green},
    {name:"Invalidation",value:100*event.boundary/visible[0].ratio,colour:red}
  ]:[];
  return <section className="panel">
    <h3>Technical history</h3>
    <div className="selectors"><Choices label="Observation" value={eventId} options={eventOptions} onChange={v=>{setEventId(v);setOutcome(false)}}/>
      <Choices label="Chart window" value={span} onChange={setSpan} options={[["63","3 months"],["126","6 months"],["252","1 year"],["9999","Full history"]]}/>
      {event ? <button className="action" onClick={()=>setOutcome(!outcome)}>{outcome?"Back to first observation":"Show subsequent outcome"}</button>
        : eventOptions.length>1 && <button className="action" onClick={()=>{setEventId(eventOptions[1][0]);setOutcome(false)}}>Replay latest divergence</button>}
    </div>
    {event && <div className="replay" role="status"><strong>{event.side} divergence · {endState}</strong>
      <p>At pivot 1 on {shortDate(event.first)}, {event.firstCount} of {group.members.length} stocks made 20-session relative {extreme}. At pivot 2 on {shortDate(event.pivot)}, the count fell to {event.secondCount} while the basket ratio made a {event.side==="Bullish"?"lower low":"higher high"}. First observable {shortDate(event.known)}.</p>
      <p>From that close, confirmation requires a ratio {event.side==="Bullish"?"above":"below"} {event.trigger.toFixed(3)}. Invalidation occurs {event.side==="Bullish"?"below":"above"} {event.boundary.toFixed(3)}. {endState==="Watching"?"The watch expires after 42 sessions.":"Outcome recorded "+shortDate(event.resolution)+"."}</p></div>}
    <div className="analysis-grid"><section className="chart-card"><h4>Basket performance</h4>
      <div className="chart-inner"><div className="metric-line"><strong className={basketRel<0?"loss":"gain"}>{pct(basketRel)}</strong><span>relative over 21 sessions</span></div>
      <div className="toggle" aria-label="Basket chart measure">{[["relative","Relative"],["absolute","Absolute"]].map(([key,label])=><button key={key} aria-pressed={mode===key} onClick={()=>setMode(key)}>{label}</button>)}</div>
      <HistoryChart key={marksKey+mode} rows={basketRows} lines={basketLines} marks={marks} levels={levels} title="Basket performance rebased to 100"/>
      <TrendExport title={group.name} basis={mode==="relative"?"Relative return versus "+group.label:"Absolute USD returns · basket and "+group.label}
        rows={basketRows} lines={basketLines} history={rows} primary={basketLines[0].key} averageOf={mode==="relative"?"the basket / benchmark ratio":"the USD basket"}
        seriesId={id} basisId={mode} marks={marks} levels={levels}/>
      {levels.length>0 && <p className="basis">Indexed levels · confirmation {levels[0].value.toFixed(1)} · invalidation {levels[1].value.toFixed(1)}.</p>}
      <p className="basis">Indexed to 100 at window start. 21-session absolute returns: basket {pct(change(end,prior,"basket"))}, benchmark {pct(change(end,prior,"benchmark"))}.</p>
      <small>{sourceStamp}</small></div></section>
    <section className="chart-card"><h4>Participation and breadth</h4>
      <div className="chart-inner"><div className="metric-line"><strong>{end.winners} / {group.members.length}</strong><span>outperformed over 21 sessions</span></div>
      <HistoryChart key={marksKey} rows={visible} countMax={group.members.length} marks={marks} title="Constituent counts at 20-session relative extremes" lines={[line("highs","At relative highs",green),line("lows","At relative lows",red,true)]}/>
      <p className="basis">Each line counts constituents at a 20-session high or low against {group.label}. Removing {driver.symbol} changes the basket’s 21-session relative return to {pct(driver.exReturn)}.</p>
      <small>{sourceStamp}</small></div></section></div>
    <section className="stock-detail"><div className="detail-heading"><div><h3>Single-stock drill-down</h3><p className="basis">{shortDate(cutoff)} · Shares compared with the remaining names in this basket.</p></div>
      <Choices label="Stock" value={symbol} onChange={setSymbol} options={group.members.map(s=>[s,names[s]+" · "+s])}/></div>
      <div className="stock-grid"><div className="roster"><div className="stock-row row-head"><span>Constituent</span><span>Absolute</span><span>vs peers</span></div>
      {members.map(m=><button key={m.symbol} className="stock-row" aria-pressed={symbol===m.symbol} onClick={()=>setSymbol(m.symbol)}><span>{names[m.symbol]}<small>{m.symbol}</small></span><span>{pct(m.ret)}</span><span className={m.peer<0?"loss":"gain"}>{pct(m.peer)}</span></button>)}
      <small>21-session USD returns · peers exclude the selected stock</small></div>
      <div><h4>{names[symbol]} <small>{symbol}</small></h4><p className="basis">Absolute {pct(stock.ret)} · relative to peers {pct(stock.peer)}</p>
      <HistoryChart key={marksKey+symbol} title={names[symbol]+" against peers and relative to peers"} rows={stockRows} marks={marks} lines={stockLines}/>
      <TrendExport title={names[symbol]+" · "+symbol} basis={"Absolute USD returns and relative return versus the remaining "+group.name+" stocks"}
        rows={stockRows} lines={stockLines} history={rows} primary={symbol} averageOf={symbol+" in USD"} seriesId={symbol} basisId="peers" marks={marks}/>
      <small>Indexed to 100 · {sourceStamp}</small></div></div></section>
    <div className="diligence"><h3>Private-company diligence</h3><p>{group.question}</p></div>
    <details className="methods"><summary>Data and methodology</summary><p>USD dividend- and split-adjusted closes. Monthly equal weights reset after the final close of each month and drift between resets. Relative return is the percentage change in the wealth ratio. The removal test excludes the name whose omission most changes the 21-session result.</p>
      <p>Historical reconstruction uses the selected roster from its first common close, {shortDate(rows[0].date)}. This is descriptive research with hindsight-selected constituents. Ratios use closing prices. Each strict pivot requires two sessions on either side. Signals compare successive same-side pivots and the counts at those pivots. A watch resolves on the first confirming or invalidating close, or expires after 42 sessions.</p>
      <p>Basket: {group.members.join(", ")}. Benchmark: {group.controls.join(", ")}. Sector ETFs can hold some basket members. All prices come from one provider. Ticker identities were checked against exchange listings.</p>
      <a href={snapshot.instruments[symbol].url}>Price series for {symbol}</a> · <a href={snapshot.instruments[symbol].listingSource}>Nasdaq Trader listing directory</a></details>
    <details className="methods"><summary>Chart values by session</summary><div className="data-scroll"><table><thead><tr><th>Session</th><th>Basket ratio¹</th><th>Highs</th><th>Lows</th><th>{symbol} USD²</th></tr></thead><tbody>{[...visible].reverse().map(r=><tr key={r.date}><td>{r.date}</td><td>{r.ratio.toFixed(3)}</td><td>{r.highs??"—"}</td><td>{r.lows??"—"}</td><td>{r[symbol].toFixed(2)}</td></tr>)}</tbody></table></div><small>¹ Wealth ratio from basket inception. ² Adjusted close.</small></details>
  </section>;
}
function ReferenceHistory({snapshot,id,period}){
  const g=snapshot.groups[id], symbol=g.members[0], last=g.weeks[period].end;
  const [span,setSpan]=useState("252");
  const visible=snapshot.queries[id].rows.filter(row=>row.date<=last).slice(-Number(span));
  const rows=rebase(visible,["basket","benchmark","ratio"]),lines=[line("basket",symbol,ink),line("benchmark",g.label,blue,true),line("ratio","Stock / sector","var(--p-text)")];
  return <section className="reference"><h3>Reference price history</h3>
    <Choices label="Chart window" value={span} onChange={setSpan} options={[["63","3 months"],["126","6 months"],["252","1 year"],["9999","Full history"]]}/>
    <section className="chart-card"><h4>Meta and its sector benchmark</h4>
      <HistoryChart rows={rows} title="Meta and its benchmark indexed to 100" lines={lines}/>
      <TrendExport title={g.name+" · "+symbol} basis={"Absolute USD returns and relative return versus "+g.label}
        rows={rows} lines={lines} history={snapshot.queries[id].rows} primary="basket" averageOf={symbol+" in USD"} seriesId={symbol} basisId="sector"/>
      <small>USD adjusted closes · indexed to 100 at the window start · Yahoo Finance · {shortDate(last)}</small>
    </section>
    <div className="diligence"><h3>Private-company diligence</h3><p>{g.question}</p></div>
    <a href={snapshot.instruments[symbol].url}>Meta price series</a> · <a href={snapshot.instruments[symbol].listingSource}>Listing directory</a></section>;
}

export function DashboardContent(){

  const replay=window.location.hash==="#network-replay";
  const linked=window.location.hash.replace(/^#layer-/,"");
  const [active,setActive]=useState(replay?"network":Object.hasOwn(snapshot.groups,linked)?linked:null);
  const [period,setPeriod]=useState(0);
  const [watch,setWatch]=useState(window.location.hash==="#watchlist");
  const isStudy=hash=>["#outcomes","#outcomes-exhaustion"].includes(hash);
  const [study,setStudy]=useState(isStudy(window.location.hash));
  const [review,setReview]=useState(window.location.hash);
  const [selection,setSelection]=useState({event:replay?"2026-10-27Bullish":"",stock:null,version:0});
  useEffect(()=>{
    function navigate(){
      const hash=window.location.hash;
      setReview(hash);
      setStudy(isStudy(hash));
      setWatch(hash==="#watchlist");
      const key=hash.replace(/^#layer-/,"");
      setActive(hash==="#network-replay"?"network":Object.hasOwn(snapshot.groups,key)?key:null);
      setSelection(previous=>({event:hash==="#network-replay"?"2026-10-27Bullish":"",stock:null,version:previous.version+1}));
      window.scrollTo(0,0);
    }
    window.addEventListener("hashchange",navigate);
    return ()=>window.removeEventListener("hashchange",navigate);
  },[snapshot.groups]);
  function overview(toWatch){
    setActive(null);
    setWatch(toWatch);
    window.location.hash=toWatch?"watchlist":"map";
    window.scrollTo(0,0);
  }
  function pick(id,stock=null,event="",showOutcome=false){
    setSelection(previous=>({stock,event,showOutcome,version:previous.version+1}));
    setActive(id);
    requestAnimationFrame(()=>{
      if(stock) document.querySelector(".stock-detail")?.scrollIntoView();
      else if(event) document.querySelector(".panel")?.scrollIntoView();
      else window.scrollTo(0,0);
    });
  }
  const group=snapshot.groups[active];
  if(review==="#reversals")return <article className="ai-monitor"><Reversals snapshot={snapshot}/></article>;
  if(review==="#coverage")return <article className="ai-monitor"><Coverage snapshot={snapshot}/></article>;
  if(!review||review==="#heatmap")return <article className="ai-monitor"><Heatmap snapshot={snapshot}/></article>;
  if(study)return <article className="ai-monitor"><Outcomes snapshot={snapshot}/></article>;
  return <article className="ai-monitor">{!group?(watch?<Watchlist snapshot={snapshot} period={period} onPeriod={setPeriod} onPick={pick}/>:<WeeklyMap snapshot={snapshot} period={period} onPeriod={setPeriod} onPick={pick}/>):<>
    <DashboardNav active={watch?"watchlist":"map"} onReturn={()=>overview(watch)}/>
    <div className="mast"><WeekControl period={period} onChange={n=>{setPeriod(n);pick(active)}}/></div>
    <div className="section-head"><small>L{Object.keys(snapshot.groups).indexOf(active)} · {group.title}</small><h2>{group.name}</h2>
      {group.members.length>1 && <p className="basis">{group.context}</p>}</div>
    <WeeklyDetail snapshot={snapshot} id={active} period={period} onPickStock={s=>pick(active,s)} onPickEvent={(event,showOutcome)=>pick(active,null,event,showOutcome)}/>
    {group.members.length===1?<ReferenceHistory snapshot={snapshot} id={active} period={period}/>:<Panel key={active+selection.version} snapshot={snapshot} id={active} period={period} initialStock={selection.stock} initialEvent={selection.event} initialOutcome={selection.showOutcome}/>}
  </>}</article>;
}
