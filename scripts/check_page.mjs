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
    const picker=page.locator(".column-picker");
    const headers=()=>page.locator(".price-table thead th").evaluateAll(nodes=>nodes.slice(1).map(n=>n.firstChild.textContent));
    const defaults=["Since market high","1W","1M","3M","YTD"];
    assert.deepEqual(await headers(),defaults);
    assert.equal(await picker.evaluate(el=>el.open),true);
    if(width===390){
      await picker.getByRole("button",{name:"Show all periods"}).click();
      assert.equal((await headers()).length,8);
      await picker.getByRole("checkbox",{name:/^1M/}).uncheck();
      await page.reload();
      assert.ok(!(await headers()).includes("1M")&&(await headers()).includes("6M"));
      await picker.getByRole("button",{name:"Restore default columns"}).click();
      assert.deepEqual(await headers(),defaults);
      await picker.locator("summary").click();
      assert.equal(await picker.evaluate(el=>el.open),false);
      await picker.locator("summary").click();
    }
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
    await page.goto(base+"#map",{waitUntil:"domcontentloaded"});
    const map=page.locator(".pm-map");
    await map.getByRole("heading",{name:"AI investor map",exact:true}).waitFor();
    for(const period of [0,1]){
      await map.getByLabel("Review period").selectOption(String(period));
      assert.equal(await map.locator(".pm-layer").count(),13);
      const baskets=Object.values(snapshot.groups).filter(g=>g.members.length>1);
      const ahead=baskets.filter(g=>g.weeks[period].relative>0).length;
      assert.ok((await map.locator(".pm-headline").innerText()).includes(ahead+" beat their layer benchmarks."));
      for(const [id,g] of Object.entries(snapshot.groups)){
        const row=map.locator('[data-layer="'+id+'"]');
        assert.ok((await row.locator('[data-label="Week vs peers"]').innerText()).includes(g.weeks[period].relative.toFixed(1)+"%"));
      }
    }
    const mapMetrics=await map.evaluate(el=>{
      const doc=el.ownerDocument,p=el.querySelector(".pm-market"),style=getComputedStyle(p),ctx=doc.createElement("canvas").getContext("2d");
      ctx.font=style.fontSize+" "+style.fontFamily;
      const nodes=[...el.querySelectorAll("*")].filter(n=>n.getClientRects().length&&[...n.childNodes].some(c=>c.nodeType===3&&c.textContent.trim()));
      return {width:doc.documentElement.clientWidth,overflow:Math.max(0,doc.documentElement.scrollWidth-doc.documentElement.clientWidth),
        minFont:Math.min(...nodes.map(n=>parseFloat(getComputedStyle(n).fontSize))),
        chars:Math.round(p.clientWidth*p.innerText.length/ctx.measureText(p.innerText).width)};
    });
    assert.equal(mapMetrics.width,width);assert.equal(mapMetrics.overflow,0);assert.ok(mapMetrics.minFont>=11);
    console.log("Investor map",JSON.stringify(mapMetrics));
    await map.locator('[data-layer="cloud"]').click();
    await page.getByRole("heading",{name:"Weekly return drivers",exact:true}).waitFor();
    await page.goto(base+"#coverage");
    const coverage=page.locator(".coverage-view");
    await coverage.getByRole("heading",{name:"Stock and basket coverage"}).waitFor();
    assert.equal(await coverage.locator(".cov-layer-row").count(),13);
    const search=coverage.getByRole("searchbox");
    await search.fill("Cloudflare");
    const one=coverage.locator(".cov-stock-row").filter({hasText:"NET"});
    await one.click();
    await coverage.getByRole("link",{name:"Stock chart",exact:true}).waitFor();
    assert.equal(await coverage.locator(".cov-layer-row").count(),2);
    await coverage.getByLabel("Return",{exact:true}).selectOption("usd");
    await coverage.getByLabel("Period",{exact:true}).selectOption("peak");
    await search.fill("");
    for(const label of ["Stocks in focus","Layer baskets"]){
      const switcher=coverage.getByRole("button",{name:label,exact:true});
      if(await switcher.isVisible())await switcher.click();
      const cm=await coverage.evaluate(root=>{
        const d=root.ownerDocument, intro=root.querySelector(".cov-header p"),ctx=d.createElement("canvas").getContext("2d");
        ctx.font=getComputedStyle(intro).font;
        const nodes=[...root.querySelectorAll("*")].filter(n=>n.getClientRects().length&&[...n.childNodes].some(c=>c.nodeType===3&&c.textContent.trim()));
        return {width:d.documentElement.clientWidth,overflow:d.documentElement.scrollWidth-d.documentElement.clientWidth,
          minFont:Math.min(...nodes.map(n=>parseFloat(getComputedStyle(n).fontSize))),
          chars:Math.round(intro.clientWidth*intro.innerText.length/ctx.measureText(intro.innerText).width)};
      });
      assert.equal(cm.width,width);assert.equal(cm.overflow,0);assert.ok(cm.minFont>=11);
      console.log(label,JSON.stringify(cm));
    }
    await coverage.locator(".cov-layer-row").first().click();
    await coverage.getByText("Coverage gap",{exact:true}).first().waitFor();
    const review=snapshot.groups.power.weeks[1].end;
    await page.goto(base+"?basket=power&asof="+review+"&period=peak&basis=own#heatmap");
    await page.locator(".inline-panel .layer-trend svg").first().waitFor();
    await page.evaluate(()=>window.document.fonts.ready);
    for(const selector of [".inline-heading h3",".layer-trend > h3"]){
      const title=page.locator(".inline-panel "+selector);
      const bounds=await title.boundingBox();
      assert.ok(bounds&&bounds.y>=0&&bounds.y+bounds.height<=height,"Heading clipped on email entry: "+selector);
      console.log("Email heading",width,selector,Math.round(bounds.y));
    }
    assert.deepEqual(errors,[]);console.log(JSON.stringify(metrics));await page.close();
  }
}finally{await browser?.close();server.close();}
