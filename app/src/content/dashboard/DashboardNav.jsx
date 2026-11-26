import React,{useLayoutEffect,useRef} from "react";
import {chooseLanguage,language} from "../../locale.js";

const pages=[
  ["heatmap","Heatmap"],["map","Investor map"],["reversals","Weekly reversals"],
  ["coverage","Stock coverage"],["watchlist","Signal watchlist"],["outcomes","Historical returns"]
];

export default function DashboardNav({active,links={},onReturn}){
  const nav=useRef(null);
  useLayoutEffect(()=>{
    const element=nav.current,root=document.documentElement;
    const measure=()=>root.style.setProperty("--dashboard-nav-height",element.offsetHeight+"px");
    measure();
    const observer=new ResizeObserver(measure);
    observer.observe(element);
    return ()=>{observer.disconnect();root.style.removeProperty("--dashboard-nav-height");};
  },[]);
  return <nav ref={nav} className="dashboard-nav" aria-label="Dashboard sections">
    {pages.map(([id,label])=><a key={id} href={links[id]??("#"+id)}
      aria-current={active===id?"page":undefined}
      onClick={active===id&&onReturn?event=>{if(!event.ctrlKey&&!event.metaKey&&!event.shiftKey&&!event.altKey){event.preventDefault();onReturn();}}:undefined}>{label}</a>)}
    <span className="language-switch" role="group" aria-label="English / 简体中文">
      {[["en","English"],["zh-CN","简体中文"]].map(([code,label])=><button key={code} type="button" lang={code}
        aria-pressed={language()===code} onClick={()=>chooseLanguage(code)}>{label}</button>)}
    </span></nav>;
}
