const { chromium } = require('/opt/playtest/node_modules/playwright');
const { PNG } = require('pngjs'); const fs = require('fs');
function map(path){const p=PNG.sync.read(fs.readFileSync(path));const {width:w,height:h,data:d}=p;const rows=20,cols=60;let o='';function cl(r,g,b){if(r+g+b>30){if(g>r*1.15&&g>b&&g>70)return'G';if(r>g*1.15&&r>b&&r>70)return'T';if(b>r*1.3&&b>g&&b>90)return'B';if(r>180&&g>180&&b>180)return'L';return'.';}return'#';}for(let yr=0;yr<rows;yr++){let l='';for(let xr=0;xr<cols;xr++){const x=Math.floor(xr*w/cols),y=Math.floor(yr*h/rows),i=(y*w+x)*4;l+=cl(d[i],d[i+1],d[i+2]);}o+=l+'\n';}console.log(o);}
async function main(){
  const browser=await chromium.launch({executablePath:'/home/yinwf2/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--enable-webgl']});
  const page=await browser.newPage({viewport:{width:1280,height:720}});
  await page.goto('http://localhost:5199/?seed=20260917',{waitUntil:'load'});
  await page.evaluate(()=>document.getElementById('menu-overlay')?.remove());
  await page.waitForTimeout(5000);
  // water only
  await page.evaluate(()=>{const g=window.__GAME__;g.meshGroup.traverse(o=>{if(o.isMesh&&o.material&&!o.material.transparent)o.visible=false;});g.hand.visible=false;});
  await page.waitForTimeout(150);await page.screenshot({path:'evidence/d_water.png'});
  console.log('=== WATER ONLY ==='); map('evidence/d_water.png');
  await browser.close();
}
main().catch(e=>{console.error(e);process.exit(1);});
