import React,{useEffect,useSyncExternalStore} from "react";
import {createRoot} from "react-dom/client";
import "./theme.css";
import "./page.css";
import {DashboardContent} from "./content/dashboard/DashboardContent.jsx";
import {shortDate} from "./content/dashboard/HistoryChart.jsx";
import snapshot from "./data.json";
import {language,languageEvent,localText} from "./locale.js";

function subscribe(notify){
  window.addEventListener(languageEvent,notify);
  window.addEventListener("popstate",notify);
  return ()=>{window.removeEventListener(languageEvent,notify);window.removeEventListener("popstate",notify);};
}
function Page(){
  const lang=useSyncExternalStore(subscribe,language);
  useEffect(()=>{
    document.documentElement.lang=lang;
    document.title=localText("AI stack heatmap");
    if(lang==="zh-CN"&&!new URLSearchParams(location.search).has("lang")){
      const url=new URL(location.href);url.searchParams.set("lang",lang);
      history.replaceState(history.state,"",url);
    }
  },[lang]);
  return <>
  <header className="publication"><span>Prices through <time dateTime={snapshot.asOf}>{shortDate(snapshot.asOf)}</time></span>
    <a href="https://github.com/phuazz/ai-stack-monitor/actions/workflows/dashboard.yml">Refresh history</a></header>
  <DashboardContent/>
</>;
}
createRoot(document.getElementById("dashboard")).render(<Page/>);
