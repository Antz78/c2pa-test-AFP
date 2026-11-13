/* AFP C2PA - Service Worker v2 : disponibilité réseau et octets d'origine.
   S'applique uniquement au site qui l'enregistre ; n'envoie aucune donnée. */
const CACHE_PREFIX='afp-c2pa-';
const SHELL='afp-c2pa-shell-v6-dual-trust';
const ORIGINALS='afp-c2pa-originals-v1';
const SDK='afp-c2pa-sdk-v1';
const MAX_ORIGINALS=32;
const LIMIT_BYTES=28*1024*1024;
const SHELL_URLS=['./','./index.html','./app.js','./curl.js','./photos.json','./logo-afp.png','./afp-gelule.png'];

self.addEventListener('install', event=>{
  // Une ressource absente ne doit pas empêcher l'installation du worker.
  event.waitUntil(caches.open(SHELL).then(async cache=>{
    await Promise.allSettled(SHELL_URLS.map(async path=>{
      const url=new URL(path,self.registration.scope);
      try { const res=await fetch(url,{cache:'reload'}); if(res.ok) await cache.put(url,res); }
      catch (_) {}
    }));
    await self.skipWaiting();
  }));
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const names=await caches.keys();
    await Promise.all(names.filter(n=>n.startsWith(CACHE_PREFIX)&&![SHELL,ORIGINALS,SDK].includes(n)).map(n=>caches.delete(n)));
    await self.clients.claim();
  })());
});
async function networkFirst(request,cacheName,timeoutMs=9000) {
  const cache=await caches.open(cacheName);
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try {
    // Bypass the browser HTTP cache for the page and scripts when online.
    // CacheStorage still holds a fallback for offline visits.
    const requestPath=new URL(request.url).pathname;
    const freshShell=request.mode==='navigate'||/\.(?:js|html)$/.test(requestPath);
    const response=await fetch(request,{signal:controller.signal,cache:freshShell?'no-store':'default'});
    if(response.ok && response.type!=='opaque') cache.put(request,response.clone()).catch(()=>{});
    return response;
  } catch(error) {
    const saved=await cache.match(request,{ignoreSearch:true});
    if(saved)return saved;
    throw error;
  } finally {clearTimeout(timer);}
}
async function photoFirst(request) {
  const cache=await caches.open(ORIGINALS);
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),9000);
  try {
    const response=await fetch(request,{signal:controller.signal});
    if (response.ok && response.type!=='opaque') {
      const len=Number(response.headers.get('Content-Length'));
      if (len && len<=LIMIT_BYTES) {
        cache.put(request,response.clone()).then(async()=>{
          const keys=await cache.keys();
          await Promise.all(keys.slice(0,Math.max(0,keys.length-MAX_ORIGINALS)).map(k=>cache.delete(k)));
        }).catch(()=>{});
      }
    }
    return response;
  } catch(error) {
    const saved=await cache.match(request,{ignoreSearch:true});
    if(saved)return saved;
    throw error;
  } finally {clearTimeout(timer);}
}
async function sdkFirst(request) {
  const cache=await caches.open(SDK);
  const saved=await cache.match(request,{ignoreSearch:false});
  if(saved)return saved;
  const response=await fetch(request);
  if(response.ok&&response.type==='cors')cache.put(request,response.clone()).catch(()=>{});
  return response;
}
self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET')return;
  const u=new URL(req.url);
  // SDK 0.15.4 : code et WebAssembly figés, réutilisés après une première connexion réussie.
  if(u.hostname==='cdn.jsdelivr.net'&&u.pathname.includes('@contentauth/c2pa-web@0.15.4')) {
    event.respondWith(sdkFirst(req));return;
  }
  if(u.origin!==self.location.origin)return;
  const base=new URL(self.registration.scope).pathname;
  if(!u.pathname.startsWith(base))return;
  if(u.pathname.toLowerCase().includes('/photos/')&&/\.(?:jpe?g|png|webp|tiff?)$/i.test(u.pathname)) {
    event.respondWith(photoFirst(req));return;
  }
  if(req.mode==='navigate'||/\/(?:index\.html|app\.js|curl\.js|photos\.json|logo-afp\.png|afp-gelule\.png)$/.test(u.pathname)) {
    event.respondWith(networkFirst(req,SHELL,8500));
  }
});
