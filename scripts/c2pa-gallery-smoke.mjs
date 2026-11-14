import { chromium } from 'playwright';
const browser=await chromium.launch({headless:true});
try {
  const page=await browser.newPage();
  page.on('console',m=>{if(m.type()==='error')console.error('Gallery browser:',m.text());});
  await page.goto('http://127.0.0.1:8765/index.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>{
    const cards=Array.from(document.querySelectorAll('#grid [data-idx]'));
    return cards.length===6 && cards.every(c=>{
      const tag=c.querySelector('.tag');
      return tag && !tag.classList.contains('loading');
    });
  },null,{timeout:90000});
  const results=await page.locator('#grid [data-idx]').evaluateAll(cards=>cards.map(c=>({
    state:Array.from(c.querySelector('.tag').classList).find(s=>['ok','warn','bad','none','error'].includes(s)),
    caption:c.textContent?.trim().slice(0,140)
  })));
  console.log('Gallery integration:',JSON.stringify(results,null,2));
  if(results.length!==6)throw Error('Expected six gallery cards');
  for(let i=0;i<results.length;i++){
    const expected=i<3||i===5?'ok':'warn';
    if(results[i].state!==expected)
      throw Error('Unexpected C2PA status for '+results[i].caption+': '+results[i].state+' instead of '+expected);
  }

  await page.locator('#presentation-mode').selectOption('direct');
  for(let i=0;i<results.length;i++){
    await page.locator('#grid [data-idx]').nth(i).click();
    await page.waitForFunction(()=>{
      const panel=document.querySelector('#side-panel');
      return panel && !panel.hidden &&
        Array.from(panel.querySelectorAll('.credential-section h3'))
        .some(h=>h.textContent.includes('Filigrane invisible'));
    },null,{timeout:12000});
    const report=await page.locator('#side-panel').evaluate(panel=>{
      const section=Array.from(panel.querySelectorAll('section.credential-section')).find(x=>
        x.querySelector('h3')?.textContent.includes('Filigrane invisible'));
      const findField=(name)=>{
        const row=Array.from(section.querySelectorAll('.credential-row'))
          .find(x=>x.querySelector('.field-label')?.textContent.trim()===name);
        const value=row?.querySelector('.field-value');
        return value?Array.from(value.childNodes)
          .filter(n=>n.nodeType===Node.TEXT_NODE).map(n=>n.textContent).join('').trim():null;
      };
      return {
        watermark:findField('Filigrane invisible'), brand:findField('Marque'),
        technology:findField('Technologie'),
        checks:Array.from(panel.querySelectorAll('.validation-item span:nth-child(2)')).map(x=>x.textContent)
      };
    });
    console.log('Watermark report',i,JSON.stringify(report));
    const declared=i>=3;
    if(report.watermark!==(declared?'Filigrane déclaré':'Filigrane absent'))
      throw Error('Incorrect watermark declaration for '+i+' : '+report.watermark);
    if(declared){
      if(report.brand!==(i===5?'Google':'OpenAI'))throw Error('Incorrect watermark brand '+i+' '+report.brand);
      if(!report.technology.includes('SynthID'))throw Error('Missing watermark technology '+i);
    }else if(report.brand!==''||report.technology!=='')
      throw Error('Undeclared watermark must leave brand/technology blank on '+i);
    if(report.checks.filter(x=>x.startsWith('assertion.hashedURI.match')).length!==1)
      throw Error('Repeated hash rows not grouped on '+i);
    await page.keyboard.press('Escape');
  }
}finally{await browser.close();}