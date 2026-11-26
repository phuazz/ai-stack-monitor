import React from "react";
import PowerPointExport from "./PowerPointExport.jsx";
import {calendarTicks} from "./calendar-ticks.mjs";
import {shortDate} from "./HistoryChart.jsx";
import {trendRows} from "./trends.mjs";
import {language,localText} from "../../locale.js";

export const averageLines=[
  {key:"ma50",name:"50-session average",colour:"var(--a-text)"},
  {key:"ma200",name:"200-session average",colour:"var(--p-text)",dash:true}
];

function renderTrend({title,basis,rows,lines,marks,levels,averageOf},colours){
  const canvas=document.createElement("canvas");
  canvas.width=2880;canvas.height=1620;
  const ctx=canvas.getContext("2d");
  ctx.scale(2,2);ctx.fillStyle="white";ctx.fillRect(0,0,1440,810);
  function colour(token){
    return token.startsWith("var(")?colours.getPropertyValue(token.slice(4,-1)).trim():token;
  }
  function text(value,x,y,size,weight=400,align="left"){
    ctx.fillStyle="#18232e";ctx.font=weight+" "+size+"px Arial, sans-serif";ctx.textAlign=align;ctx.fillText(localText(value),x,y);
  }
  text(title,48,58,36,700);
  text(basis,48,100,23,600);
  text(shortDate(rows[0].date)+" – "+shortDate(rows.at(-1).date)+" · First available close = 100",48,137,21);
  let legendX=48,legendY=184;
  const plotted=lines.filter(l=>rows.some(r=>Number.isFinite(r[l.key])));
  for(const line of lines){
    const available=plotted.includes(line);
    const label=line.name+(available?"":" (insufficient history)");
    ctx.font="18px Arial, sans-serif";
    const width=60+ctx.measureText(localText(label)).width;
    if(legendX+width>1400){legendX=48;legendY+=32;}
    ctx.strokeStyle=colour(line.colour);ctx.lineWidth=3;ctx.setLineDash(line.dash?[9,6]:[]);
    ctx.beginPath();ctx.moveTo(legendX,legendY-6);ctx.lineTo(legendX+30,legendY-6);ctx.stroke();
    text(label,legendX+38,legendY,18);legendX+=width;
  }
  const left=88,right=1386,top=legendY+48,bottom=674;
  const values=plotted.flatMap(l=>rows.map(r=>r[l.key]).filter(Number.isFinite));
  const low=Math.floor(Math.min(100,...values)/5)*5,high=Math.max(low+5,Math.ceil(Math.max(100,...values)/5)*5);
  const x=i=>left+(right-left)*i/Math.max(1,rows.length-1);
  const y=v=>bottom-(bottom-top)*(v-low)/(high-low);
  function segment(x1,y1,x2,y2,ink,dash=[]){
    ctx.strokeStyle=ink;ctx.lineWidth=1.5;ctx.setLineDash(dash);ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();
  }
  for(let i=0;i<=4;i++){
    const value=low+(high-low)*i/4;
    segment(left,y(value),right,y(value),"#dbe0e4");text(Number(value.toFixed(1)),left-10,y(value)+6,17,400,"right");
  }
  if(low<100&&high>100)segment(left,y(100),right,y(100),"#a8aeb4",[4,5]);
  for(const level of levels.filter(l=>l.value>=low&&l.value<=high)){
    segment(left,y(level.value),right,y(level.value),colour(level.colour),[8,5]);
    text(level.name+" "+level.value.toFixed(1),right,y(level.value)-5,15,500,"right");
  }
  for(const mark of marks){
    const index=rows.findIndex(r=>r.date===mark.date);
    if(index<0)continue;
    segment(x(index),top,x(index),bottom,"#a79a8b",[3,5]);
    text(mark.symbol,x(index),top-8,16,600,"center");
  }
  for(const line of plotted){
    ctx.strokeStyle=colour(line.colour);ctx.fillStyle=ctx.strokeStyle;ctx.lineWidth=3;ctx.setLineDash(line.dash?[9,6]:[]);
    ctx.beginPath();let connected=false;
    rows.forEach((row,i)=>{
      const value=row[line.key];
      if(!Number.isFinite(value)){connected=false;return;}
      if(connected)ctx.lineTo(x(i),y(value));else ctx.moveTo(x(i),y(value));
      if(!connected&&!Number.isFinite(rows[i+1]?.[line.key]))ctx.fillRect(x(i)-2,y(value)-2,4,4);
      connected=true;
    });
    ctx.stroke();
  }
  for(const tick of calendarTicks(rows,(right-left)*0.72,language())){
    const pos=x(tick.i);text(tick.label,pos,bottom+29,17,400,pos<left+45?"left":pos>right-45?"right":"center");
  }
  text("Simple moving averages of "+averageOf+" use the preceding 50 and 200 sessions, including the current close.",48,753,18);
  text("Source · Yahoo Finance adjusted closes",48,785,18);
  return canvas;
}

export default function TrendExport({title,basis,rows,lines,seriesId,basisId,averageOf="the plotted close",history,primary,marks=[],levels=[]}){
  const render=()=>{
    let imageRows=rows,imageLines=lines;
    if(history){
      const averages=trendRows(history.filter(row=>row.date<=rows.at(-1).date),row=>row[primary],rows[0].date,0);
      const byDate=new Map(averages.map(row=>[row.date,row]));
      imageRows=rows.map(row=>({...row,ma50:byDate.get(row.date)?.ma50,ma200:byDate.get(row.date)?.ma200}));
      imageLines=[...lines,...averageLines];
    }
    return renderTrend({title,basis,rows:imageRows,lines:imageLines,marks,levels,averageOf},getComputedStyle(document.querySelector(".ai-monitor")));
  };
  return <PowerPointExport buttonLabel="Export chart for PowerPoint" title="Chart image" alt={title+" · "+basis}
    name={["ai-stack",seriesId,basisId,rows[0].date,"to",rows.at(-1).date].join("-")+".png"} render={render}/>;
}
