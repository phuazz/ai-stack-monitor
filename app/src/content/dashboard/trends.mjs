export function trendRows(rows, valueAt, periodStart, sessions){
  const values=[],sums=[0,0],windows=[50,200],history=[];
  for(const row of rows){
    const close=valueAt(row);
    if(!(close>0)||!Number.isFinite(close)){
      values.length=0;sums.fill(0);history.push({date:row.date});continue;
    }
    values.push(close);
    const point={date:row.date,close};
    for(const [i,n] of windows.entries()){
      sums[i]+=close;
      if(values.length>n)sums[i]-=values[values.length-n-1];
      if(values.length>=n)point["ma"+n]=sums[i]/n;
    }
    history.push(point);
  }
  const window=sessions?history.slice(-sessions):history.filter(r=>r.date>=periodStart);
  const first=window.findIndex(r=>Number.isFinite(r.close));
  if(first===-1)return [];
  const visible=window.slice(first),base=visible[0].close;
  return visible.map(({date,...series})=>({date,...Object.fromEntries(Object.entries(series).map(([key,v])=>[key,100*v/base]))}));
}
