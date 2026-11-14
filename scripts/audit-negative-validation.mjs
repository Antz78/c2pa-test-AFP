import {chromium} from 'playwright';
import {readFileSync} from 'node:fs';
const browser=await chromium.launch({headless:true});
try {
 const page=await browser.newPage();
 await page.goto('http://127.0.0.1:8765/index.html',{waitUntil:'domcontentloaded'});
 const input=readFileSync('PHOTOS/Dragon.jpg');
 // Mutate data in JPEG scan (not its C2PA manifest / certificate).
 function tamperJpeg(orig){
   const bytes=Buffer.from(orig);
   let i=2, start=-1;
   while(i<bytes.length-4){
     if(bytes[i]!==0xff){i++;continue;}
     const marker=bytes[i+1];
     if(marker===0xda){const length=bytes.readUInt16BE(i+2);start=i+2+length;break;}
     if(marker===0xd9)break;
     if(marker===0xd8||marker===0x01||(marker>=0xd0&&marker<=0xd7)){i+=2;continue;}
     const length=bytes.readUInt16BE(i+2);if(length<2||i+2+length>=bytes.length)break;
     i+=2+length;
   }
   if(start<0)throw Error('JPEG scan not found');
   const pos=Math.min(bytes.length-500,Math.max(start+2048,Math.floor((start+bytes.length-500)/2)));
   if(pos<=start||pos>=bytes.length-2)throw Error('JPEG scan too short');
   if(bytes[pos]===0xff || bytes[pos-1]===0xff || bytes[pos+1]===0xff)throw Error('Unsafe JPEG test byte');
   bytes[pos]^=1;
   return bytes;
 }
 const corrupt=tamperJpeg(input);
 const simplePng=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/B5oAAAAASUVORK5CYII=','base64');
 async function upload(name,buf,mime){
   await page.locator('#file-photos').setInputFiles({name,mimeType:mime,buffer:buf});
   await page.waitForFunction(name=>{
     const card=Array.from(document.querySelectorAll('#grid .card'))
       .find(c=>c.textContent?.includes(name));
     const tag=card?.querySelector('.tag');
     return tag && !tag.classList.contains('loading');
   },name,{timeout:100000});
   const state=await page.locator('#grid .card').evaluateAll((cards,name)=>{
     const c=cards.find(x=>x.textContent?.includes(name));
     return c?.querySelector('.tag')?.className??null;
   },name);
   console.log(name,state);
   return state;
 }
 const valid=await upload('audit_valid_google.jpg',input,'image/jpeg');
 if(!valid?.includes('ok'))throw Error('Known signed original did not validate green');
 const altered=await upload('audit_altered_scan.jpg',corrupt,'image/jpeg');
 if(!altered?.includes('bad'))throw Error('Modified signed image did not become red: '+altered);
 const unsigned=await upload('audit_unsigned.png',simplePng,'image/png');
 if(!unsigned?.includes('none'))throw Error('Unsigned image was not classified unsigned: '+unsigned);
 console.log('ADVERSARIAL_VALIDATION',JSON.stringify({valid,altered,unsigned}));
}finally{await browser.close();}
