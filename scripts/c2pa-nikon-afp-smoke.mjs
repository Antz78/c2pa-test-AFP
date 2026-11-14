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
        activeCertificateInfo:Boolean(active?.querySelector('.afp-reader-trust-more > summary')),
        activeChecks:checks(active),
        duplicateColorNotes:panel.querySelectorAll('.afp-reader-color-explanation').length,
        otherFailure:Boolean(active?.querySelector('.afp-reader-other-failure')),
        order:Array.from(panel.querySelectorAll('.afp-reader-historical-signature,.afp-reader-active-verification')).map(n=>
          n.querySelector(':scope > summary')?.textContent),
        previous:historical.map(n=>{
          const raw=n.querySelector('.afp-reader-raw');
          let parsed=null;try{parsed=JSON.parse(raw?.querySelector('pre')?.textContent??'');}catch(_){}
          return {title:n.querySelector('summary')?.textContent,
            open:n.open,validation:n.dataset.historicalValidation,checks:checks(n),
            background:n.querySelector('.afp-reader-historical-trust')?.dataset.level,
            certificateInfo:Boolean(n.querySelector('.afp-reader-trust-more > summary')),
            note:n.querySelector('.afp-reader-historical-notice')?.textContent??'',
            rawManifest:raw?.querySelector('summary')?.textContent??'',
            rawSignature:parsed?.signature_info?.issuer??parsed?.signatureInfo?.issuer??'',
            rawIsIndividual:parsed && !Object.hasOwn(parsed,'manifests'),
            hasId:raw?.dataset.manifestId===n.dataset.historicalManifestId};
        }),
        caWG:Array.from(panel.querySelectorAll('.validation-item')).filter(x=>
          x.querySelector('span:nth-child(2)')?.textContent?.trim()==='cawg.x509.credential.untrusted').map(x=>
          ({warning:x.querySelector('.validation-pill')?.classList.contains('warn'),text:x.textContent?.trim()}))
      };
    });
    console.log(files[i],JSON.stringify(data));
    if(!data.activeOpen||data.duplicateColorNotes!==0)throw Error('Signers should be open without repeated color explanations: '+files[i]);
    if(!data.activeCertificateInfo)throw Error('Active certificate help missing');
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
      if(!data.previous[0].note.includes('empreintes du manifeste Nikon') ||
         !data.previous[0].open || data.previous[0].background!=='warn' ||
         !data.previous[0].certificateInfo || !data.previous[0].rawIsIndividual ||
         !data.previous[0].rawManifest.includes('JSON') ||
         !data.previous[0].rawSignature.includes('NIKON CORPORATION') ||
         !data.previous[0].hasId)
        throw Error('Nikon must open first, amber, with its own certificate help and embedded JSON');
      if(data.order.length!==2 || !data.order[0].includes('NIKON CORPORATION') ||
         !data.order[1].includes('AGENCE FRANCE-PRESSE'))
        throw Error('Signatures are not in chronological Nikon-to-AFP order');
      if(!data.caWG.length||!data.caWG.every(x=>x.warning))
        throw Error('CAWG identity certificate trust should be amber');
    }
    await page.locator('#lb-close').click();
  }
}finally{await browser.close();}
