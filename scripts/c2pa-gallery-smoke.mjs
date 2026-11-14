import { chromium } from 'playwright';
const browser=await chromium.launch({headless:true});
try {
  const page=await browser.newPage();
  page.on('console',m=>{if(m.type()==='error')console.error('Gallery browser:',m.text());});
  page.on('pageerror',e=>console.error('Uncaught page error:',String(e.stack||e)));

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

    const verification=await page.locator('#side-panel').evaluate(panel=>{
      const active=panel.querySelector('.afp-reader-active-verification');
      return {
        found:Boolean(active), open:active?.open, title:active?.querySelector(':scope > summary')?.textContent??'',
        visibleExplanation:active?.querySelector('.afp-reader-color-explanation')?.textContent??'',
        explanationWidth:active?.querySelector('.afp-reader-color-explanation')?.getBoundingClientRect().width??0,
        technicalCollapsed:Array.from(panel.querySelectorAll('.afp-reader-technical-flat')).every(x=>!x.open),
        statuses:Array.from(active?.querySelectorAll('.afp-reader-check-card')??[]).map(node=>({
          key:node.dataset.check,state:node.dataset.checkState,
          hasHelp:Boolean(node.querySelector('.afp-reader-check-info > summary'))
        })),
        additional:Array.from(panel.querySelectorAll('.afp-reader-historical-signature')).map(n=>({
          title:n.querySelector('summary')?.textContent,open:n.open,
          states:Array.from(n.querySelectorAll('.afp-reader-check-card')).map(n=>n.dataset.checkState)
        }))
      };
    });
    console.log('Four-check verification',i,JSON.stringify(verification));
    if(!verification.found || !verification.open)throw Error('Current signer verification must be open');
    if(verification.visibleExplanation!=='' || !verification.technicalCollapsed)
      throw Error('Repeated color explanation must be removed from signer panels '+i);
    if(!verification.title.includes(i===5?'Google':'OpenAI') && i>=3)
      throw Error('Signer not identified dynamically '+i+' '+verification.title);
    if(verification.statuses.length!==4 ||
       !verification.statuses.every(x=>x.hasHelp) ||
       verification.statuses.map(x=>x.key).join(',')!=='integrity,signature,certificate,timestamp')
      throw Error('Missing four accessible controls '+i);
    const expectedTsa=i===3||i===4?'warn':'ok';
    if(verification.statuses.find(x=>x.key==='timestamp').state!==expectedTsa)
      throw Error('TSA mismatch '+i+' '+JSON.stringify(verification.statuses));
    if(!verification.statuses.filter(x=>x.key!=='timestamp').every(x=>x.state==='ok'))
      throw Error('Signature/integrity/certificate mismatch '+i);
    if(!verification.additional.every(x=>x.open&&x.states.length===4))
      throw Error('Historical signature panels must be open with distinct controls');
    const info=page.locator('#side-panel .afp-reader-active-verification [data-check="timestamp"] details');
    console.log('Viewport visibility',JSON.stringify(await page.evaluate(()=>{
      const d=document.querySelector('#lightbox'),p=document.querySelector('#side-panel'),
        active=document.querySelector('#side-panel .afp-reader-active-verification');
      const simple=e=>e?({hidden:e.hidden,open:e.open,display:getComputedStyle(e).display,
        width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height}):null;
      return {lightbox:simple(d),panel:simple(p),active:simple(active)};
    })));
    const infoLayout=await info.locator('summary').evaluate(el=>{
      const a=[];
      for(let p=el;p&&a.length<16;p=p.parentElement){
        const style=getComputedStyle(p),r=p.getBoundingClientRect();
        a.push({tag:p.tagName,cls:p.className,display:style.display,visibility:style.visibility,
          overflow:style.overflow,opacity:style.opacity,w:r.width,h:r.height,x:r.x,y:r.y});
      }
      return a;
    });
    console.log('Help control geometry:',JSON.stringify(infoLayout));
    await info.locator('summary').click();
    if(!(await info.getAttribute('open')!==null))throw Error('The TSA help button did not open');
    if(!(await info.locator('p').isVisible()))throw Error('TSA public explanation not visible when opened');
    const description=await info.locator('p').textContent();
    if(!description || description.length<40)throw Error('No plain-language TSA explanation');
    await info.locator('summary').click();

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