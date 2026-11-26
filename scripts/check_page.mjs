import assert from "node:assert/strict";
import {createServer} from "node:http";
import {readFile} from "node:fs/promises";
import {chromium} from "playwright-core";

const snapshot=JSON.parse(await readFile("app/src/data.json","utf8"));
const document=await readFile("docs/index.html");
const server=createServer((req,res)=>{res.writeHead(200,{"Content-Type":"text/html"});res.end(document);});
await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
const base=process.env.DASHBOARD_URL||"http://127.0.0.1:"+server.address().port+"/";
let browser;
try{
  browser=await chromium.launch({channel:"chrome"});
  for(const [width,height] of [[390,844],[844,390],[768,1024],[1280,900]]){
    const page=await browser.newPage({viewport:{width,height},isMobile:width<1000});
    const errors=[];page.on("pageerror",err=>errors.push(err.message));
    await page.goto(base,{waitUntil:"domcontentloaded"});
    await page.getByRole("heading",{name:"AI stack heatmap",exact:true}).waitFor();
    assert.equal(new URL(page.url()).search,"");
    assert.equal(await page.locator(".publication time").getAttribute("datetime"),snapshot.asOf);
    assert.equal(await page.locator(".price-table .row-name").count(),13);
    const metrics=await page.evaluate(async()=>{
      await window.document.fonts.ready;
      const doc=window.document,root=doc.documentElement,p=doc.querySelector(".heat-summary p")||doc.querySelector(".heat-view > p.basis");
      const style=getComputedStyle(p),ctx=doc.createElement("canvas").getContext("2d");ctx.font=style.fontSize+" "+style.fontFamily;
      const nodes=[...doc.querySelectorAll("main *")].filter(el=>el.getClientRects().length&&[...el.childNodes].some(n=>n.nodeType===3&&n.textContent.trim()));
      return {viewport:root.clientWidth,overflow:Math.max(0,root.scrollWidth-root.clientWidth),
        minFont:Math.min(...nodes.map(el=>parseFloat(getComputedStyle(el).fontSize))),
        chars:Math.round(p.clientWidth*p.innerText.length/ctx.measureText(p.innerText).width)};
    });
    assert.equal(metrics.viewport,width);assert.equal(metrics.overflow,0);assert.ok(metrics.minFont>=11);
    await page.locator(".price-table .row-name:enabled").first().click();
    const detail=page.locator(".inline-panel");await detail.locator("svg").first().waitFor();
    await detail.getByRole("button",{name:"Export chart for PowerPoint"}).click();
    const dialog=page.getByRole("dialog",{name:"Chart image"});
    assert.equal(await dialog.getByRole("img").evaluate(async image=>{await image.decode();return image.naturalWidth;}),2880);
    await dialog.getByRole("button",{name:"Close",exact:true}).click();
    await page.getByRole("link",{name:/Weekly reversals/}).first().click();
    await page.locator(".reversal-view").waitFor();
    assert.deepEqual(errors,[]);console.log(JSON.stringify(metrics));await page.close();
  }
}finally{await browser?.close();server.close();}
