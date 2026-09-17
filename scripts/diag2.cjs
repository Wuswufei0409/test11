const { chromium } = require('/opt/playtest/node_modules/playwright');
const { PNG } = require('pngjs'); const fs = require('fs');
function darkFrac(path){const p=PNG.sync.read(fs.readFileSync(path));const {width:w,height:h,data:d}=p;let n=w*h,dark=0;for(let i=0;i<d.length;i+=4){if(d[i]+d[i+1]+d[i+2]<80)dark++;}return (dark/n*100).toFixed(1);}
async function main(){
  const browser=await chromium.launch({executablePath:'/home/yinwf2/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--enable-webgl']});
  const page=await browser.newPage({viewport:{width:1280,height:720}});
  await page.goto('http://localhost:5199/?seed=20260917',{waitUntil:'load'});
  await page.evaluate(()=>document.getElementById('menu-overlay')?.remove());
  await page.waitForTimeout(5000);
  const cap=async(n)=>{await page.waitForTimeout(120);await page.screenshot({path:'evidence/d_'+n+'.png'});return darkFrac('evidence/d_'+n+'.png');};
  const full=await cap('full');
  await page.evaluate(()=>{window.__GAME__.hand.visible=false;}); const nohand=await cap('nohand');
  await page.evaluate(()=>{window.__GAME__.meshGroup.traverse(o=>{if(o.isMesh&&o.material&&o.material.transparent)o.visible=false;});}); const nowater=await cap('nowater');
  await page.evaluate(()=>{window.__GAME__.meshGroup.traverse(o=>{if(o.isMesh&&o.material&&!o.material.transparent)o.visible=false;});}); const noopaque=await cap('noopaque');
  console.log('DARK%  full',full,' nohand',nohand,' nowater',nowater,' noopaque',noopaque);
  await browser.close();
}
main().catch(e=>{console.error(e);process.exit(1);});
