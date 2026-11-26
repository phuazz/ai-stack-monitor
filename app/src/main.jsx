import React from "react";
import {createRoot} from "react-dom/client";
import "./theme.css";
import "./page.css";
import {DashboardContent} from "./content/dashboard/DashboardContent.jsx";
import {shortDate} from "./content/dashboard/HistoryChart.jsx";
import snapshot from "./data.json";

createRoot(document.getElementById("dashboard")).render(<>
  <header className="publication"><span>Prices through <time dateTime={snapshot.asOf}>{shortDate(snapshot.asOf)}</time></span>
    <a href="https://github.com/phuazz/ai-stack-monitor/actions/workflows/dashboard.yml">Refresh history</a></header>
  <DashboardContent/>
</>);
