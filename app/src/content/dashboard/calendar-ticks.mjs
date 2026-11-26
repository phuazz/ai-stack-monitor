const dayLabel=new Intl.DateTimeFormat("en-GB",{day:"numeric",month:"short",timeZone:"UTC"});
const monthLabel=new Intl.DateTimeFormat("en-GB",{month:"short",year:"2-digit",timeZone:"UTC"});

export function calendarTicks(rows,pixels,lang="en"){
  if(!rows.length)return [];
  // UTC dates keep US session labels stable in every viewer timezone. JavaScript months are zero-indexed.
  const dates=rows.map(r=>new Date(r.date+"T12:00:00Z"));
  const slots=Math.max(2,Math.floor(pixels/62));
  const steps=["day","week",1,2,3,4,6,12,24,60];
  for(const step of steps){
    const weekly=step==="week",daily=step==="day";
    let prior=null;
    const ticks=[];
    for(const [i,date] of dates.entries()){
      const year=date.getUTCFullYear(),month=date.getUTCMonth();
      const key=daily?i:weekly?Math.floor((date.valueOf()/86400000+3)/7):Math.floor((year*12+month)/step);
      if(i===0||key!==prior){
        // A partial opening interval uses the first full boundary inside the window.
        if(i>0||daily||rows.length===1){
          const label=lang==="zh-CN" ? (daily||weekly ? (month+1)+"月"+date.getUTCDate()+"日" :
            step>=12 ? year+"年" : String(year).slice(2)+"年"+(month+1)+"月") :
            daily||weekly?dayLabel.format(date):step>=12?String(year):monthLabel.format(date);
          ticks.push({i,label});
        }
      }
      prior=key;
    }
    if(ticks.length>=2&&ticks.length<=slots&&ticks.every((t,i)=>i===0||(t.i-ticks[i-1].i)*pixels/Math.max(1,rows.length-1)>=53))return ticks;
  }
  return [...new Set([0,rows.length-1])].map(i=>({i,label:lang==="zh-CN"?rows[i].date:dayLabel.format(dates[i])+" "+dates[i].getUTCFullYear()}));
}
