import DashboardNav from "./DashboardNav.jsx";
import React,{useEffect,useMemo,useRef,useState} from "react";
import {shortDate} from "./HistoryChart.jsx";
import {periods,onOrBefore,startIndex,performance} from "./heatmap-data.mjs";
import HeatDrivers,{SignalDrivers} from "./HeatDrivers.jsx";
import {roles} from "./stock-roles.mjs";
import {rowIndex,referenceWindow,layerReferences} from "./reference-review.js";
import {PeriodInsight,StockLookup} from "./PeriodInsight.jsx";
import LayerTrend from "./LayerTrend.jsx";
import InvestorContext from "./InvestorContext.jsx";
import HeatmapExport from "./HeatmapExport.jsx";
import {subtitles} from "./investor-context.mjs";

const pct=x=>(x>0?"+":"")+x.toFixed(1)+"%";
const standard=[["peak","Since market high"],["wtd","WTD"],["week","1W"],["month","1M"],["quarter","3M"],["half","6M"],["ytd","YTD"],["year","1Y"]];
const defaultHidden=["wtd","half","year"];
const columnsKey="ai-stack-monitor.hidden-periods.v1";
const rowBasisKey="ai-stack-monitor.show-row-basis.v1";
const bases=[
  ["absolute","Absolute return (USD)","Show each basket or stock’s own return in US dollars. Positive means it gained in value."],
  ["market","S&P 500 (SPY)","Compare every basket and reference stock with SPY over the same dates. Positive means it beat the S&P 500 ETF."],
  ["own","Layer benchmarks (sector ETF or peer basket)","Compare each basket and its reference stocks with that layer’s benchmark. Positive means outperformance, even when both fell in USD."]
];
function RowBasis({basis,group}){
  if(basis==="absolute")return null;
  const layer=basis==="own",basket=layer&&group.controls.length>1;
  return <span className="row-basis"><b>Benchmark</b> {layer?group.label:"S&P 500"} · {layer?group.controls.join(" / "):"SPY"}{basket&&<span>Equal-weighted monthly</span>}</span>;
}
function savedHiddenPeriods(){
  try{
    const saved=JSON.parse(localStorage.getItem(columnsKey));
    return Array.isArray(saved)?standard.map(([key])=>key).filter(key=>saved.includes(key)):defaultHidden;
  }catch{return defaultHidden;}
}
function colours(n){
  if(n===null||Math.abs(n)<0.05)return "heat-flat";
  const size=Math.abs(n);
  const band=size>=15?" deep":size>=5?" solid":size>=2?" strong":"";
  return (n>0?"heat-up":"heat-down")+band;
}
function Select({label,value,set,opts}){
  return <label className="choice">{label}<select aria-label={label} value={value} onChange={e=>set(e.target.value)}>{opts.map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>;
}
function revealInlinePanel(){
  const panel=document.querySelector(".inline-panel");
  if(!panel)return;
  panel.focus({preventScroll:true});
  panel.querySelector(".inline-heading").scrollIntoView({block:"start",inline:"nearest"});
}
export default function Heatmap({snapshot}){
  const [period,setPeriod]=useState(()=>{
    const key=new URLSearchParams(window.location.search).get("period");
    return Object.hasOwn(periods,key)&&key!=="custom"?key:"peak";
  });
  const [endDate,setEnd]=useState(()=>{
    const date=new URLSearchParams(window.location.search).get("asof");
    return Object.hasOwn(snapshot.marketCloses,date)?date:snapshot.asOf;
  });
  const [custom,setCustom]=useState("");
  const [mode,setMode]=useState("prices"),[h,setH]=useState("21");
  const [basis,setBasis]=useState(()=>{
    const requested=new URLSearchParams(window.location.search).get("basis");
    return bases.some(([key])=>key===requested)?requested:"absolute";
  });
  const [selected,setSelected]=useState(()=>new URLSearchParams(window.location.search).get("basket"));
  const [showReferences,setShowReferences]=useState(()=>new URLSearchParams(window.location.search).has("reference"));
  const [descriptions,setDescriptions]=useState(true);
  const [showRowBasis,setShowRowBasis]=useState(()=>{
    try{return localStorage.getItem(rowBasisKey)!=="false";}catch{return true;}
  });
  const [hidden,setHidden]=useState(savedHiddenPeriods);
  const [chartSymbol,setChartSymbol]=useState(null);
  function saveHidden(next){
    setHidden(next);
    try{localStorage.setItem(columnsKey,JSON.stringify(next));}catch{/* The current view still retains the choice. */}
  }
  const [reference,setReference]=useState(()=>{
    const params=new URLSearchParams(window.location.search),id=params.get("layer");
    const role=roles.find(r=>r.symbol===params.get("reference")&&(r.main===id||r.also===id));
    return role&&snapshot.groups[id]&&!snapshot.groups[id].members.includes(role.symbol)?{id,role}:null;
  });
  const [signalCell,setSignalCell]=useState(null);
  const rowOpener=useRef(null);
  const tableRef=useRef(null);
  useEffect(()=>{
    const params=new URLSearchParams(window.location.search);
    if(params.has("reference")||params.has("basket")){
      const frame=requestAnimationFrame(revealInlinePanel);
      return ()=>cancelAnimationFrame(frame);
    }
  },[]);
  const {dates,series,byDate}=useMemo(()=>{
    const market=snapshot.marketCloses,days=Object.keys(market).sort();
    const index=rowIndex(snapshot);
    const tech=Object.fromEntries(snapshot.queries.network.rows.map(r=>[r.date,r.XLK]));
    return {dates:days,series:{SPY:market,XLK:tech},byDate:index};
  },[snapshot]);
  const ei=onOrBefore(dates,endDate),end=dates[ei];
  const peakIndex=startIndex("peak",dates,ei,series,"");
  const startInput=custom||dates[peakIndex]||dates[0];
  const indexFor=key=>startIndex(key,dates,ei,series,startInput);
  const start=dates[indexFor(period)];
  const valid=Boolean(start&&end&&endDate<=snapshot.asOf&&endDate>=dates[0]&&start<=end&&
    (period!=="custom"||(startInput>=dates[0]&&startInput<=endDate)));
  const groups=Object.entries(snapshot.groups);
  function result(id,key){
    const from=dates[indexFor(key)];
    if(!from||!end||from>end)return null;
    return performance(snapshot.groups[id],byDate[id].get(from),byDate[id].get(end),series.SPY[end]/series.SPY[from],basis);
  }
  function referenceResult(id,role,key){
    const from=dates[indexFor(key)];
    return referenceWindow(snapshot,byDate,id,role,from,end,basis);
  }
  const ranked=valid?groups.filter(([,g])=>g.members.length>1).map(([id,g])=>({id,name:g.name,r:result(id,period)})).filter(x=>x.r).sort((a,b)=>b.r.value-a.r.value):[];
  const fixed=standard.filter(([key])=>key!==period&&!hidden.includes(key));
  const columns=[[period,periods[period]],...fixed];
  const cohorts=[["Bullish","observed","Bullish · first"],["Bullish","confirmed","Bullish · confirmed"],["Bearish","observed","Exhaustion · first"],["Bearish","confirmed","Exhaustion · confirmed"]];
  const bucket=new Map();
  if(valid&&mode==="signals")for(const r of snapshot.forwardReturns){
    if(r.lag!==1||r.horizon!==Number(h)||r.anchor<start||r.anchor>end)continue;
    const key=[r.layer,r.side,r.stage].join("/");
    let cell=bucket.get(key);if(!cell){cell={sum:0,n:0,total:0,events:[]};bucket.set(key,cell);}
    cell.total++;
    if(r.end&&r.end<=end){cell.n++;cell.sum+=r.value;cell.events.push(r);}
  }
  function selectCell(id,key,opener=null){
    rowOpener.current=opener;
    setReference(null);setSelected(id);setPeriod(key);setChartSymbol(null);
    requestAnimationFrame(revealInlinePanel);
  }
  function selectReference(id,role,key,opener=null){
    rowOpener.current=opener;
    setSelected(null);setPeriod(key);setReference({id,role});setChartSymbol(null);
    requestAnimationFrame(revealInlinePanel);
  }
  function backToCell(){
    (rowOpener.current??document.querySelector('[data-heat-cell="'+selected+'-'+period+'"]'))?.focus();
    setSelected(null);
  }
  const cellBasis=basis==="absolute"?"absolute return":basis==="market"?"return versus SPY":"return versus the layer benchmark";
  function expandedRow(id,role=null){
    const back=role?()=>{
      (rowOpener.current??document.querySelector('[data-reference-cell="'+[id,role.symbol,period].join("-")+'"]'))?.focus();
      setReference(null);
    }:backToCell;
    return <tr className="expanded-row"><td colSpan={columns.length+1}><div className="inline-panel" tabIndex="-1" onKeyDown={e=>{if(e.key==="Escape")back();}}>
      <div className="inline-heading"><div><h3>{role?role.name:snapshot.groups[id].name}</h3><p>{role?role.exposure:subtitles[id]}</p></div><button className="action" onClick={back}>Close detail</button></div>
      <div className="inline-grid"><LayerTrend key={id+(role?.symbol||"")} {...{snapshot,id,role,basis,start,end}} series={chartSymbol??role?.symbol??"basket"} onSeriesChange={setChartSymbol}/>
        {role?<ReferenceDetail group={snapshot.groups[id]} role={role} result={referenceResult(id,role,period)} {...{start,end,basis}} onBack={back}/>:
        <HeatDrivers key={id} {...{snapshot,id,period,start,end,basis}} peak={dates[peakIndex]} week={dates[indexFor("wtd")]} onBack={back}
          onStock={symbol=>{setChartSymbol(symbol);document.querySelector(".inline-grid .layer-trend svg")?.focus();}}/>}</div>
    </div></td></tr>;
  }
  const eligibleSignals=[...bucket.values()].reduce((n,r)=>n+r.n,0);
  return <section className="heat-view"><DashboardNav active="heatmap" links={{reversals:"?asof="+(end||snapshot.asOf)+"#reversals"}}/><h1>AI stack heatmap</h1>
    <div className="selectors"><Select label="Show" value={mode} set={setMode} opts={[["prices","Basket performance"],["signals","Historical signal outcomes"]]}/>
      <Select label="Period" value={period} set={setPeriod} opts={Object.entries(periods)}/>
      {period==="custom"&&<label className="choice">Start date<input aria-label="Start date" type="date" min={dates[0]} max={endDate} value={startInput} onChange={e=>setCustom(e.target.value)}/></label>}
      <label className="choice">End date<input aria-label="End date" type="date" min={dates[0]} max={snapshot.asOf} value={endDate} onChange={e=>setEnd(e.target.value)}/></label>
      {mode==="prices"?null:
        <Select label="Forward window" value={h} set={setH} opts={[["5","5 sessions"],["21","21 sessions"],["63","63 sessions"]]}/>}</div>
    {!valid?<p role="status">Choose a start and end within the available history. The start must be on or before the end and have an available baseline close.</p>:<>
      <h2>{periods[period]} · {shortDate(start)} to {shortDate(end)}</h2>
      <p className="basis">{period==="peak"||period==="tech"?("Latest "+(period==="peak"?"SPY":"XLK")+" adjusted closing high in the trailing "+Math.min(ei+1,252)+" sessions. "):""}S&amp;P 500 ETF {pct(100*(series.SPY[end]/series.SPY[start]-1))} over {ei-indexFor(period)} US sessions · Yahoo Finance adjusted closes.{start===end?" The selected period starts and ends at the same close.":""}</p>
      {mode==="prices"?<>
        <InvestorContext {...{ranked,start,end}} groups={snapshot.groups} label={cellBasis} select={id=>selectCell(id,period)}/>
        <p className="basis">Cells show {cellBasis}. Green is positive and red is negative. Colour deepens at 2%, 5% and 15% in either direction. Select a cell to compare stock contributions over two periods. WTD starts at the previous week’s final close.</p>
        <div className="selectors">{basis!=="absolute"&&<label className="reference-toggle"><input type="checkbox" checked={showRowBasis} onChange={e=>{
            const checked=e.target.checked;setShowRowBasis(checked);try{localStorage.setItem(rowBasisKey,String(checked));}catch{/* Retain the choice for this view. */}
          }}/> Show return basis in rows</label>}
          <label className="reference-toggle"><input type="checkbox" checked={showReferences} onChange={e=>{setShowReferences(e.target.checked);setReference(null);}}/> Show reference stocks under their layers</label>
          <label className="reference-toggle"><input type="checkbox" checked={descriptions} onChange={e=>setDescriptions(e.target.checked)}/> Layer descriptions</label>
          <details className="column-picker" open><summary>Columns</summary><fieldset><legend>Comparison periods</legend>
            {standard.map(([key,label])=><label key={key}><input type="checkbox" checked={key===period||!hidden.includes(key)} disabled={key===period}
              onChange={e=>saveHidden(e.target.checked?hidden.filter(x=>x!==key):[...hidden,key])}/>{label}{label!==periods[key]&&" · "+periods[key]}{key===period?" (active)":""}</label>)}
            <button type="button" className="action" onClick={()=>saveHidden(defaultHidden)}>Restore default columns</button>
            <button type="button" className="action" onClick={()=>saveHidden([])}>Show all periods</button>
          </fieldset></details><HeatmapExport tableRef={tableRef} period={period} start={start} end={end} basis={basis}/></div>
        {showReferences&&<p className="basis reference-guide">A reference confirms when both returns have the same sign and diverges when their signs differ. Flat means either move is below 0.05% in magnitude. Select a reference cell for the return gap. References have zero weight in the layer shown.</p>}
        {showReferences&&<details><summary>How are reference stocks selected?</summary><p className="basis">Each company is selected for a documented business exposure that helps interpret a layer. A second layer is included when another product or business line gives a distinct comparison. A company can be a basket member in one layer and a reference in another. Performance determines the comparison after selection. <a href="#coverage">See each company’s role and source.</a></p></details>}
        <fieldset className="basis-control"><legend>Compare returns</legend><div className="basis-options">
          {bases.map(([key,label])=><label key={key}><input name="heatmap-return-basis" type="radio" value={key} checked={basis===key}
            onChange={()=>setBasis(key)} aria-describedby="basis-explanation"/>{label}</label>)}</div>
          <p className="basis" id="basis-explanation">{bases.find(([key])=>key===basis)[2]}</p></fieldset>
        <div className="heat-scroll" tabIndex="0" aria-label="Performance heatmap, scroll horizontally for more periods"><table ref={tableRef} className="heat-table price-table" style={{"--period-count":fixed.length}}>
        <caption>Through {shortDate(end)} · {basis==="absolute"?"USD returns":basis==="market"?"Returns versus SPY":"Returns versus each layer’s benchmark"} · Yahoo Finance adjusted closes</caption>
        <thead><tr><th scope="col">Layer / basket</th>{columns.map(([key,label])=><th scope="col" key={key}>{label}{key===period&&<small className="period-start">From {shortDate(start)}</small>}</th>)}</tr></thead>
        <tbody>{groups.map(([id,g],i)=><React.Fragment key={id}><tr><th scope="row"><button type="button" className="row-name" disabled={!result(id,period)}
          aria-label={g.name+" · "+periods[period]+" details"} aria-expanded={selected===id} onClick={e=>selectCell(id,period,e.currentTarget)}>L{i} · {g.name}{g.members.length===1?"¹":""}</button>
          {showRowBasis&&<RowBasis basis={basis} group={g}/>}
          {descriptions&&<small className="layer-caption">{subtitles[id]}</small>}</th>{columns.map(([key])=>{
          const cell=result(id,key);return <td key={key} className={colours(cell?.value??null)}>{cell?<button data-heat-cell={id+"-"+key} aria-pressed={selected===id&&period===key} aria-controls="heat-drivers" aria-label={g.name+" · "+periods[key]+" · "+pct(cell.value)} onClick={()=>selectCell(id,key)}>{pct(cell.value)}</button>:"—"}</td>;
        })}</tr>{!reference&&selected===id&&expandedRow(id)}{showReferences&&layerReferences(id,g).map(role=>
          <React.Fragment key={role.symbol}><tr className="reference-row" data-reference-row={id+"-"+role.symbol}><th scope="row"><button type="button" className="row-name" disabled={!referenceResult(id,role,period)}
            aria-label={role.name+" vs "+g.name+" · "+periods[period]+" details"} aria-expanded={reference?.id===id&&reference.role.symbol===role.symbol}
            onClick={e=>selectReference(id,role,period,e.currentTarget)}>{role.name} · {role.symbol}</button><small>{g.controls.includes(role.symbol)?"Benchmark member":"Reference"}{role.also===id?" · secondary exposure":""}</small>{showRowBasis&&<RowBasis basis={basis} group={g}/>}</th>
          {columns.map(([key])=>{
            const r=referenceResult(id,role,key);
            return <td key={key} className={colours(r?.stock??null)}>{r?<button type="button" data-reference-cell={[id,role.symbol,key].join("-")}
              aria-pressed={reference?.id===id&&reference.role.symbol===role.symbol&&period===key} aria-controls="reference-detail"
              aria-label={role.name+" vs "+g.name+" · "+periods[key]+" · "+pct(r.stock)+" · "+r.status}
              onClick={()=>selectReference(id,role,key)}>{pct(r.stock)}<small>{r.status}</small></button>:<span aria-label="Insufficient common price history" title="Insufficient common price history">—</span>}</td>;
          })}</tr>{reference?.id===id&&reference.role.symbol===role.symbol&&expandedRow(id,role)}</React.Fragment>)}</React.Fragment>)}</tbody></table></div>
        <PeriodInsight ranked={ranked} snapshot={snapshot} index={byDate} start={start} end={end} week={dates[indexFor("wtd")]} basis={basis}/>
        <StockLookup snapshot={snapshot} index={byDate} start={start} end={end} basis={basis}/>
      </>:<>
        <p className="heat-summary">{eligibleSignals?eligibleSignals+" completed stage observations. A confirmed flag can appear in both stages.":"No forward window has matured for flags in this period."}</p>
        <p className="basis">Flags enter on their observation or confirmation date within the selected period. Each cell shows mean basket-relative return from the following close and completed / eligible count. Negative returns support exhaustion.</p>
        <div className="heat-scroll" tabIndex="0" aria-label="Signal heatmap, scroll horizontally for all stages"><table className="heat-table"><thead><tr><th>Layer / basket</th>{cohorts.map(([, ,label])=><th key={label}>{label}</th>)}</tr></thead><tbody>{groups.map(([id,g],i)=><tr key={id}><th scope="row">L{i} · {g.name}{g.members.length===1?"¹":""}</th>{cohorts.map(([side,stage])=>{
          const v=bucket.get([id,side,stage].join("/")),mean=v?.n?v.sum/v.n:null;
          const key=[id,side,stage].join("/");
          return <td key={side+stage} className={colours(mean)} data-signal-cell={id+"-"+side+"-"+stage}>{mean===null?"—":<button aria-label={g.name+" · "+side+" · "+stage+" · "+pct(mean)} aria-pressed={signalCell?.key===key} onClick={()=>{setSignalCell({id,side,stage,key});requestAnimationFrame(()=>document.getElementById("signal-drivers")?.focus());}}>{pct(mean)}</button>}<small>{v?.n||0} / {v?.total||0}</small></td>;
        })}</tr>)}</tbody></table></div>
        {signalCell&&bucket.get(signalCell.key)?.n>0&&<SignalDrivers key={signalCell.key} snapshot={snapshot} {...{id:signalCell.id,side:signalCell.side,stage:signalCell.stage}} events={bucket.get(signalCell.key).events} onBack={()=>{document.querySelector('[data-signal-cell="'+[signalCell.id,signalCell.side,signalCell.stage].join("-")+'"] button')?.focus();setSignalCell(null);}}/>}
        <a className="action" href="#outcomes">Compare confirmation and switching costs →</a></>}
      <p className="basis">¹ Meta is the single foundation-model reference. Basket rankings and breadth signals require multiple constituents. A dash indicates unavailable history or an empty sample. Week and month lookbacks use 5 and 21 trading sessions. Calendar dates between sessions use the preceding close.</p>
    </>}</section>;
}

function ReferenceDetail({group,role,result,start,end,basis,onBack}){
  const label=basis==="absolute"?"Absolute USD return":"Return versus "+(basis==="market"?"SPY":group.label);
  const format=n=>(n>0?"+":"")+n.toFixed(2);
  return <section id="reference-detail" className="heat-drivers" tabIndex="-1" data-reviewed-rows>
    <div className="watch-heading"><div><small>{shortDate(start)} – {shortDate(end)} · {label}</small>
      <h3>{role.name} alongside {group.name}</h3></div><button className="action" onClick={onBack}>Back to heatmap</button></div>
    {result?<><p><b>{result.status}</b> · {role.symbol} {format(result.stock)}% · {group.name} {format(result.basket)}%</p>
      <p>Stock minus layer return · <b>{format(result.gap)} percentage points</b></p></>:<p>Insufficient common price history for this period.</p>}
    <small>Yahoo Finance adjusted closes · same opening and closing sessions</small>
  </section>;
}
