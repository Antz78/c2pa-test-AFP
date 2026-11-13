import { chromium } from 'playwright';
const browser=await chromium.launch({headless:true});
try {
  const page=await browser.newPage();
  page.on('console',m=>{if(m.type()==='error')console.error('Gallery browser:',m.text());});
  await page.goto('http://127.0.0.1:8765/index.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>{
    const cards=Array.from(document.querySelectorAll('#grid [data-idx]'));
    return cards.length===5 && cards.every(c=>{
      const tag=c.querySelector('.tag');
      return tag && !tag.classList.contains('loading');
    });
  },null,{timeout:90000});
  const results=await page.locator('#grid [data-idx]').evaluateAll(cards=>cards.map(c=>({
    state:Array.from(c.querySelector('.tag').classList).find(s=>['ok','warn','bad','none','error'].includes(s)),
    caption:c.textContent?.trim().slice(0,140)
  })));
  console.log('Gallery integration:',JSON.stringify(results,null,2));
  if(results.length!==5)throw Error('Expected five gallery cards');
  for(let i=0;i<results.length;i++){
    const expected=i<3?'ok':'warn';
    if(results[i].state!==expected)
      throw Error('Unexpected C2PA status for '+results[i].caption+': '+results[i].state+' instead of '+expected);
  }
}finally{await browser.close();}