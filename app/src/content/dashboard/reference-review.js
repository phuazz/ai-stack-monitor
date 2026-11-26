import {roles} from "./stock-roles.mjs";
import prices from "./reference-prices.json";
import {compareReference} from "./heatmap-data.mjs";

export const rowIndex=snapshot=>Object.fromEntries(Object.entries(snapshot.queries)
  .map(([id,q])=>[id,new Map(q.rows.map(r=>[r.date,r]))]));

export function layerReferences(id,group){
  return roles.filter(r=>(r.main===id||r.also===id)&&!group.members.includes(r.symbol));
}

export function referenceWindow(snapshot,index,id,role,start,end,basis){
  if(!start||!end||start>end)return null;
  const price=day=>prices.series[role.symbol]?.prices[day]??index[role.main].get(day)?.[role.symbol];
  return compareReference(index[id].get(start),index[id].get(end),price(start),price(end),
    snapshot.marketCloses[end]/snapshot.marketCloses[start],basis);
}
