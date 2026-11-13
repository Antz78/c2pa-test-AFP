import { chromium } from 'playwright';
const browser=await chromium.launch({headless:true});
try {
  const page=await browser.newPage();
  page.on('console',m=>{if(m.type()==='error')console.error('Gallery browser:',m.text());});
  await page.goto('http://127.0.0.1:8765/index.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof analyze==='function'&&typeof photos!=='undefined',null,{timeout:30000});
  const result=await page.evaluate(async()=>{
    const out=[];
    for(const name of ['Dragon au-dessus de DC.png','Homme en feu devant un mur de briques.png']){
      const photo={url:'./PHOTOS/'+encodeURIComponent(name),name,state:'loading',validation:[],trustChecks:null};
      photos.push(photo);
      await analyze(photo);
      out.push({name,state:photo.state,trustSource:photo.trustSource,
        codes:(photo.validation||[]).map(v=>String(v.code??v.status??v)),
        error:photo.error??null});
    }
    return out;
  });
  console.log('Gallery integration:',JSON.stringify(result,null,2));
  for(const p of result){
    if(p.state!=='ok')throw Error(p.name+' is '+p.state+' instead of ok; '+p.error+' / '+p.codes.join(','));
    if(!p.codes.includes('signingCredential.trusted'))throw Error('No trusted signer '+p.name);
    if(p.codes.includes('signingCredential.invalid'))throw Error('Rejected signing credential '+p.name);
  }
}finally{await browser.close();}