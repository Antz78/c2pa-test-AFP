import { chromium } from 'playwright';
const browser=await chromium.launch({headless:true});
try {
  const page=await browser.newPage();
  page.on('console',m=>{if(m.type()==='error')console.error('Gallery browser:',m.text());});
  await page.goto('http://127.0.0.1:8765/index.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>{
    const cards=Array.from(document.querySelectorAll('#grid [data-idx]'));
    return cards.length===2 && cards.every(c=>{
      const tag=c.querySelector('.tag');
      return tag && !tag.classList.contains('loading');
    });
  },null,{timeout:90000});
  const results=await page.locator('#grid [data-idx]').evaluateAll(cards=>cards.map(c=>({
    state:Array.from(c.querySelector('.tag').classList).find(s=>['ok','warn','bad','none','error'].includes(s)),
    caption:c.textContent?.trim().slice(0,140)
  })));
  console.log('Gallery integration:',JSON.stringify(results,null,2));
  if(results.length!==2)throw Error('Expected two gallery cards');
  if(results.some(item=>!['ok','warn'].includes(item.state)))
    throw Error('Gallery classified an OpenAI example as an invalid signature or unreadable file');
}finally{await browser.close();}