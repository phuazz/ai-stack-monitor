// ISO session keys sort chronologically. JavaScript numeric months are zero-indexed.
export const periods={peak:"Since market high",tech:"Since tech high",wtd:"Week to date",week:"1 week",mtd:"Month to date",
  month:"1 month",quarter:"3 months",half:"6 months",ytd:"Year to date",year:"1 year",full:"Full history",custom:"Custom dates"};
export function onOrBefore(dates,date){
  let lo=0,hi=dates.length;
  while(lo<hi){const mid=(lo+hi)>>>1;if(dates[mid]<=date)lo=mid+1;else hi=mid;}
  return lo-1;
}
export function startIndex(key,dates,end,series,custom){
  if(end<0)return -1;
  if(key==="full")return 0;
  if(key==="custom")return onOrBefore(dates,custom);
  if(key==="wtd"){
    const sunday=new Date(dates[end]+"T12:00:00Z");
    sunday.setUTCDate(sunday.getUTCDate()-sunday.getUTCDay());
    return onOrBefore(dates,sunday.toISOString().slice(0,10));
  }
  if(key==="peak"||key==="tech"){
    const path=series[key==="peak"?"SPY":"XLK"];
    let high=Math.max(0,end-251);
    for(let i=high+1;i<=end;i++)if(path[dates[i]]>=path[dates[high]])high=i;
    return high;
  }
  if(key==="mtd"||key==="ytd"){
    const current=new Date(dates[end]+"T12:00:00Z");
    const month=key==="ytd"?0:current.getUTCMonth();
    // The last close strictly before the calendar period is its return baseline.
    const previous=new Date(Date.UTC(current.getUTCFullYear(),month,0)).toISOString().slice(0,10);
    return onOrBefore(dates,previous);
  }
  return end-({week:5,month:21,quarter:63,half:126,year:252}[key]??0);
}

// A held share's price expressed in units of the selected benchmark has additive P&L.
// Reset units at the preceding month-end exactly as in scripts/pipeline.py.
export function periodDrivers(group,rows,start,end,market,basis){
  const first=rows.findIndex(r=>r.date===start),last=rows.findIndex(r=>r.date===end);
  if(first<0||last<first)return null;
  const initial=rows[first],final=rows[last],symbols=group.members;
  const denominator=r=>basis==="absolute"?1:basis==="market"?market[r.date]:r.benchmark;
  const scale=100*denominator(initial)/initial.basket;
  let anchor=first;
  while(anchor>0 && rows[anchor].date.slice(0,7)===initial.date.slice(0,7))anchor--;
  const unitsAt=row=>symbols.map(s=>row.basket/(symbols.length*row[s]));
  let units=unitsAt(rows[anchor]);
  const points=symbols.map(()=>0);
  for(let i=first+1;i<=last;i++){
    const before=rows[i-1],after=rows[i];
    if(before.date.slice(0,7)!==after.date.slice(0,7))units=unitsAt(before);
    const oldControl=denominator(before),newControl=denominator(after);
    symbols.forEach((s,j)=>{points[j]+=scale*units[j]*(after[s]/newControl-before[s]/oldControl);});
  }
  const result=performance(group,initial,final,market[end]/market[start],basis);
  const drivers=symbols.map((symbol,j)=>({symbol,points:points[j],stockReturn:100*(final[symbol]/initial[symbol]-1)}));
  return {...result,start,end,drivers};
}
export function performance(g,first,last,marketGross,basis){
  if(!first||!last)return null;
  const control=benchmarkGross(first,last,marketGross,basis);
  const gross=last.basket/first.basket;
  return {value:100*(gross/control-1),absolute:100*(gross-1),
    ahead:g.members.filter(s=>last[s]/first[s]>control).length,total:g.members.length};
}

function benchmarkGross(first,last,marketGross,basis){
  return basis==="absolute"?1:basis==="market"?marketGross:last.benchmark/first.benchmark;
}

export function compareReference(first,last,stockStart,stockEnd,marketGross,basis){
  if(!first||!last||!(stockStart>0)||!(stockEnd>0))return null;
  const control=benchmarkGross(first,last,marketGross,basis);
  if(!(control>0))return null;
  const stock=100*((stockEnd/stockStart)/control-1);
  const basket=100*((last.basket/first.basket)/control-1);
  const direction=v=>Math.abs(v)<0.05?0:Math.sign(v);
  const stockSign=direction(stock),basketSign=direction(basket);
  const status=!stockSign||!basketSign?"Flat":stockSign===basketSign?"Confirms":"Diverges";
  return {stock,basket,gap:stock-basket,status};
}

export function leading(window){
  if(!window || Math.abs(window.value)<1e-8)return null;
  const sign=Math.sign(window.value);
  const sorted=[...window.drivers].sort((a,b)=>sign*(b.points-a.points));
  if(sorted.length>1 && Math.abs(sorted[0].points-sorted[1].points)<1e-8)return null;
  return sorted[0];
}

export function compareLegs(before,week){
  const direction=w=>!w||Math.abs(w.value)<1e-8?0:Math.sign(w.value);
  const prior=direction(before),current=direction(week);
  const comparable=Boolean(before&&week&&prior&&current);
  const reversed=comparable&&prior!==current;
  const net=before&&week?100*((1+before.value/100)*(1+week.value/100)-1):null;
  const status=!before||!week?"Insufficient history":!comparable?"Flat leg":
    reversed?(current>0?"Turned up":"Turned down"):(current>0?"Continued up":"Continued down");
  const aligned=w=>w.drivers.filter(d=>d.points*direction(w)>1e-8).map(d=>d.symbol);
  const overlap=comparable?aligned(week).filter(s=>aligned(before).includes(s)):null;
  return {before,week,status,comparable,reversed,net,overlap,priorLead:leading(before),weekLead:leading(week)};
}
