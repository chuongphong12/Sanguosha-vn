const { chromium } = require('@playwright/test');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const fs = require('node:fs');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
    const failures = [];
    page.on('pageerror', e => failures.push(String(e)));
    await page.goto(pathToFileURL(path.join(__dirname, 'review-v3.html')).href);
    let cases = 0;
    for (const viewport of ['1366,768','1366,640','1440,900','1920,1080','1024,768']) {
      await page.selectOption('#viewport', viewport);
      for (const players of ['4','5','6','7','8','9','10']) {
        await page.selectOption('#players', players);
        for (const cards of ['1','10','15','20']) {
          await page.selectOption('#handCount', cards);
          const r = await page.evaluate(() => window.studyResult);
          cases++;
          if (r.errors.length || r.regions.filter(x => x.id.startsWith('seat-')).length !== Number(players)-1) failures.push({ viewport, players, cards, result: r });
          const reachable=await page.locator('.cards').evaluate(el=>{
            el.scrollLeft=el.scrollWidth;
            const last=el.lastElementChild.getBoundingClientRect(), bounds=el.getBoundingClientRect();
            return last.right<=bounds.right+1&&last.left>=bounds.left-1&&last.top>=bounds.top-1&&last.bottom<=bounds.bottom+1;
          });
          if(!reachable)failures.push({viewport,players,cards,error:'Last card cannot be fully viewed'});
        }
      }
    }
    await page.selectOption('#viewport','1366,768');
    await page.selectOption('#players','10');
    await page.selectOption('#handCount','20');
    await page.click('#zoom');
    await page.setViewportSize({width:1500,height:1000});
    await page.addStyleTag({content:'main{max-width:none}.study{overflow:visible}'});
    await page.evaluate(()=>window.dispatchEvent(new Event('resize')));
    await page.locator('#board').screenshot({path:path.join(__dirname,'layout-v3-1366.png')});
    const images=await page.locator('figure img').evaluateAll(list=>list.map(i=>({src:i.getAttribute('src'),loaded:i.complete&&i.naturalWidth>0})));
    for(const i of images)if(!i.loaded)failures.push(i);
    const localLinks=await page.locator('a').evaluateAll(list=>list.map(a=>a.getAttribute('href')).filter(x=>x&&!/^https?:|^#/.test(x)));
    for(const link of localLinks)if(!fs.existsSync(path.resolve(__dirname,link)))failures.push({missing:link});
    const result={checkedAt:new Date().toISOString(),scope:'Research HTML geometry only; not application runtime or usability validation',browser:await browser.version(),cases,images,failures};
    fs.writeFileSync(path.join(__dirname,'review-v3-check.json'),JSON.stringify(result,null,2));
    console.log(JSON.stringify(result,null,2));
    if(failures.length)process.exitCode=1;
  } finally { await browser.close(); }
})();
