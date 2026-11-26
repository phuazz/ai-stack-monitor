import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {periodDrivers,startIndex} from "../app/src/content/dashboard/heatmap-data.mjs";

const data=JSON.parse(readFileSync(new URL("../app/src/data.json",import.meta.url),"utf8"));
const approx=(x,y)=>assert.ok(Math.abs(x-y)<1e-7,`${x} differs from ${y}`);
const calendar=["2023-12-29","2024-01-02","2024-01-31","2024-02-01"];
assert.equal(startIndex("wtd",calendar,1,{}),0);
// A week spanning month-end still starts from the prior week's final session.
assert.equal(startIndex("wtd",calendar,3,{}),1);
assert.equal(startIndex("wtd",calendar,0,{}),-1);
let count=0;
for(const [id,g] of Object.entries(data.groups)){
  const rows=data.queries[id].rows;
  const compute=(start,end,basis)=>periodDrivers(g,rows,start,end,data.marketCloses,basis);
  for(const item of [...g.weeks,...g.events]){
    const details=compute(item.start??item.first,item.end??item.pivot,"own");
    for(const d of details.drivers)approx(d.points,item.drivers.find(x=>x.symbol===d.symbol).points);
    count++;
  }
  for(const basis of ["absolute","market","own"]){
    for(const first of [0,15,rows.length-27,rows.length-1]){
      const result=compute(rows[first].date,rows.at(-1).date,basis);
      approx(result.drivers.reduce((sum,x)=>sum+x.points,0),result.value);
    }
  }
  // Independently check each non-sector basis on one daily interval with drifted weights.
  const i=rows.findIndex((r,k)=>k>0&&r.date.slice(0,7)!==rows[k-1].date.slice(0,7));
  const reset=rows[i-1],from=rows[i],to=rows[i+1];
  const denominator=g.members.reduce((s,k)=>s+from[k]/reset[k],0);
  for(const basis of ["market","absolute"]){
    const control=basis==="market"?data.marketCloses[to.date]/data.marketCloses[from.date]:1;
    const result=compute(from.date,to.date,basis);
    for(const d of result.drivers){
      const s=d.symbol,weight=(from[s]/reset[s])/denominator;
      approx(d.points,100*weight*((to[s]/from[s])/control-1));
    }
  }
  assert.equal(compute("1900-01-01",rows.at(-1).date,"own"),null);
}
console.log(count,"weekly and pivot windows matched the independent captured per-stock figures; all 13 layers and three bases reconciled.");
