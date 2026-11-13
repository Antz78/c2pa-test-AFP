import { chromium } from 'playwright';
const browser=await chromium.launch({headless:true});
try {
  const page=await browser.newPage();
  page.on('console',m=>{if(m.type()==='error')console.error('Browser:',m.text());});
  await page.goto('http://127.0.0.1:8765/diagnostic-c2pa.html?autorun=1',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__diagnosticDone===true,{timeout:120000});
  const data=await page.evaluate(()=>({result:window.__diagnosticResults,error:window.__diagnosticError}));
  console.log(JSON.stringify(data,null,2));
  if(data.error)throw Error(data.error);
  if(!Array.isArray(data.result)||data.result.length!==2)throw Error('Did not verify both images');
  for(const item of data.result){
    const results=item.checks;
    if(!results||!Object.values(results).some(v=>Array.isArray(v)&&v.length))throw Error('No C2PA validation codes for '+item.name);
  }
}finally{await browser.close();}