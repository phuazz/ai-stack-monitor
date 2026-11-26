import React from "react";
import PowerPointExport from "./PowerPointExport.jsx";
import {wrapChartImageText} from "../../wrap-text.js";
import {shortDate} from "./HistoryChart.jsx";
import {periods} from "./heatmap-data.mjs";
import {localText} from "../../locale.js";

function renderHeatmap(table,period,start,end){
  const canvas=document.createElement("canvas"),ctx=canvas.getContext("2d");
  const width=1440,padding=32,bodyWidth=width-2*padding;
  const headers=Array.from(table.tHead.rows[0].cells,cell=>cell.firstChild.textContent);
  const count=headers.length-1,labelWidth=count>4?420:560;
  const columnWidth=(bodyWidth-labelWidth)/count;
  const font=(weight,size)=>weight+" "+size+"px Arial, sans-serif";
  const rows=Array.from(table.tBodies[0].rows).filter(row=>!row.classList.contains("expanded-row")).map(row=>{
    const [heading,...cells]=row.cells;
    const lines=Array.from(heading.children).flatMap((part,index)=>{
      const face=index===0?font(600,17):font(400,15);
      ctx.font=face;
      const label=part.innerText.trim().replace(/\s+/g," ");
      return wrapChartImageText(ctx,label,labelWidth-30).map(text=>({text,face}));
    });
    const values=cells.map(cell=>{
      const style=getComputedStyle(cell);
      return {text:cell.innerText.trim().split(/\s+/),fill:style.backgroundColor,ink:style.color};
    });
    const height=Math.max(40,14+Math.max(lines.length,...values.map(v=>v.text.length))*20);
    return {lines,values,height};
  });
  const headerY=108,headerHeight=58,footerHeight=50;
  const height=headerY+headerHeight+rows.reduce((total,r)=>total+r.height,0)+footerHeight;
  canvas.width=width*2;canvas.height=height*2;ctx.scale(2,2);
  ctx.fillStyle="white";ctx.fillRect(0,0,width,height);
  function text(value,x,y,face,fill="#15202b",align="left"){
    ctx.font=face;ctx.fillStyle=fill;ctx.textAlign=align;ctx.textBaseline="middle";ctx.fillText(value,x,y);
  }
  text(localText("AI stack heatmap"),padding,32,font(700,30));
  text(localText(periods[period])+" · "+shortDate(start)+" – "+shortDate(end),padding,63,font(600,19));
  text(table.caption.innerText,padding,88,font(400,17));
  ctx.fillStyle="#eef1f3";ctx.fillRect(padding,headerY,bodyWidth,headerHeight);
  text(headers[0],padding+10,headerY+headerHeight/2,font(700,17));
  headers.slice(1).forEach((label,i)=>{
    ctx.font=font(700,16);
    const lines=wrapChartImageText(ctx,label,columnWidth-8);
    lines.forEach((line,j)=>text(line,padding+labelWidth+(i+0.5)*columnWidth,headerY+headerHeight/2+(j-(lines.length-1)/2)*18,font(700,16),"#15202b","center"));
  });
  let y=headerY+headerHeight;
  rows.forEach((row,i)=>{
    ctx.fillStyle=i%2?"#f5f6f5":"#fafbf9";ctx.fillRect(padding,y,labelWidth-2,row.height-2);
    row.lines.forEach((line,j)=>text(line.text,padding+10,y+row.height/2+(j-(row.lines.length-1)/2)*20,line.face));
    row.values.forEach((value,j)=>{
      const x=padding+labelWidth+j*columnWidth;
      ctx.fillStyle=value.fill;ctx.fillRect(x,y,columnWidth-2,row.height-2);
      value.text.forEach((line,k)=>text(line,x+columnWidth/2,y+row.height/2+(k-(value.text.length-1)/2)*20,font(k?400:700,k?14:19),value.ink,"center"));
    });
    y+=row.height;
  });
  text(localText("¹ Foundation models use Meta as a single-stock reference. A dash indicates unavailable history."),padding,y+23,font(400,15));
  return canvas;
}

export default function HeatmapExport({tableRef,period,start,end,basis}){
  return <PowerPointExport title="Heatmap image" alt="AI stack heatmap with the selected rows, return basis and periods"
    render={()=>renderHeatmap(tableRef.current,period,start,end)} name={["ai-stack",period,start,"to",end,basis].join("-")+".png"}/>;
}
