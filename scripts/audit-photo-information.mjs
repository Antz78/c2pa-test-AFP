import {chromium} from 'playwright';
import {metadataFields,signedPhotoFields} from '../photo-information.js';
const empty=metadataFields({exif:{iptc:{}}});
for(const name of ['author','location','date','source','credit','camera','gps'])
  if(empty[name].value!==null)throw Error('Missing metadata must remain blank: '+name);
const distinct=metadataFields({exif:{copyright:'AFP',iptc:{credit:'AFP'}}});
if(distinct.author.value!==null||distinct.credit.value!=='AFP')
  throw Error('Copyright or credit must not substitute for photographer');
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage();
 page.on('pageerror',e=>console.error('Browser uncaught error',String(e)));
 await page.goto('http://127.0.0.1:8765/index.html',{waitUntil:'domcontentloaded'});
 await page.locator('#presentation-mode').selectOption('direct');
 await page.waitForFunction(()=>Array.from(document.querySelectorAll('#grid [data-idx]')).length===3
   &&Array.from(document.querySelectorAll('#grid [data-idx]')).every(x=>
     x.querySelector('.tag')&&!x.querySelector('.tag').classList.contains('loading')),
 null,{timeout:120000});
 for(let i=0;i<3;i++){
   await page.locator('#grid [data-idx]').nth(i).click();
   await page.waitForFunction(()=>document.querySelector('#side-panel .afp-reader-photo-information'),null,{timeout:15000});
   const out=await page.locator('#side-panel').evaluate(panel=>{
     const fold=panel.querySelector('.afp-reader-photo-information');
     const lines=Array.from(fold.querySelectorAll('.credential-row')).map(r=>({
       label:r.querySelector('.field-label')?.textContent.trim(),
       text:Array.from(r.querySelector('.field-value')?.childNodes??[])
         .filter(n=>n.nodeType===Node.TEXT_NODE).map(n=>n.textContent).join('').trim(),
       origin:r.querySelector('.field-value small')?.textContent.trim()??''
     }));
     let history={};
     try {
       const raw=document.querySelector('#lb-json')?.textContent;
       const store=JSON.parse(raw);
       history={
         resultsKeys:Object.keys(store.validation_results??{}),
         deltas:store.validation_results?.ingredientDeltas,
         ingredient:Object.entries(store.manifests??{}).flatMap(([id,m])=>
           (m.ingredients??[]).map(x=>({id,related:x.active_manifest,
             resultKeys:Object.keys(x.validation_results??{}),
             specVersion:x.validation_results?.specVersion,trustListUris:x.validation_results?.trustListUris
           })))
       };
     }catch(e){history.error=String(e);}
     return {lines,history};
   });
   console.log('PHOTO_METADATA_AUDIT',i,JSON.stringify(out));
   const find=k=>out.lines.find(x=>x.label===k);
   for(const name of ['Auteur / photographe','Lieu','Date de prise de vue','Source','Crédit','Appareil','Coordonnées GPS'])
     if(!find(name))throw Error('Always show '+name);
   if(i===0){
     if(!/Kent NISHIMURA/i.test(find('Auteur / photographe').text))
       throw Error('Nikon EXIF author missing');
     if(find('Source').text)throw Error('Nikon source must not be guessed');
   }else{
     if(!/FRANCOIS-XAVIER MARIT/i.test(find('Auteur / photographe').text))
       throw Error('AFP IPTC byline missing: '+JSON.stringify(find('Auteur / photographe')));
     if(!/Paris.*France/i.test(find('Lieu').text))throw Error('AFP IPTC place missing');
     if(!/24\/09\/2026/.test(find('Date de prise de vue').text))
       throw Error('AFP IPTC Date Created missing');
     if(find('Source').text!=='AFP'||find('Crédit').text!=='AFP')
       throw Error('AFP source and credit missing');
   }
   await page.locator('#lb-close').click();
 }
}finally{await browser.close();}
