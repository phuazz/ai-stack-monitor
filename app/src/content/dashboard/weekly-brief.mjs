import {startIndex} from "./heatmap-data.mjs";
import {inWindow} from "./newsflow.mjs";

const segments=[
  ["Power and facilities","Electricity supply, grid connections and cooling capacity.",["energy","power"]],
  ["Chips, networks and devices","Chip orders, fabrication capacity, network upgrades and edge-device demand.",["equipment","foundry","compute","network","devices"]],
  ["Cloud and model providers","GPU rental demand, capacity utilisation and model economics.",["cloud","models"]],
  ["Software and commerce","Enterprise adoption, paid software usage and transaction fees.",["data","security","payments","apps"]]
];
export const pct=n=>(n>0?"+":"")+n.toFixed(1)+"%";
export const pp=n=>(n>0?"+":"")+n.toFixed(2)+" pp";
const sign=n=>Math.abs(n)<0.05?0:Math.sign(n);

export function weeklyBrief(snapshot,period=0){
  const week=snapshot.groups.energy.weeks[period],{start,end,sessions}=week;
  const market=snapshot.marketCloses,dates=Object.keys(market).sort();
  const peak=dates[startIndex("peak",dates,dates.indexOf(start),{SPY:market})];
  const spy=100*(market[end]/market[start]-1);
  const rows=Object.entries(snapshot.groups).map(([id,g],index)=>{
    const w=g.weeks[period],history=snapshot.queries[id].rows;
    if(w.start!==start||w.end!==end)throw new Error("Inconsistent weekly closes for "+id);
    const base=history.find(r=>r.date===peak),prior=history.find(r=>r.date===start);
    const before=peak!==start&&base&&prior?100*(prior.ratio/base.ratio-1):null;
    const change=before===null?"No prior comparison":sign(w.relative)===0||sign(before)===0?"Little relative change":
      before<0?(w.relative>0?"Rebounding":"Still lagging"):(w.relative<0?"Turning down":"Still leading");
    const drivers=[...w.drivers].sort((a,b)=>Math.abs(b.points)-Math.abs(a.points));
    return {id,index,name:g.name,benchmark:g.label,count:g.members.length,ahead:w.ahead,usd:w.absolute,relative:w.relative,
      before,change,driver:drivers[0],drivers,question:g.question,events:w.changes};
  });
  const baskets=rows.filter(r=>r.count>1),ranked=[...baskets].sort((a,b)=>b.relative-a.relative);
  const leader=ranked[0],lag=ranked.at(-1);
  const up=baskets.filter(r=>r.usd>0).length,beatPeers=baskets.filter(r=>r.relative>0).length,beatMarket=baskets.filter(r=>r.usd>spy).length;
  const rebounds=ranked.filter(r=>r.change==="Rebounding"),turns=ranked.filter(r=>r.change==="Turning down");
  const focal=[...rebounds,...turns].sort((a,b)=>Math.abs(b.relative)-Math.abs(a.relative))[0]??leader;
  const headline=(up===baskets.length?"All "+up:up+" of "+baskets.length)+" baskets rose in USD. "+beatPeers+" beat their layer benchmarks.";
  const marketRead="SPY returned "+pct(spy)+". "+beatMarket+" of "+baskets.length+" baskets beat SPY over the same "+sessions+" US sessions.";
  const shiftRead=focal.name+" returned "+pct(focal.relative)+" versus "+focal.benchmark+" this week"+
    (focal.before===null?".":", after "+pct(focal.before)+" from the market high to the start of the week.")+
    " "+focal.ahead+" of "+focal.count+" stocks beat the benchmark. "+focal.driver.symbol+" contributed "+pp(focal.driver.points)+".";
  const lagRead=lag.name+" returned "+pct(lag.usd)+" in USD and "+pct(lag.relative)+" versus "+lag.benchmark+". "+
    lag.driver.symbol+" contributed "+pp(lag.driver.points)+" to its relative return.";
  const splits=baskets.map(row=>{
    const ordered=[...row.drivers].sort((a,b)=>b.points-a.points);
    const cancelled=Math.min(ordered.reduce((s,d)=>s+Math.max(0,d.points),0),ordered.reduce((s,d)=>s+Math.max(0,-d.points),0));
    return {id:row.id,name:row.name,relative:row.relative,positive:ordered[0],negative:ordered.at(-1),cancelled};
  }).sort((a,b)=>b.cancelled-a.cancelled);
  const split=splits[0];
  const dispersion=split.cancelled>=0.5?split:null;
  const dispersionRead=dispersion?"The "+split.name.toLowerCase()+" basket returned "+pct(split.relative)+" versus its benchmark. "+
    split.positive.symbol+" added "+pp(split.positive.points)+" and "+split.negative.symbol+" contributed "+pp(split.negative.points)+".":null;
  return {start,end,sessions,peak,spy,up,beatPeers,beatMarket,total:baskets.length,rebounds:rebounds.length,turns:turns.length,
    headline,marketRead,shiftRead,lagRead,dispersion,dispersionRead,focal,lag,rows,
    segments:segments.map(([name,description,ids])=>({name,description,ids})),
    news:inWindow(focal.id,{start,end}).slice(0,1)};
}
