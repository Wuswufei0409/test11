const { chromium } = require('/opt/playtest/node_modules/playwright');
const { PNG } = require('pngjs'); const fs = require('fs');
function blackFrac(path){const p=PNG.sync.read(fs.readFileSync(path));const {width:w,height:h,data:d}=p;let n=w*h,b=0;for(let i=0;i<d.length;i+=4){if(d[i]+d[i+1]+d[i+2]<30)b++;}return (b/n*100).toFixed(1);}
async function main(){
  const browser = await chromium.launch({ executablePath:'/home/yinwf2/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell', args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--enable-webgl']});
  const page = await browser.newPage({viewport:{width:1280,height:720}});
  await page.goto('http://localhost:5199/?seed=20260917',{waitUntil:'load'});
  await page.evaluate(()=>document.getElementById('menu-overlay')?.remove());
  await page.waitForTimeout(5000);
  const g=await page.evaluate(()=>window.__GAME__);
  // A: full
  await page.evaluate(()=>{const g=window.__GAME__;if(g.hand)g.hand.visible=true;g.meshGroup.visible=true;});
  await page.waitForTimeout(300); await page.screenshot({path:'evidence/diag_a.png'});
  // B: hide hand
  await page.evaluate(()=>{const g=window.__GAME__;if(g.hand)g.hand.visible=false;});
  await page.waitForTimeout(150); await page.screenshot({path:'evidence/diag_b.png'});
  // C: hide terrain too
  await page.evaluate(()=>{window.__GAME__.meshGroup.visible=false;});
  await page.waitForTimeout(150); await page.screenshot({path:'evidence/diag_c.png'});
  // D: hide overlay? none
  console.log('BLACK  A(full):',blackFrac('evidence/diag_a.png'),'  B(no hand):',blackFrac('evidence/diag_b.png'),'  C(no hand,no terrain):',blackFrac('evidence/diag_c.png'));
  await browser.close();
}
main().catch(e=>{console.error(e);process.exit(1);});
