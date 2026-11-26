import React, {useEffect, useMemo, useRef, useState} from "react";
import {calendarTicks} from "./calendar-ticks.mjs";
import {language} from "../../locale.js";

export function shortDate(date) {
  // ISO dates carry an explicit UTC time. JavaScript numeric months are zero-indexed.
  return new Intl.DateTimeFormat(language()==="zh-CN"?"zh-CN":"en-GB", {day:"numeric",month:"short",year:"numeric",timeZone:"UTC"}).format(new Date(date+"T12:00:00Z"));
}

export default function HistoryChart({rows, lines, title, marks=[], levels=[], countMax, zero=100}) {
  const ref=useRef(null);
  const [width,setWidth]=useState(580);
  const [hover,setHover]=useState(null);
  useEffect(()=>{
    const observer=new ResizeObserver(([box])=>setWidth(Math.max(190,box.contentRect.width)));
    observer.observe(ref.current);
    return ()=>observer.disconnect();
  },[]);
  const count=countMax!==undefined;
  const height=count?137:190, left=39, right=12, top=16, bottom=height-26;
  const values=lines.flatMap(line=>rows.map(row=>row[line.key]).filter(Number.isFinite));
  const low=count?0:Math.floor(Math.min(zero,...values)/5)*5;
  const high=count?countMax:Math.max(low+5,Math.ceil(Math.max(zero,...values)/5)*5);
  const x=i=>left+(width-left-right)*i/Math.max(1,rows.length-1);
  const y=v=>bottom-(bottom-top)*(v-low)/(high-low);
  const ticks=count?[0,countMax]:[low,(high+low)/2,high];
  const selected=hover===null?null:rows[Math.min(hover,rows.length-1)];
  const readout=selected||rows.at(-1);
  const lang=language();
  const dateTicks=useMemo(()=>calendarTicks(rows,width-left-right,lang),[rows,width,left,right,lang]);
  function path(key) {
    let connected=false;
    return rows.map((row,i)=>{
      if(!Number.isFinite(row[key])){connected=false;return "";}
      const point=(connected?"L":"M")+x(i).toFixed(2)+" "+y(row[key]).toFixed(2);
      connected=true;
      return point;
    }).join(" ");
  }
  return <div className="history" ref={ref}>
    <div className="keys">{lines.map(line=><span key={line.key}><i style={{borderColor:line.colour,borderTopStyle:line.dash?"dashed":"solid"}}/>{line.name}</span>)}</div>
    <svg role="img" aria-label={title} tabIndex="0" width="100%" height={height} viewBox={`0 0 ${width} ${height}`}
      onKeyDown={e=>{if(e.key==="ArrowLeft"||e.key==="ArrowRight"){e.preventDefault();setHover(i=>Math.max(0,Math.min(rows.length-1,(i??rows.length-1)+(e.key==="ArrowLeft"?-1:1))));}}}
      onBlur={()=>setHover(null)}
      onPointerMove={e=>{const bounds=e.currentTarget.getBoundingClientRect();setHover(Math.max(0,Math.min(rows.length-1,Math.round((e.clientX-bounds.left-left)/(width-left-right)*(rows.length-1)))));}}
      onPointerLeave={()=>setHover(null)}>
      {ticks.map(v=><g key={v}><line x1={left} x2={width-right} y1={y(v)} y2={y(v)} className="gridline"/><text x={left-6} y={y(v)+4} textAnchor="end">{Number(v.toFixed(1))}</text></g>)}
      {!count && low<zero && high>zero && <line x1={left} x2={width-right} y1={y(zero)} y2={y(zero)} stroke="var(--bd-strong)" strokeDasharray="3 4"/>}
      {levels.filter(level=>level.value>=low && level.value<=high).map(level=><g key={level.name} aria-label={level.name+" "+level.value.toFixed(1)}><line x1={left} x2={width-right} y1={y(level.value)} y2={y(level.value)} stroke={level.colour} strokeDasharray="6 5"/></g>)}
      {lines.map(line=><path key={line.key} data-series={line.key} d={path(line.key)} fill="none" stroke={line.colour} strokeWidth={count?1.7:2.2} strokeDasharray={line.dash?"6 4":undefined}/>)}
      {marks.map(m=>{const i=rows.findIndex(r=>r.date===m.date);if(i<0)return null;
        return <g key={m.label} aria-label={m.label+" "+m.date}><line x1={x(i)} x2={x(i)} y1={top} y2={bottom} stroke="var(--a-text)" strokeDasharray="2 4"/><text x={x(i)} y={top-3} textAnchor="middle">{m.symbol}</text></g>;})}
      {selected && <line x1={x(Math.min(hover,rows.length-1))} x2={x(Math.min(hover,rows.length-1))} y1={top} y2={bottom} stroke="var(--t2)"/>}
      {dateTicks.map(({i,label})=><g key={i} className="date-tick"><line x1={x(i)} x2={x(i)} y1={bottom} y2={bottom+4} className="gridline"/><text x={x(i)} y={height-5} textAnchor={x(i)<left+30?"start":x(i)>width-right-30?"end":"middle"}>{label}</text></g>)}
    </svg>
    {readout&&<output className="chart-readout"><b>{shortDate(readout.date)}</b>{lines.map(l=><span key={l.key}>{l.name} <b>{Number.isFinite(readout[l.key])?readout[l.key].toFixed(count?0:1):"—"}</b></span>)}</output>}
  </div>;
}
