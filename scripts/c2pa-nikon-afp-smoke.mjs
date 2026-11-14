import { chromium } from 'playwright';
const browser=await chromium.launch({headless:true});
const files=['D36K4MF-org.jpg','QH3TP_redactParentExif.jpg','QH3TP_redactParentThumbnail.jpg'];
try {
  const page=await browser.newPage();
  page.on('pageerror',error=>console.error('Browser error:',String(error)));
  await page.goto('http://127.0.0.1:8765/index.html',{waitUntil:'domcontentloaded'});
  await page.locator('#presentation-mode').selectOption('direct');
  await page.waitForFunction(()=> {
    const cards=Array.from(document.querySelectorAll('#grid [data-idx]'));
    return cards.length===3&&cards.every(card=>{
      const badge=card.querySelector('.tag');
      return badge&&!badge.classList.contains('loading');
    });
  },null,{timeout:120000});
  for(let i=0;i<3;i++){
    const card=page.locator('#grid [data-idx]').nth(i);
    const state=await card.evaluate(node=>['ok','warn','bad','none','error'].find(s=>
      node.querySelector('.tag')?.classList.contains(s)));
    if(state!=='warn')throw Error(files[i]+': expected amber trust-warning, got '+state);
    await card.click();
    await page.waitForFunction(()=>Boolean(document.querySelector('#side-panel .afp-reader-active-verification')),null,{timeout:10000});
    const data=await page.locator('#side-panel').evaluate(panel=>{
      const active=panel.querySelector('.afp-reader-active-verification');
      const historical=Array.from(panel.querySelectorAll('.afp-reader-historical-signature'));
      const checks=node=>Object.fromEntries(Array.from(node.querySelectorAll('.afp-reader-check-card')).map(n=>
        [n.dataset.check,n.dataset.checkState]));
      return {
        activeTitle:active?.querySelector(':scope>summary')?.textContent,
        activeOpen:active?.open,
        activeChecks:checks(active),
        explanation:active?.querySelector('.afp-reader-color-explanation')?.textContent??'',
        otherFailure:Boolean(active?.querySelector('.afp-reader-other-failure')),
        previous:historical.map(n=>({title:n.querySelector('summary')?.textContent,
          validation:n.dataset.historicalValidation,checks:checks(n),
          note:n.querySelector('.afp-reader-historical-notice')?.textContent??''})),
        caWG:Array.from(panel.querySelectorAll('.validation-item')).filter(x=>
          x.querySelector('span:nth-child(2)')?.textContent?.trim()==='cawg.x509.credential.untrusted').map(x=>
          ({warning:x.querySelector('.validation-pill')?.classList.contains('warn'),text:x.textContent?.trim()}))
      };
    });
    console.log(files[i],JSON.stringify(data));
    if(!data.activeOpen||!data.explanation.startsWith('Orange :'))throw Error('Incorrect active amber explanation '+files[i]);
    if(data.activeChecks.integrity!=='ok'||data.activeChecks.signature!=='ok'||
       data.activeChecks.certificate!=='warn')throw Error('Incorrect active four-check summary '+files[i]);
    if(data.otherFailure)throw Error('Untrusted CAWG identity misleadingly shown as cryptographic failure '+files[i]);
    if(i===0){
      if(data.previous.length!==0)throw Error('Original Nikon image cannot have AFP parent');
      if(!data.activeTitle.includes('NIKON CORPORATION'))throw Error('Nikon signer missing');
    }else{
      if(!data.activeTitle.includes('AGENCE FRANCE-PRESSE'))throw Error('AFP signer missing');
      if(data.activeChecks.timestamp!=='warn')throw Error('AFP timestamp must require review');
      if(data.previous.length!==1 || !data.previous[0].title.includes('NIKON CORPORATION')||
         data.previous[0].validation!=='independent')throw Error('Missing historical Nikon independently validated manifest');
      const c=data.previous[0].checks;
      if(c.integrity!=='ok'||c.signature!=='ok'||c.certificate!=='warn'||c.timestamp!=='neutral')
        throw Error('Wrong Nikon historical C2PA checks '+JSON.stringify(c));
      if(!data.previous[0].note.includes('empreintes du manifeste Nikon original'))
        throw Error('Nikon parent verification scope missing');
      if(!data.caWG.length||!data.caWG.every(x=>x.warning))
        throw Error('CAWG identity certificate trust should be amber');
    }
    await page.locator('#lb-close').click();
  }
}finally{await browser.close();}
