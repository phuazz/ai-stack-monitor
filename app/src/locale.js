import messages from "./zh-CN.json";

const key = "ai-stack-monitor.language";
export const languageEvent = "dashboard-language";
export function language() {
  if (typeof window === "undefined") return "en";
  const value = new URLSearchParams(location.search).get("lang");
  if (value === "zh-CN" || value === "en") return value;
  try { return localStorage.getItem(key) === "zh-CN" ? "zh-CN" : "en"; }
  catch { return "en"; }
}

export function chooseLanguage(value) {
  const url = new URL(location.href);
  url.searchParams.set("lang", value);
  history.replaceState(history.state, "", url);
  try { localStorage.setItem(key, value); } catch { /* The URL retains the choice. */ }
  window.dispatchEvent(new Event(languageEvent));
}

// Static copy uses exact keys. Composed labels can contain company names,
// dates and signed figures interleaved with the same catalogue phrases.
const folded = new Map(Object.entries(messages).map(([k,v])=>[k.toLowerCase(),v]));
const escapePattern = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const phrases = Object.keys(messages).sort((a,b)=>b.length-a.length).map(escapePattern);
const pattern = new RegExp("(?<![a-zA-Z0-9_])(?:" + phrases.join("|") + ")(?![a-zA-Z0-9_])", "gi");
export function chinese(text) {
  if (typeof text !== "string" || !/[a-z]/i.test(text)) return text;
  const original = text.trim();
  const exact = messages[original];
  if (typeof exact === "string") return text.replace(original, () => exact);
  return text.replace(pattern, match => messages[match] ?? folded.get(match.toLowerCase()));
}

export function localText(text) {
  return language() === "zh-CN" ? chinese(text) : text;
}

export function localLink(href) {
  if (typeof href !== "string" || !href.startsWith("?")) return href;
  const url = new URL(href, location.href);
  const preferred = language();
  if (preferred === "zh-CN" || new URLSearchParams(location.search).has("lang"))
    url.searchParams.set("lang", preferred);
  return url.search + url.hash;
}

export function updateQuery(fields) {
  const url = new URL(location.href);
  for (const [key,value] of Object.entries(fields)) {
    if (value) url.searchParams.set(key,value);
    else url.searchParams.delete(key);
  }
  if(url.href!==location.href) history.replaceState(history.state,"",url);
}

export function compactCompany(symbol, instruments) {
  if(language()!=="zh-CN") return symbol;
  const name=instruments[symbol]?.name;
  if(!name) return symbol;
  const translated=chinese(name);
  const short=translated.match(/^[\p{Script=Han}]+/u)?.[0] ??
    name.replace(/,?\s+(Inc\.?|Corporation|Corp\.?|Holdings|Group|N\.V\.|plc)\b.*$/i,"");
  return short===symbol ? symbol : short+"（"+symbol+"）";
}
