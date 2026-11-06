console.info('[C2PA AFP] Version filtres v3 chargée — badges À vérifier');
// Galerie C2PA — 100 % statique, fonctionne sur GitHub Pages.
// Deux modes :
//  A) ./photos.json existe (généré par GitHub Action à chaque push) → galerie automatique.
//  B) Sinon, glissez le dossier PHOTOS/ (ou des photos) directement sur la page.
// Version SDK fixée pour éviter les changements silencieux du CDN.
import { createC2pa, Reader } from 'https://cdn.jsdelivr.net/npm/@contentauth/c2pa-web@0.15.4/+esm';

/* curl.js — Repli de coin de page WebGL, autonome, sans dépendance.
   Usage : const ctl = mountCurl(bouton); ctl.updatePhoto(imgElement, cardCanvas);
   Le bouton reçoit un <canvas> plein cadre qui reproduit la portion de photo
   située dessous, puis y enroule le coin autour d'un cylindre virtuel. */

const FS = `
precision highp float;
uniform vec2 uRes;
uniform sampler2D uImg;
uniform sampler2D uCard;
uniform float uT;
uniform vec2 uK;
uniform vec2 uOff;
const float SQRT2=1.41421356;
const float R=0.34;
void main(){
  vec2 pf=vec2(gl_FragCoord.x/uRes.x, 1.0-gl_FragCoord.y/uRes.y); /* espace image, y vers le bas */
  vec2 q=uOff+uK*pf;
  vec2 n=vec2(1.0,1.0)/SQRT2;
  float diag=dot(q,n);
  float fold=mix(1.47,1.02,uT);
  float d=diag-fold;
  float thetaMax=max((SQRT2-fold)/R,0.0);
  float ext=R*sin(thetaMax);
  float aa=1.6/uRes.x;
  float flat=smoothstep(aa,-aa,d);
  float flap=(1.0-flat)*smoothstep(ext+aa,ext-aa,d);
  vec3 col=vec3(0.0);
  vec3 img=texture2D(uImg,q).rgb;
  img*=1.0-0.16*uT*smoothstep(0.028,0.0,abs(d));
  col+=flat*img;
  if(flap>0.001){
    float dC=min(d,ext-0.0002);
    float s=dC*1.15;
    for(int i=0;i<16;i++){float th=s/R;s+=(dC-R*sin(th))/max(cos(th),0.25);}
    float theta=clamp(s/R,0.0,thetaMax);
    vec2 uvOrig=q+n*(s-dC);
    vec3 N=normalize(vec3(n.x*cos(theta),n.y*cos(theta),sin(theta)));
    vec3 L=normalize(vec3(-0.35,-0.5,0.78));
    float lam=max(dot(N,L),0.0);
    float spec=pow(max(dot(N,normalize(L+vec3(0.,0.,1.))),0.0),42.0)*0.5;
    float k=pow(max(1.0-theta/1.35,0.0),1.3);
    vec3 paper=mix(vec3(0.176,0.204,0.243),vec3(0.522,0.553,0.616),k);
    vec3 ghost=texture2D(uImg,clamp(uvOrig,0.0,1.0)).rgb;
    vec3 under=paper*(0.30+0.80*lam)+spec*vec3(1.0,0.97,0.90)+ghost*0.05;
    under+=vec3(0.85,0.92,1.0)*0.30*smoothstep(thetaMax-0.10,thetaMax,theta);
    col+=flap*under;
  }
  float cardM=clamp(1.0-flat-flap,0.0,1.0);
  vec3 cardC=texture2D(uCard,q).rgb;
  float sh=clamp(0.55*uT*max(1.0-(d-ext)/0.20,0.0),0.0,1.0);
  col+=cardM*cardC*(1.0-sh);
  gl_FragColor=vec4(col,1.0);
}`;

function mountCurl(button, opts = {}) {
  if (button._curl) return button._curl;
  const revealDelay = opts.revealDelay ?? 1600;
  const rest = opts.rest ?? 0.32;                 // amplitude au repos après révélation
  const canvas = document.createElement('canvas');
  button.replaceChildren(canvas);
  const gl = canvas.getContext('webgl', { alpha: true, antialias: true });
  if (!gl) { button._curl = null; return null; }  // repli SVG conservé si WebGL absent

  const vs = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vs, 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}');
  gl.compileShader(vs);
  const fs = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fs, FS); gl.compileShader(fs);
  if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) { console.error(gl.getShaderInfoLog(fs)); button._curl = null; return null; }
  const prog = gl.createProgram();
  gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog); gl.useProgram(prog);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const a = gl.getAttribLocation(prog, 'a');
  gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
  const U = n => gl.getUniformLocation(prog, n);
  const uRes = U('uRes'), uT = U('uT'), uK = U('uK'), uOff = U('uOff');
  gl.uniform1i(U('uImg'), 0); gl.uniform1i(U('uCard'), 1);

  function upload(unit, src) {
    const t = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }

  let photo = null, card = null, imgEl = null, cardSrc = null;
  let t = 0, target = 0, revealed = false, timer = 0, raf = 0;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  function syncTexture() {
    if (imgEl && imgEl.complete && imgEl.naturalWidth) {
      if (photo) gl.deleteTexture(photo);
      photo = upload(0, imgEl);
    }
    if (cardSrc) { if (card) gl.deleteTexture(card); card = upload(1, cardSrc); }
  }

  function fit() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const w = Math.max(2, Math.round(canvas.clientWidth * dpr));
    const h = Math.max(2, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    gl.uniform2f(uRes, canvas.width, canvas.height);
    // Fenêtre du badge exprimée dans la photo affichée (coin bas-droit)
    const pr = imgEl?.getBoundingClientRect?.(), cr = canvas.getBoundingClientRect();
    if (pr && pr.width && cr.width) {
      gl.uniform2f(uK, Math.min(1, cr.width / pr.width), Math.min(1, cr.height / pr.height));
      gl.uniform2f(uOff,
        Math.min(1, Math.max(0, (pr.right - cr.right) / pr.width)),
        Math.min(1, Math.max(0, (pr.bottom - cr.bottom) / pr.height)));
    } else { gl.uniform2f(uK, 1, 1); gl.uniform2f(uOff, 0, 0); }
  }

  function frame() {
    t += (target - t) * (reduced ? 1 : 0.085);
    if (Math.abs(target - t) < 0.0006) t = target;
    fit();
    if (photo) { gl.uniform1f(uT, t); gl.drawArrays(gl.TRIANGLES, 0, 3); }
    raf = requestAnimationFrame(frame);
  }

  button.addEventListener('pointerenter', e => { if (e.pointerType !== 'touch' && revealed) target = 1; });
  button.addEventListener('pointerleave', () => { if (revealed) target = rest; });

  const ctl = button._curl = {
    canvas,
    updatePhoto(img, cardCanvas) {
      if (imgEl) imgEl.removeEventListener('load', syncTexture);
      imgEl = img; cardSrc = cardCanvas;
      imgEl.addEventListener('load', syncTexture);
      revealed = false; target = 0; t = 0;
      syncTexture();
      clearTimeout(timer);
      timer = setTimeout(() => { if (imgEl === img) { revealed = true; target = rest; } }, revealDelay);
    },
    openNow() { revealed = true; target = 1; },
    destroy() { cancelAnimationFrame(raf); clearTimeout(timer); if (imgEl) imgEl.removeEventListener('load', syncTexture); button._curl = null; }
  };
  raf = requestAnimationFrame(frame);
  return ctl;
}

const WASM_URL = 'https://cdn.jsdelivr.net/npm/@contentauth/c2pa-web@0.15.4/dist/resources/c2pa_bg.wasm';
const IMAGE_RE = /\.(jpe?g|png|webp|tiff?)$/i;

const grid = document.querySelector('#grid');
const emptyBox = document.querySelector('#empty');
const countEl = document.querySelector('#count');
const search = document.querySelector('#search');
const lightbox = document.querySelector('#lightbox');
const credentials = document.querySelector('#credentials');
const crBadge = document.querySelector('#cr-badge');
const lbPhoto = document.querySelector('#lb-photo');
// Le badge suit la largeur RÉELLEMENT affichée de la photo, pas celle du viewport.
// Sur grand écran, plafond à 80 % de l'ancien logo de 42 px.
function resizeAfpBadge() {
  const width = lbPhoto.getBoundingClientRect().width;
  if (!width) return;
  const height = Math.min(33.6, Math.max(12, width * 0.065));
  crBadge.style.setProperty('--afp-logo-height', `${height}px`);
  crBadge.style.setProperty('--afp-dot-size', `${Math.max(6, Math.min(9, height * 0.27))}px`);
}
const afpResizeObserver = new ResizeObserver(resizeAfpBadge);
afpResizeObserver.observe(lbPhoto);
lbPhoto.addEventListener('load', resizeAfpBadge);
window.addEventListener('resize', resizeAfpBadge);
const lbTitle = document.querySelector('#lb-title');
const lbStatus = document.querySelector('#lb-status');
const lbSummary = document.querySelector('#lb-summary');
const lbJson = document.querySelector('#lb-json');
const dropZone = document.querySelector('#dropzone');

const photos = [];            // { url, name, blob?, state, store?, active?, validation?, error? }
let currentFilter = 'all';
let currentIdx = -1;
let c2pa = null;
let c2paPromise = null;

/* ---------- Mode A : index photos.json (généré par CI) ---------- */
/* Renvoie { state: 'ok' | 'missing' | 'empty', urls: string[] } */
async function probeIndex() {
  try {
    const r = await fetch('./photos.json', { cache: 'no-store' });
    if (!r.ok) return { state: 'missing', urls: [] };
    const data = await r.json();
    const list = Array.isArray(data) ? data : data.photos;
    const urls = (list ?? []).map(p => p.url ?? p).filter(u => IMAGE_RE.test(u));
    return { state: urls.length ? 'ok' : 'empty', urls };
  } catch (_) {
    return { state: 'missing', urls: [] }; // file:// : fetch bloqué par le navigateur
  }
}

/* ---------- Mode A2 : lecture directe du dossier PHOTOS/ via l'API GitHub ----------
   Un navigateur ne peut pas lister un dossier distant, mais l'API GitHub, elle, le peut.
   Auto-détection du repo depuis l'URL github.io ; sinon, renseignez GITHUB_REPO. */
const GITHUB_REPO = ''; // ex. 'antonin/c2pa-galerie' — laissez vide pour la détection auto
function detectRepo() {
  if (GITHUB_REPO) return GITHUB_REPO;
  const host = location.hostname;
  if (host.endsWith('.github.io')) {
    const owner = host.slice(0, -'.github.io'.length);
    const parts = location.pathname.split('/').filter(Boolean);
    // Site utilisateur (owner.github.io) → repo = owner.github.io ; site projet → 1er segment
    return parts.length ? `${owner}/${parts[0]}` : `${owner}.github.io`;
  }
  return null; // domaine personnalisé : renseignez GITHUB_REPO
}
async function githubApiList() {
  const repo = detectRepo();
  if (!repo) return [];
  try {
    const r = await fetch(`https://api.github.com/repos/${repo}/contents/PHOTOS`, { cache: 'no-store' });
    if (!r.ok) return [];
    const items = await r.json();
    if (!Array.isArray(items)) return [];
    return items
      .filter(i => i.type === 'file' && IMAGE_RE.test(i.name))
      .map(i => `./PHOTOS/${i.name}`);
  } catch (_) { return []; }
}

/* ---------- Mode B : glisser-déposer (fichiers ou dossier) ---------- */
function collectFromDataTransfer(items) {
  const entries = [...items].map(i => i.webkitGetAsEntry?.()).filter(Boolean);
  const files = [];
  const walk = (entry, path = '') => new Promise(resolve => {
    if (entry.isFile) {
      entry.file(f => { f.webkitRelativePath = path + entry.name; files.push(f); resolve(); },
                 () => resolve());
    } else if (entry.isDirectory) {
      const reader = entry.createReader();
      const all = [];
      const readBatch = () => reader.readEntries(async batch => {
        if (!batch.length) {
          await Promise.all(all.map(e => walk(e, path + entry.name + '/')));
          resolve();
        } else {
          all.push(...batch);
          readBatch(); // readEntries ne renvoie que ~100 entrées par appel
        }
      }, () => resolve());
      readBatch();
    } else resolve();
  });
  return Promise.all(entries.map(e => walk(e))).then(() => files);
}

function addFiles(files) {
  let imgs = [...files].filter(f => IMAGE_RE.test(f.name));
  if (!imgs.length) return false;
  // Si l'import contient un sous-dossier PHOTOS/, ne garder que ses photos :
  // évite d'ajouter le logo ou d'autres images d'interface lors d'un
  // glisser-déposer du dossier complet du projet.
  const inPhotos = imgs.filter(f => (f.webkitRelativePath || '').split('/').includes('PHOTOS'));
  if (inPhotos.length) imgs = inPhotos;
  imgs.forEach(f => {
    photos.push({
      url: URL.createObjectURL(f),
      blob: f,
      name: f.webkitRelativePath || f.name,
      idx: photos.length,
      state: 'loading',
    });
  });
  rebuildGrid();
  analyzeAll();
  return true;
}

/* Lecture locale des dates EXIF JPEG (aucune date n'est inventée).
   DateTimeOriginal 0x9003, OffsetTimeOriginal 0x9011 ; repli OffsetTime 0x9010. */
async function readExifCaptureDate(blob) {
  try {
    const data = new DataView(await blob.arrayBuffer());
    if (data.byteLength < 12 || data.getUint16(0) !== 0xffd8) return null;
    let pos = 2;
    while (pos + 4 <= data.byteLength) {
      if (data.getUint8(pos) !== 0xff) break;
      const marker = data.getUint8(pos + 1);
      if (marker === 0xda || marker === 0xd9) break;
      if (marker === 0x01 || marker >= 0xd0 && marker <= 0xd7) { pos += 2; continue; }
      const length = data.getUint16(pos + 2);
      if (length < 2 || pos + 2 + length > data.byteLength) break;
      const base = pos + 4;
      if (marker === 0xe1 && length >= 8 && [69,120,105,102,0,0].every((v,i) => data.getUint8(base+i) === v)) {
        const tiff = base + 6;
        const endian = data.getUint16(tiff);
        if (endian !== 0x4949 && endian !== 0x4d4d) return null;
        const le = endian === 0x4949;
        const u16 = p => p >= tiff && p+2 <= data.byteLength ? data.getUint16(p,le) : null;
        const u32 = p => p >= tiff && p+4 <= data.byteLength ? data.getUint32(p,le) : null;
        if (u16(tiff+2) !== 42) return null;
        function entries(offset) {
          const start=tiff+offset, n=u16(start), result=new Map();
          if (n === null || n > 1024 || start+2+n*12 > data.byteLength) return result;
          for (let i=0;i<n;i++) {
            const e=start+2+i*12, tag=u16(e), type=u16(e+2), count=u32(e+4);
            if (tag === null || count === null) continue;
            if (type === 2 && count > 0 && count <= 256) {
              const at=count<=4 ? e+8 : tiff+u32(e+8);
              if (at >= tiff && at+count <= data.byteLength) {
                let str=''; for(let j=0;j<count;j++){const ch=data.getUint8(at+j);if(!ch)break;str+=String.fromCharCode(ch);}
                result.set(tag,str.trim());
              }
            } else if (type === 4 && count === 1) result.set(tag,u32(e+8));
          }
          return result;
        }
        const root=entries(u32(tiff+4));
        const exif=typeof root.get(0x8769)==='number' ? entries(root.get(0x8769)) : new Map();
        const raw=exif.get(0x9003);
        if (!/^\d{4}:\d{2}:\d{2} \d{2}:\d{2}:\d{2}$/.test(raw||'')) return null;
        const offset=exif.get(0x9011)||exif.get(0x9010)||'';
        return `${raw.slice(8,10)}/${raw.slice(5,7)}/${raw.slice(0,4)} ${raw.slice(11)}${/^[+-]\d{2}:\d{2}$/.test(offset) ? ' (UTC'+offset+')' : ''}`;
      }
      pos += 2 + length;
    }
  } catch (err) { console.warn('Lecture EXIF',err); }
  return null;
}

/* ---------- Analyse C2PA ---------- */
async function ensureC2pa() {
  if (!c2paPromise) c2paPromise = createC2pa({ wasmSrc: WASM_URL }).catch(e => { c2paPromise = null; throw e; });
  return c2paPromise;
}

async function getBlob(photo) {
  if (photo.blob) return photo.blob;
  return (await fetch(photo.url, { cache: 'no-store' })).blob();
}

async function analyze(photo) {
  if (photo.state !== 'loading') return; // déjà analysée
  try {
    const blob = await getBlob(photo);
    photo.exifDate = await readExifCaptureDate(blob);
    const engine = await ensureC2pa();
    const ext = photo.name.split('.').pop().toLowerCase();
    const reader = await Reader.fromBlob(engine, ext, blob);
    if (!reader) { photo.state = 'none'; return; }
    const store = await reader.manifestStore();
    photo.store = store;
    const entries = store?.validation_status ?? store?.validationStatus ?? [];
    const list = Array.isArray(entries) ? entries : [];
    photo.validation = list;
    photo.active = await reader.activeManifest().catch(() => null);
    const levels = list.map(validationLevel);
    photo.state = !store ? 'none' : levels.includes('bad') ? 'bad' : levels.includes('warn') ? 'warn' : levels.includes('neutral') || !list.length ? 'warn' : 'ok';
    try { await reader.free(); } catch (_) {}
  } catch (e) {
    console.warn('C2PA', photo.name, e);
    photo.error = e.message ?? String(e);
    photo.state = 'error';
  }
}

/* Analyse parallèle limitée */
async function analyzeAll(limit = 3) {
  const queue = () => photos.filter(p => p.state === 'loading' && !p.processing);
  const workers = Array.from({ length: limit }, async () => {
    while (queue().length) {
      const p = queue().shift();
      if (!p || p.processing) continue;
      p.processing = true;
      await analyze(p);
      p.processing = false;
      renderCard(p);
      updateCount();
      refreshSidePanel(p);
    }
  });
  await Promise.all(workers);
}

/* ---------- Rendu ---------- */
const LABEL = { loading: 'Analyse…', ok: 'Vérifiée', warn: 'À vérifier ⚠', bad: 'Échec ✕', none: 'Sans C2PA', error: 'Erreur de lecture' };

const PRESENTATIONS = ['info','afp','direct','banner','status','corner','glow','seal','drawer','shield','delayed','tap','caption','shield-delayed'];
const modeSelect = document.querySelector('#presentation-mode');
let selectedMode = 'random';
function presentationFor(photo) {
  if (!photo.demoStyle || !PRESENTATIONS.includes(photo.demoStyle))
    photo.demoStyle = PRESENTATIONS[Math.floor(Math.random()*PRESENTATIONS.length)];
  return selectedMode === 'random' ? photo.demoStyle : selectedMode;
}
// Animation du repli par déformation géométrique réelle (pas de translation/saut).
// Le repli se déploie sans bouger son point d'attache : le coin inférieur droit.
function installPageCurl(button, svg) {
  const isLarge = button.id === 'cr-badge';
  const parts = Object.fromEntries(['fold-under','fold-shadow','fold-paper','fold-edge','fold-highlight'].map(k=>[k,svg.querySelector('.'+k)]));
  let current=0, desired=0, animation=0, delay=0, active=false;
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function paint(t) {
    // Courbe enroulée : le bord libre se creuse tandis que la pointe reste attachée.
    const reach=16+65*t, p=100-reach;
    const edge=`M ${p} 100 C ${p+reach*.17} ${100-reach*.06} ${100-reach*.18} ${p+reach*.08} 100 ${p}`;
    const back=`${edge} C ${100-reach*.08} ${p+reach*.58} ${p+reach*.55} ${100-reach*.1} ${p} 100 Z`;
    const underside=`M ${p} 100 C ${p+reach*.30} ${100-reach*.26} ${100-reach*.24} ${p+reach*.30} 100 ${p} L100 100 Z`;
    const shade=`M ${p-4} 100 C ${p+reach*.14} ${100-reach*.18} ${100-reach*.18} ${p+reach*.14} 100 ${p-4} L100 100 Z`;
    parts['fold-under'].setAttribute('d',underside);
    parts['fold-shadow'].setAttribute('d',shade);
    parts['fold-paper'].setAttribute('d',back);
    parts['fold-edge'].setAttribute('d',edge);
    parts['fold-highlight'].setAttribute('d',`M ${p+2} 100 C ${p+reach*.2} ${100-reach*.10} ${100-reach*.15} ${p+reach*.14} 100 ${p+2}`);
    parts['fold-paper'].style.opacity=String(.64+.30*t);
    parts['fold-shadow'].style.opacity=String(.45+.35*t);
  }
  function tick(){
    current+=(desired-current)*.10;
    paint(current);
    if(Math.abs(desired-current)>.003)animation=requestAnimationFrame(tick);
    else {current=desired;paint(current);animation=0;}
  }
  function lift(to){desired=reduced?to:to;if(reduced){current=desired;paint(current);}else if(!animation)animation=requestAnimationFrame(tick);}
  function reveal(){button.classList.add('curl-ready');active=true;paint(0);lift(.25);}
  if(isLarge){delay=setTimeout(()=>{if(button.isConnected && button.classList.contains('mode-corner'))reveal();},2000);}
  else {reveal();}
  button.addEventListener('pointerenter',e=>{if(active&&e.pointerType!=='touch')lift(1);});
  button.addEventListener('pointerleave',()=>{if(active)lift(.25);});
  button.addEventListener('focus',()=>{if(active)lift(1);});
  button.addEventListener('blur',()=>{if(active)lift(.25);});
  // Sur mobile, premier toucher = dérouler, deuxième = fiche de provenance.
  button.addEventListener('pointerdown',e=>{
    if(e.pointerType==='touch'&&active){
      if(!button.classList.contains('curl-touched')){
        e.preventDefault();button.classList.add('curl-touched');lift(1);
      }
    }
  });
  button.addEventListener('click',e=>{
    if(!active){e.stopImmediatePropagation();return;}
    if(button.classList.contains('curl-touched') && !button.dataset.curlArmed){
      e.stopImmediatePropagation();button.dataset.curlArmed='1';return;
    }
  },true);
  button.addEventListener('pointercancel',()=>lift(.25));
}
function setCurlTheme(button){
  // Préférence explicite --c2pa-page-under, sinon couleur réelle du fond du visualiseur.
  const frame=button.closest('.lb-frame')||button.parentElement;
  let node=frame, rgb=null;
  while(node){
    const c=getComputedStyle(node).backgroundColor;
    const m=c.match(/rgba?\((\d+)[, ]+\s*(\d+)[, ]+\s*(\d+)(?:[, /]+([\d.]+))?\)/);
    if(m && (m[4]===undefined||Number(m[4])>.9)){rgb=[+m[1],+m[2],+m[3]];break;}
    node=node.parentElement;
  }
  const theme=getComputedStyle(document.documentElement).getPropertyValue('--c2pa-page-under').trim();
  const bg=theme || (rgb?`rgb(${rgb.join(',')})`:'#10151d');
  const light=rgb ? ((rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722)>140) : false;
  button.style.setProperty('--curl-under',bg);
  button.style.setProperty('--curl-shadow',light?'rgba(0,0,0,.27)':'rgba(0,0,0,.72)');
}
function addBadgeContent(target, mode, state) {
  target.replaceChildren();
  target.classList.add('mode-' + mode);
  if (mode === 'direct') return;
  if (mode === 'info') {
    const el=document.createElement('span'); el.className='info-symbol';
    el.textContent='i'; target.append(el);
  } else if (mode === 'afp') {
    const logo=document.createElement('img'); logo.src='./afp-gelule.png';
    logo.alt='AFP'; logo.className='afp-tab-art'; target.append(logo);
    target.classList.add('afp-tab');
  } else if (mode === 'banner') {
    const el=document.createElement('span'); el.className='banner-label';
    el.textContent='Voir la provenance'; target.append(el);
  } else if (mode === 'glow') {
    const ns='http://www.w3.org/2000/svg';
    const angle=document.createElementNS(ns,'svg');
    angle.setAttribute('class','provenance-glow-angle');
    angle.setAttribute('viewBox','0 0 48 48');
    angle.setAttribute('aria-hidden','true');
    angle.innerHTML='<path d="M 6 43 H 35 Q 43 43 43 35 V 6" fill="none" stroke="#A7D8FF" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" />';
    target.append(angle);
  } else if (mode === 'seal') {
    const ns='http://www.w3.org/2000/svg';
    const svg=document.createElementNS(ns,'svg');
    svg.setAttribute('class','provenance-fingerprint');
    svg.setAttribute('viewBox','0 0 24 24');
    svg.setAttribute('fill','none');
    svg.setAttribute('stroke','currentColor');
    svg.setAttribute('stroke-width','1.35');
    svg.setAttribute('stroke-linecap','round');
    svg.setAttribute('stroke-linejoin','round');
    svg.setAttribute('aria-hidden','true');
    svg.innerHTML=`<path d="M12 3a9 9 0 0 0-9 9"/><path d="M21 12a9 9 0 0 0-9-9"/><path d="M5.6 16c.6-2.1.3-3.6.5-5.1a6 6 0 0 1 11.8 1.1"/><path d="M9 20c1.2-2.3 1.5-4.7 1.3-7.5a1.7 1.7 0 1 1 3.4 0c.1 4-.3 6.2-1.4 8.5"/><path d="M15.9 19c.8-2.5 1-4.4.8-6.9"/><path d="M7 19c.4-.9.8-2.1 1-3.2"/><path d="M19 16.5c.2-1.4.3-2.5.2-4"/>`;
    target.append(svg);
  } else if (mode === 'drawer') {
    const handle=document.createElement('span'); handle.className='provenance-drawer-handle';
    target.append(handle);
  } else if (mode === 'shield' || mode === 'shield-delayed') {
    const ns='http://www.w3.org/2000/svg';
    const svg=document.createElementNS(ns,'svg');
    svg.setAttribute('class','provenance-shield');
    svg.setAttribute('viewBox','0 0 24 24');
    svg.setAttribute('aria-hidden','true');
    svg.innerHTML='<path d="M12 2.5 20 6v5.5c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10V6z" fill="rgba(15,24,38,.32)" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="m8.3 12 2.6 2.7 4.9-5.4" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>';
    target.append(svg);
  } else if (mode === 'delayed') {
    const badge=document.createElement('span');badge.className='delayed-badge';
    badge.textContent='◈  Provenance';target.append(badge);
    target.classList.add('delayed-pending');
  } else if (mode === 'tap') {
    // Aucun indicateur visible au repos ; la photo elle-même est interactive.
  } else if (mode === 'caption') {
    const label=document.createElement('span');label.className='caption-marker';
    label.textContent='Source sous la photo ↓';target.append(label);
  } else if (mode === 'corner') {
    if (target.id === 'cr-badge') {
      // SVG stable sur ordinateur et mobile, sans dépendance WebGL.
      const ns='http://www.w3.org/2000/svg';
      const svg=document.createElementNS(ns,'svg');
      svg.setAttribute('class','page-corner');
      svg.setAttribute('viewBox','0 0 100 100');
      svg.setAttribute('aria-hidden','true');
      svg.innerHTML=`<defs><linearGradient id="curlBackMain" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d6dce5"/><stop offset=".55" stop-color="#f6f7fa"/><stop offset="1" stop-color="#929caa"/></linearGradient></defs>
      <path class="fold-shadow"/><path class="fold-under"/>
      <path class="fold-paper" fill="url(#curlBackMain)"/>
      <path class="fold-edge" fill="none" stroke="rgba(255,255,255,.8)" stroke-width="1.2"/>
      <path class="fold-highlight" fill="none" stroke="rgba(255,255,255,.4)" stroke-width="2"/>`;
      target.append(svg);
      setCurlTheme(target);
      installPageCurl(target,svg);
    } else {
      // Miniatures : repli SVG léger d'origine.
      const ns='http://www.w3.org/2000/svg';
      const svg=document.createElementNS(ns,'svg');
      svg.setAttribute('class','page-corner');
      svg.setAttribute('viewBox','0 0 100 100');
      svg.setAttribute('aria-hidden','true');
      svg.innerHTML=`
        <defs>
          <linearGradient id="curlBack" x1=".1" y1=".1" x2="1" y2="1">
            <stop offset="0" stop-color="#f8f9fc" stop-opacity=".12"/>
            <stop offset=".45" stop-color="#e1e4ea" stop-opacity=".78"/>
            <stop offset=".8" stop-color="#f8f9fc" stop-opacity=".94"/>
            <stop offset="1" stop-color="#929ba9" stop-opacity=".60"/>
          </linearGradient>
        </defs>
        <path class="fold-shadow"/>
        <path class="fold-under"/>
        <path class="fold-paper" fill="url(#curlBack)"/>
        <path class="fold-edge" fill="none" stroke="rgba(255,255,255,.75)" stroke-width=".85"/>
        <path class="fold-highlight" fill="none" stroke="rgba(255,255,255,.28)" stroke-width="2"/>
      `;
      target.append(svg);
      installPageCurl(target,svg);
    }
  }
  // En mode pastille, le point coloré est l'unique élément.
  if (!['corner','glow','seal','drawer','shield','shield-delayed','delayed','tap','caption'].includes(mode)) {
    const dot=document.createElement('span'); dot.className='dot '+state;
    dot.setAttribute('aria-hidden','true'); target.append(dot);
  }
  target.setAttribute('aria-label', mode === 'corner' ? 'Soulever le coin pour voir la provenance C2PA' : mode === 'glow' ? 'Ouvrir la provenance C2PA depuis le coin lumineux' : mode === 'seal' ? 'Ouvrir la provenance C2PA depuis le sceau' : 'Voir la provenance C2PA');
}
function sourceLabel(photo) {
  const a=photo.active||{};
  const sig=a.signature_info||a.signatureInfo||{};
  const signer=sig.issuer||sig.signer||sig.organization||a.claim_generator||a.claimGenerator;
  return signer ? String(signer).slice(0,90) : 'Source non renseignée';
}
/* Carte révélée sous le coin enroulé (repli WebGL) : vraies données de la photo. */
function makeProvenanceCard(photo) {
  const w = lbPhoto.naturalWidth || 1024, h = lbPhoto.naturalHeight || 768;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d');
  x.fillStyle = '#101826'; x.fillRect(0, 0, w, h);
  const g = x.createRadialGradient(w * .86, h * .88, w * .04, w * .86, h * .88, w * .7);
  g.addColorStop(0, '#1b2a44'); g.addColorStop(1, '#101826');
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  const s = w / 1024;
  x.fillStyle = '#8fa3c8'; x.font = `700 ${30 * s}px system-ui,sans-serif`;
  x.fillText('CONTENT CREDENTIALS', 776 * s, 200 * s);
  x.fillStyle = '#fff'; x.font = `700 ${48 * s}px system-ui,sans-serif`;
  x.fillText('Source : ' + sourceLabel(photo).slice(0, 40), 776 * s, 268 * s);
  const lvl = photo.state === 'ok' ? ['#9be6b1', '#12683b']
    : (photo.state === 'bad' || photo.state === 'error') ? ['#ffb0b0', '#4b2325']
    : ['#ffcf77', '#4a3410'];
  x.fillStyle = lvl[0]; x.beginPath(); x.roundRect(776 * s, 300 * s, 210 * s, 44 * s, 22 * s); x.fill();
  x.fillStyle = lvl[1]; x.font = `700 ${24 * s}px system-ui,sans-serif`;
  x.fillText((LABEL[photo.state] || 'Provenance').slice(0, 20), 792 * s, 330 * s);
  return c;
}
function updateCaption(card,photo) {
  const el=card.querySelector('.caption-source');if(!el)return;
  el.hidden=true;
  el.textContent='Source : '+sourceLabel(photo)+'  ›';
}
let delayedTimer=0;
let delayedRevealReady=false;
function scheduleDelayedBadge(mode) {
  clearTimeout(delayedTimer);
  delayedRevealReady=false;
  crBadge.classList.remove('delayed-visible');
  if(mode==='delayed' || mode==='shield-delayed') delayedTimer=setTimeout(()=>{
    if(lightbox.open && currentIdx>=0 && ['delayed','shield-delayed'].includes(presentationFor(photos[currentIdx]))) {
      delayedRevealReady=true;
      crBadge.classList.add('delayed-visible');
    }
  },2000);
}
function redrawPresentations() {
  photos.forEach(photo => {
    const card=grid.querySelector(`[data-idx="${photo.idx}"]`);
    const overlay=card?.querySelector('.demo-overlay');
    if(overlay){overlay.className='demo-overlay';addBadgeContent(overlay,presentationFor(photo),photo.state);}
    if(card) updateCaption(card,photo);
  });
  if(currentIdx>=0) openLightbox(currentIdx);
}
modeSelect.addEventListener('change',()=>{
  selectedMode=modeSelect.value;
  redrawPresentations();
});
document.querySelector('#reshuffle').addEventListener('click',()=>{
  photos.forEach(p=>p.demoStyle=PRESENTATIONS[Math.floor(Math.random()*PRESENTATIONS.length)]);
  if(selectedMode!=='random'){selectedMode='random';modeSelect.value='random';}
  redrawPresentations();
});

function cardEl(photo) {
  const card = document.createElement('figure');
  card.className = 'card';
  card.dataset.idx = String(photo.idx);
  const img = document.createElement('img');
  img.loading = 'lazy';
  img.src = photo.url;
  img.alt = photo.name.split('/').pop();
  const tag = document.createElement('span');
  tag.className = `tag ${photo.state}`;
  tag.append(Object.assign(document.createElement('span'), { className: 'dot' }),
             document.createTextNode(LABEL[photo.state] ?? photo.state));
  const name = document.createElement('figcaption');
  name.className = 'name';
  name.textContent = photo.name.split('/').pop();
  const overlay = document.createElement('button');
  overlay.type='button'; overlay.className='demo-overlay';
  overlay.setAttribute('aria-label','Voir les informations C2PA');
  addBadgeContent(overlay,presentationFor(photo),photo.state);
  overlay.addEventListener('click',event=>{event.stopPropagation();openLightbox(photo.idx); if(presentationFor(photo)==='drawer') openBottomSheet(photo); else if(presentationFor(photo)==='tap') toggleTapReveal(photo); else openSidePanel(photo);});
  card.append(img, tag, name, overlay);
  const source=document.createElement('button');source.type='button';
  source.className='caption-source';source.hidden=true;
  source.addEventListener('click',e=>{e.stopPropagation();openLightbox(photo.idx);openSidePanel(photo);});
  card.append(source);
  updateCaption(card,photo);
  card.addEventListener('click', () => openLightbox(photo.idx));
  return card;
}

function renderCard(photo) {
  const card = grid.querySelector(`[data-idx="${photo.idx}"]`);
  if (!card) return;
  const tag = card.querySelector('.tag');
  tag.className = `tag ${photo.state}`;
  tag.textContent = '';
  tag.append(Object.assign(document.createElement('span'), { className: 'dot' }),
             document.createTextNode(LABEL[photo.state] ?? photo.state));
  const overlay = card.querySelector('.demo-overlay');
  if (overlay) { overlay.className='demo-overlay'; addBadgeContent(overlay,presentationFor(photo),photo.state); }
  updateCaption(card,photo);
  const overlayDot = card.querySelector('.demo-overlay .dot');
  if (overlayDot) overlayDot.className = `dot ${photo.state}`;
  applyFilterToCard(card, photo);
}

function applyFilterToCard(card, photo) {
  const visible = (!search.value.trim() || photo.name.toLowerCase().includes(search.value.trim().toLowerCase())) && (currentFilter === 'all' ||
    (currentFilter === 'none' && photo.state === 'none') ||
    photo.state === currentFilter);
  card.style.display = visible ? '' : 'none';
}

function updateCount() {
  const n = (s) => photos.filter(p => p.state === s).length;
  countEl.textContent = `${photos.length} photo(s) · ${n('ok')} vérifiée(s) · ${n('warn')} à vérifier · ${n('bad')} échec(s) · ${n('none')} sans C2PA · ${n('error')} erreur(s) de lecture`;
}

function rebuildGrid() {
  grid.replaceChildren(...photos.map(cardEl));
  photos.forEach(renderCard);
  updateCount();
}

/* ---------- Lightbox plein écran ---------- */
function setStatusLine(cls, text) {
  lbStatus.className = `status ${cls}`;
  lbStatus.textContent = text;
}

/* Métadonnées présentées sans inventer de valeurs absentes. */
function firstValue(...values) { return values.find(v => v !== undefined && v !== null && v !== '') ?? null; }
function readable(value) {
  if (value == null) return 'Non renseigné';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
// Aide courte : repliée par défaut pour préserver la place sur mobile.
const C2PA_FIELD_HELP = {
  'Intégrité du fichier': 'Vérifie que le fichier correspond aux données protégées par le manifeste C2PA.',
  'Signature numérique': 'Vérifie que les informations de provenance n’ont pas été modifiées après leur signature.',
  'Signataire déclaré': 'Organisme ou entreprise identifié dans le certificat ayant signé la provenance.',
  'Générateur': 'Appareil ou logiciel ayant créé les informations C2PA.',
  'Auteur / photographe': 'Personne déclarée comme auteur de la photo ; cette identité n’est pas forcément vérifiée.',
  'Horodatage certifié (TSA)': 'Date attestée par un tiers indépendant : la signature existait au plus tard à cet instant.',
  'Date de prise de vue (EXIF)': 'Date enregistrée par l’horloge de l’appareil, modifiable et non certifiée à elle seule.'
};
const c2paHelpStyle = document.createElement('style');
c2paHelpStyle.textContent = `
  .credential-row .field-label{min-width:0}
  .c2pa-help{display:inline;position:relative;margin-left:5px;font-weight:400}
  .c2pa-help>summary{display:inline-flex;vertical-align:middle;align-items:center;justify-content:center;width:17px;height:17px;border:1px solid #8498b2;border-radius:50%;color:#b9c9dd;font-size:11px;font-weight:700;cursor:pointer;list-style:none;user-select:none}
  .c2pa-help>summary::-webkit-details-marker{display:none}
  .c2pa-help[open]>summary{background:#38536f;color:white}
  .c2pa-help .c2pa-help-copy{display:block;margin:7px 0 2px;padding:9px 10px;background:#2a3b4e;color:#eef4ff;border-radius:7px;font-size:12px;font-weight:400;line-height:1.45;max-width:290px;overflow-wrap:break-word}
  .credential-row:has(.c2pa-help[open]) .field-label{overflow:visible}
  @media(max-width:560px){.c2pa-help .c2pa-help-copy{max-width:min(260px,70vw)}}
`;
document.head.append(c2paHelpStyle);

function field(label, value, level = 'ok', help = '') {
  const row = document.createElement('div'); row.className = 'credential-row';
  const marker = document.createElement('span'); marker.className = `signal ${level}`;
  marker.textContent = level === 'ok' ? '✓' : level === 'warn' ? '!' : level === 'bad' ? '×' : 'i';
  marker.setAttribute('aria-label', level === 'ok' ? 'Information présente' : level === 'warn' ? 'À vérifier' : level === 'bad' ? 'Problème détecté' : 'Information indisponible');
  const name = document.createElement('div'); name.className = 'field-label'; name.append(document.createTextNode(label));
  if (C2PA_FIELD_HELP[label]) {
    const hint = document.createElement('details'); hint.className = 'c2pa-help';
    const trigger = document.createElement('summary'); trigger.textContent = 'i';
    trigger.setAttribute('aria-label', 'Explication : ' + label);
    trigger.title = 'Que signifie « ' + label + ' » ?';
    const copy = document.createElement('span'); copy.className = 'c2pa-help-copy';
    copy.textContent = C2PA_FIELD_HELP[label];
    hint.append(trigger, copy); name.append(hint);
  }
  const detail = document.createElement('div'); detail.className = 'field-value'; detail.textContent = readable(value);
  if (help) { const note = document.createElement('small'); note.textContent = help; detail.append(note); }
  row.append(marker, name, detail); return row;
}
function section(title, rows) {
  const block = document.createElement('section'); block.className = 'credential-section';
  const heading = document.createElement('h3'); heading.textContent = title;
  const dl = document.createElement('div'); dl.className = 'credential-fields';
  dl.append(...rows); block.append(heading, dl); return block;
}
function present(value) { return value === null || value === undefined || value === '' ? 'neutral' : 'ok'; }
function validationLevel(v) {
  const code = String(typeof v === 'string' ? v : v?.code ?? v?.status ?? '').toLowerCase();
  if (/mismatch|invalid|tamper|failure|error|hash|revoked|expired/.test(code)) return 'bad';
  if (/untrusted|unknown|unsupported|warning|not.?trusted/.test(code)) return 'warn';
  if (/success|valid|trusted|match/.test(code)) return 'ok';
  return 'neutral';
}
function signatureOf(a) {
  const sig = firstValue(a.signature_info, a.signatureInfo, a.signature);
  return Array.isArray(sig) ? sig[0] ?? {} : sig ?? {};
}
function validationText(v) { return typeof v === 'string' ? v : firstValue(v?.code, v?.status, JSON.stringify(v)); }

function openLightbox(idx) {
  currentIdx = idx;
  const photo = photos[idx];
  lbTitle.textContent = photo.name.split('/').pop();
  lbPhoto.src = photo.url;
  lbPhoto.alt = photo.name.split('/').pop();
  crBadge.className = `cr ${photo.state}`;
  const mode=presentationFor(photo);
  const captionBtn=document.querySelector('#lb-caption-source');
  lightbox.classList.toggle('caption-layout',mode==='caption');
  captionBtn.hidden=mode!=='caption';
  captionBtn.textContent='Source : '+sourceLabel(photo)+'  ›';
  closeBottomSheet();
  hideTapReveal();
  crBadge.className=`cr ${photo.state}`;
  addBadgeContent(crBadge,mode,photo.state);
  const curl = crBadge._curl;
  if (curl) curl.updatePhoto(lbPhoto, makeProvenanceCard(photo));
  scheduleDelayedBadge(mode);
  lightbox.classList.toggle('direct-layout',mode==='direct');
  if(mode==='direct'){
    openSidePanel(photo);
    sidePanel.classList.add('direct-visible');
  } else {
    sidePanel.hidden=true;
    sidePanel.classList.remove('direct-visible');
    sidePhoto=null;
  }
  setStatusLine(photo.state === 'loading' ? 'loading' : photo.state, 'Chargement des informations…');
  lbSummary.replaceChildren();
  lbJson.textContent = 'Chargement…';
  // Si le panneau était ouvert sur la photo précédente, on le ferme.
  if (credentials.open) credentials.close();
  if (!lightbox.open) lightbox.showModal();
  requestAnimationFrame(syncLargeCaptionWidth);
  analyze(photo).then(() => {
    if (currentIdx >= 0 && photos[currentIdx] === photo) {
      crBadge.className = `cr ${photo.state}`;
      addBadgeContent(crBadge,presentationFor(photo),photo.state);
      if(['delayed','shield-delayed'].includes(presentationFor(photo)) && delayedRevealReady) crBadge.classList.add('delayed-visible');
      if (!bottomSheet.hidden && bottomPhoto === photo) refreshBottomSheet(photo);
      if (!sidePanel.hidden) refreshSidePanel(photo);
      if (credentials.open) fillDetails(photo); // rafraîchir le panneau déjà ouvert
      renderCard(photo);
      if (presentationFor(photo)==='caption') {
        document.querySelector('#lb-caption-source').textContent='Source : '+sourceLabel(photo)+'  ›';
        syncLargeCaptionWidth();
      }
      updateCount();
    }
  });
}

/* ---------- Panneau Content Credentials (bouton logo AFP) ---------- */
function fillDetails(photo) {
  if (photo.state === 'loading') {
    setStatusLine('loading', 'Vérification C2PA en cours…');
    lbSummary.replaceChildren();
    lbJson.textContent = 'Chargement…';
    return;
  }
  if (photo.state === 'error') {
    setStatusLine('error', `Impossible de lire le manifeste : ${photo.error}`);
    lbSummary.replaceChildren();
    lbJson.textContent = photo.error;
    return;
  }
  if (photo.state === 'none') {
    setStatusLine('none', 'Aucun manifeste C2PA intégré détecté.');
    lbSummary.replaceChildren();
    lbJson.textContent = 'Aucun manifeste trouvé.';
    return;
  }
  const entries = photo.validation ?? [];
  const levels = entries.map(validationLevel);
  if (levels.includes('bad')) setStatusLine('error', 'Manifeste présent, mais une ou plusieurs vérifications ont échoué.');
  else if (levels.includes('warn')) setStatusLine('warn', 'Manifeste présent, mais la confiance du signataire nécessite une vérification.');
  else if (!entries.length || levels.includes('neutral')) setStatusLine('warn', 'Manifeste présent, mais la validation complète ne peut pas être confirmée.');
  else setStatusLine('ok', 'Contrôles C2PA retournés sans problème signalé. Cela ne prouve pas la véracité de la scène.');
  const a = photo.active ?? {};
  const sig = signatureOf(a);
  const generator = firstValue(a.claim_generator, a.claimGenerator, a.claim_generator_info?.[0]?.name, a.claimGeneratorInfo?.[0]?.name);
  const signer = firstValue(sig.name, sig.issuer, sig.organization, a.signer);
  const manifest = firstValue(photo.store?.active_manifest, photo.store?.activeManifest);
  const signerLevel = levels.includes('bad') ? 'bad' : levels.includes('warn') || !entries.length ? 'warn' : present(signer);
  // Ne pas déduire une intégrité valide de la seule présence d'un manifeste.
  const codes = entries.map(v => String(typeof v === 'string' ? v : v?.code ?? v?.status ?? '').toLowerCase());
  const hasIntegrityFailure = codes.some(c => /assertion\.datahash\.mismatch|assertion\.bmffhash\.mismatch|assertion\.hasheduri\.mismatch|assertion\.boxhash\.mismatch|hash\.mismatch/.test(c));
  const hasSignatureFailure = codes.some(c => /claimsignature\.mismatch|claimsignature\.invalid|signature\.invalid/.test(c));
  const hasUntrustedSigner = codes.some(c => /signingcredential\.untrusted|signingcredential\.unknown/.test(c));
  // Un statut global positif sans détail ne prouve pas individuellement ces contrôles.
  const integrityStatus = hasIntegrityFailure ? 'Échec' : 'Non confirmé séparément';
  const signatureStatus = hasSignatureFailure ? 'Échec' : hasUntrustedSigner ? 'Confiance à vérifier' : 'Non confirmé séparément';
  const integrityLevel = hasIntegrityFailure ? 'bad' : 'neutral';
  const signatureLevel = hasSignatureFailure ? 'bad' : hasUntrustedSigner ? 'warn' : 'neutral';

  // Auteur : seulement une déclaration explicite dans les métadonnées C2PA.
  const assertions = Array.isArray(a.assertions) ? a.assertions : [];
  const metadata = assertions.filter(x => /metadata|creativework|stds\.schema-org/i.test(String(x?.label ?? x?.type ?? '')))
    .map(x => x?.data ?? x).filter(x => x && typeof x === 'object');
  const authorValue = firstValue(a.author, a.creator, ...metadata.map(m => m.author ?? m.creator));
  function authorName(v) {
    if (Array.isArray(v)) return v.map(authorName).filter(Boolean).join(', ') || null;
    if (typeof v === 'string') return v;
    if (v && typeof v === 'object') return firstValue(v.name, v['@id']);
    return null;
  }
  const author = authorName(authorValue);

  const validationSection = document.createElement('section'); validationSection.className = 'credential-section';
  const vh = document.createElement('h3'); vh.textContent = 'Résultats techniques de validation';
  const vl = document.createElement('div'); vl.className = 'validation-list';
  if (entries.length) entries.forEach(v => {
    const line = document.createElement('div'); line.className = 'validation-item';
    const level = validationLevel(v);
    const marker = document.createElement('span'); marker.className = `signal ${level}`;
    marker.textContent = level === 'ok' ? '✓' : level === 'warn' ? '!' : level === 'bad' ? '×' : 'i';
    const code = document.createElement('span'); code.textContent = validationText(v);
    const label = document.createElement('span'); label.className = `validation-pill ${level}`;
    label.textContent = level === 'ok' ? 'Validé' : level === 'warn' ? 'À vérifier' : level === 'bad' ? 'Échec' : 'Indéterminé';
    line.append(marker, code, label); vl.append(line);
  });
  else { const line = document.createElement('p'); line.textContent = 'Aucun résultat détaillé retourné.'; vl.append(line); }
  validationSection.append(vh, vl);

  const extras = document.createElement('details');
  extras.className = 'credential-section';
  extras.style.cssText = 'border:1px solid #354252;border-radius:10px;padding:12px;margin-top:16px';
  const summary = document.createElement('summary');
  summary.textContent = 'Informations complémentaires';
  summary.style.cssText = 'cursor:pointer;font-weight:700';
  extras.append(summary,
    section('Données du manifeste', [
      field('Identifiant du manifeste', manifest, 'neutral'),
      field('Actions déclarées', firstValue(a.actions, assertions.find(x => /actions/i.test(String(x?.label ?? '')))?.data?.actions), 'neutral'),
      field('Certificat / signataire déclaré', signer, signerLevel),
    ]), validationSection);

  lbSummary.replaceChildren(
    section('Vérification C2PA', [
      field('Intégrité du fichier', integrityStatus, integrityLevel),
      field('Signature numérique', signatureStatus, signatureLevel),
      field('Signataire déclaré', signer, signerLevel),
      field('Générateur', generator, present(generator)),
    ]),
    section('Informations sur la photo', [
      field('Auteur / photographe', author, 'neutral'),
      field('Horodatage certifié (TSA)', 'Non vérifié', 'neutral'),
      field('Date de prise de vue (EXIF)', photo.exifDate ?? 'Non disponible', 'neutral'),
    ]),
    extras
  );
  lbJson.textContent = JSON.stringify(photo.store, null, 2);

}

const sidePanel = document.querySelector('#side-panel');
let sidePhoto = null;
function refreshSidePanel(photo) {
  if (sidePanel.hidden || sidePhoto !== photo) return;
  // Le même moteur et les mêmes données que la fiche historique : aucune simulation.
  fillDetails(photo);
  const status = document.querySelector('#side-status');
  status.className = lbStatus.className;
  status.textContent = lbStatus.textContent;
  document.querySelector('#side-summary').replaceChildren(...[...lbSummary.childNodes].map(n => n.cloneNode(true)));
  document.querySelector('#side-json').textContent = lbJson.textContent;
  if (!bottomSheet.hidden && bottomPhoto === photo) refreshBottomSheet(photo);
}
function openSidePanel(photo) {
  sidePhoto = photo;
  sidePanel.hidden = false;
  refreshSidePanel(photo);
  // Si l'analyse est encore en cours, le panneau sera rafraîchi à sa fin.
}
document.querySelector('#side-close').addEventListener('click', () => { sidePanel.hidden = true; sidePhoto = null; sidePanel.classList.remove('direct-visible'); lightbox.classList.remove('direct-layout'); });

crBadge.addEventListener('click', () => {
  if (currentIdx < 0) return;
  if(presentationFor(photos[currentIdx])==='drawer') openBottomSheet(photos[currentIdx]); else if(presentationFor(photos[currentIdx])==='tap') toggleTapReveal(photos[currentIdx]);
  else openSidePanel(photos[currentIdx]);
});
document.querySelector('#cr-close').addEventListener('click', () => credentials.close());
credentials.addEventListener('click', e => { if (e.target === credentials) credentials.close(); });

/* ---------- Navigation ---------- */
function step(dir) {
  if (credentials.open) return; // navigation désactivée pendant la lecture des détails
  const visible = photos.map((p, i) => i)
    .filter(i => currentFilter === 'all' || photos[i].state === currentFilter);
  if (!visible.length) return;
  const pos = visible.indexOf(currentIdx);
  const next = visible[(pos + dir + visible.length) % visible.length];
  openLightbox(next);
}

document.querySelector('#lb-close').addEventListener('click', () => lightbox.close());
document.querySelector('#lb-prev').addEventListener('click', () => step(-1));
document.querySelector('#lb-next').addEventListener('click', () => step(1));
lightbox.addEventListener('close', () => { currentIdx = -1; if (credentials.open) credentials.close(); });
window.addEventListener('keydown', e => {
  if (!lightbox.open || credentials.open) return;
  if (e.key === 'ArrowLeft') step(-1);
  if (e.key === 'ArrowRight') step(1);
});

/* ---------- Filtres & recherche ---------- */
document.querySelectorAll('.chip').forEach(chip => chip.addEventListener('click', () => {
  document.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', String(c === chip)));
  currentFilter = chip.dataset.filter;
  photos.forEach(p => {
    const card = grid.querySelector(`[data-idx="${p.idx}"]`);
    if (card) applyFilterToCard(card, p);
  });
}));

search.addEventListener('input', () => {
  photos.forEach(p => {
    const card = grid.querySelector(`[data-idx="${p.idx}"]`);
    if (card) applyFilterToCard(card, p);
  });
});

/* ---------- Glisser-déposer ---------- */
let dragDepth = 0;
document.addEventListener('dragenter', e => { e.preventDefault(); dragDepth++; dropZone.hidden = false; });
document.addEventListener('dragleave', e => { e.preventDefault(); if (--dragDepth <= 0) { dragDepth = 0; dropZone.hidden = true; } });
document.addEventListener('dragover', e => e.preventDefault());
document.addEventListener('drop', async e => {
  e.preventDefault();
  dragDepth = 0;
  dropZone.hidden = true;
  const items = e.dataTransfer?.items;
  let ok = false;
  if (items?.length) {
    const files = await collectFromDataTransfer(items);
    ok = addFiles(files);
  }
  if (!ok && e.dataTransfer?.files?.length) ok = addFiles(e.dataTransfer.files);
  if (ok) emptyBox.hidden = true;
});

/* ---------- Démarrage : mode A (photos.json), sinon diagnostic + import manuel ---------- */
const emptyTitle = document.querySelector('#empty-title');
const emptyMsg = document.querySelector('#empty-msg');
const filePhotos = document.querySelector('#file-photos');
const fileFolder = document.querySelector('#file-folder');

function setEmpty(title, msg) {
  emptyTitle.textContent = title;
  emptyMsg.textContent = msg;
}

document.querySelector('#pick-photos').addEventListener('click', () => filePhotos.click());
document.querySelector('#pick-folder').addEventListener('click', () => fileFolder.click());
filePhotos.addEventListener('change', () => { if (addFiles(filePhotos.files)) emptyBox.hidden = true; filePhotos.value = ''; });
fileFolder.addEventListener('change', () => { if (addFiles(fileFolder.files)) emptyBox.hidden = true; fileFolder.value = ''; });

async function start() {
  const { state, urls } = await probeIndex();
  if (state !== 'ok') {
    // Repli : lecture directe du dossier PHOTOS/ du repo via l'API GitHub
    const apiUrls = await githubApiList();
    if (apiUrls.length) {
      emptyBox.hidden = true;
      [...new Set(apiUrls)].sort().forEach(url =>
        photos.push({ url, name: decodeURIComponent(url), idx: photos.length, state: 'loading' }));
      rebuildGrid();
      analyzeAll();
      return;
    }
  }
  if (state === 'missing') {
    setEmpty('Aucun index photo trouvé',
      'Le fichier photos.json est introuvable ou inaccessible. Si vous avez ouvert index.html en local '
      + '(double-clic), les photos listées par GitHub ne sont pas visibles : utilisez les boutons ci-dessous '
      + 'ou glissez vos photos sur la page. Sur GitHub Pages, vérifiez que photos.json est bien présent à la racine du site.');
    return;
  }
  if (state === 'empty') {
    setEmpty('L\'index photos.json est vide',
      'Aucune photo n\'est indexée. Sur GitHub Pages : vérifiez que vos photos sont bien dans PHOTOS/ à la racine '
      + 'du repo, et que gallery.yml se trouve dans .github/workflows/ à la racine (pas dans PHOTOS/ !) — c\'est ce '
      + 'workflow qui régénère l\'index à chaque push. En attendant, vous pouvez importer des photos ci-dessous.');
    return;
  }
  emptyBox.hidden = true;
  [...new Set(urls)].sort().forEach(url =>
    photos.push({ url, name: decodeURIComponent(url), idx: photos.length, state: 'loading' }));
  rebuildGrid();
  analyzeAll();
}
start();

/* Mode 9 : volet inférieur tactile et souris, données C2PA identiques au panneau. */
const bottomSheet=document.querySelector('#bottom-sheet');
const bottomHandle=document.querySelector('#bottom-sheet-handle');
let bottomPhoto=null;
function refreshBottomSheet(photo){
  if(bottomSheet.hidden || bottomPhoto!==photo) return;
  fillDetails(photo);
  const s=document.querySelector('#bottom-status');
  s.className=lbStatus.className; s.textContent=lbStatus.textContent;
  document.querySelector('#bottom-summary').replaceChildren(...[...lbSummary.childNodes].map(n=>n.cloneNode(true)));
  document.querySelector('#bottom-json').textContent=lbJson.textContent;
}
function openBottomSheet(photo){
  bottomPhoto=photo;bottomSheet.hidden=false;
  bottomSheet.classList.add('is-open');
  bottomSheet.style.removeProperty('--drag-y');
  refreshBottomSheet(photo);
}
function closeBottomSheet(){
  bottomSheet.classList.remove('is-open');
  bottomSheet.style.removeProperty('--drag-y');
  bottomSheet.hidden=true;bottomPhoto=null;
}
document.querySelector('#bottom-close').addEventListener('click',closeBottomSheet);
let dragStart=null;
bottomHandle.addEventListener('pointerdown',e=>{
  if(e.button!==0 && e.pointerType==='mouse') return;
  dragStart={y:e.clientY,id:e.pointerId};
  bottomHandle.setPointerCapture(e.pointerId);
});
bottomHandle.addEventListener('pointermove',e=>{
  if(!dragStart || e.pointerId!==dragStart.id) return;
  bottomSheet.style.setProperty('--drag-y',Math.max(0,e.clientY-dragStart.y)+'px');
});
bottomHandle.addEventListener('pointerup',e=>{
  if(!dragStart || e.pointerId!==dragStart.id) return;
  const distance=e.clientY-dragStart.y;dragStart=null;
  if(distance>85) closeBottomSheet();
  else bottomSheet.style.removeProperty('--drag-y');
});
bottomHandle.addEventListener('pointercancel',()=>{dragStart=null;bottomSheet.style.removeProperty('--drag-y');});


// Mode « révélation au tap » : tap ou glissement vers le haut sur la photo.
let tapStart=null;
lbPhoto.addEventListener('pointerdown',e=>{
  if(currentIdx<0||presentationFor(photos[currentIdx])!=='tap')return;
  tapStart={x:e.clientX,y:e.clientY};
});
lbPhoto.addEventListener('pointerup',e=>{
  if(!tapStart||currentIdx<0)return;
  const dy=e.clientY-tapStart.y,dx=e.clientX-tapStart.x;
  tapStart=null;
  if(presentationFor(photos[currentIdx])!=='tap')return;
  if(dy < -35 && Math.abs(dy)>Math.abs(dx)*1.2)toggleTapReveal(photos[currentIdx]);
  else if(Math.abs(dy)<12 && Math.abs(dx)<12)toggleTapReveal(photos[currentIdx]);
});




function syncLargeCaptionWidth() {
  const el=document.querySelector('#lb-caption-source');
  if(!el||el.hidden)return;
  const width=lbPhoto.getBoundingClientRect().width;
  if(width>0)el.style.removeProperty('--caption-width');
}
lbPhoto.addEventListener('load',syncLargeCaptionWidth);
window.addEventListener('resize',syncLargeCaptionWidth);
document.querySelector('#lb-caption-source').addEventListener('click',()=>{
  if(currentIdx>=0)openSidePanel(photos[currentIdx]);
});

/* Mode révélation : un bandeau SUR la photo, pas un volet sortant du bas. */
const tapReveal=document.querySelector('#tap-reveal');
function hideTapReveal(){tapReveal.hidden=true;}
function toggleTapReveal(photo){
  if(!tapReveal.hidden){hideTapReveal();return;}
  const summary=document.querySelector('#tap-reveal-summary');
  summary.textContent='Source : '+sourceLabel(photo)+' · '+(LABEL[photo.state]||'Provenance à examiner');
  tapReveal.hidden=false;
}
document.querySelector('#tap-reveal-close').addEventListener('click',e=>{e.stopPropagation();hideTapReveal();});
document.querySelector('#tap-reveal-more').addEventListener('click',e=>{e.stopPropagation();if(currentIdx>=0)openSidePanel(photos[currentIdx]);});


/* AFP bilingual interface — FR / EN. No changes to C2PA verification. */
const AFP_TRANSLATIONS = new Map(Object.entries({
  'Galerie & Content Credentials':'Gallery & Content Credentials',
  'Toutes':'All','Vérifiées':'Verified','À vérifier':'Needs review','Échecs':'Failures','Sans C2PA':'No C2PA',
  'Présentation :':'Display:','Aléatoire':'Random','Icône info':'Info icon','Onglet':'Tab','Panneau visible':'Visible panel','Bandeau':'Banner','Pastille de confiance':'Trust indicator','Coin de page transparent':'Transparent page corner','Bordure lumineuse':'Glowing border','Sceau de provenance':'Provenance seal','Volet à tirer depuis le bas':'Pull-up panel','Petit bouclier coché':'Small checked shield','Bouclier coloré après 2 secondes':'Colored shield after 2 seconds','Pastille retardée (1,5 s)':'Delayed indicator (1.5 s)','Révélation au tap / glissement':'Tap / swipe to reveal','Légende liée sous la photo':'Linked caption below photo','Redistribuer':'Reshuffle',
  'Glissez votre dossier PHOTOS/ (ou vos photos) sur cette page':'Drop your PHOTOS/ folder (or photos) onto this page',
  'Choisir des photos':'Choose photos','Choisir un dossier':'Choose a folder','Relâchez pour importer vos photos':'Release to import your photos',
  'Sur GitHub Pages, la galerie lit automatiquement le dossier':'On GitHub Pages, the gallery automatically reads the',
  'du repo':'folder in the repository','généré par le workflow, ou en repli via l’API GitHub':'generated by the workflow, or via the GitHub API as a fallback',
  'Fermer':'Close','Provenance numérique':'Digital provenance','Voir les informations complètes':'View full details',
  'Informations techniques du manifeste':'Technical manifest details',
  'Informations complémentaires':'Additional information',
  'Les Content Credentials décrivent une provenance déclarée et les contrôles effectués. Ils ne garantissent pas la véracité de la scène.':'Content Credentials describe declared provenance and performed checks. They do not guarantee that the scene is truthful.',
  'Vert : information présente ou contrôle réussi. Orange : confiance à vérifier. Rouge : échec de contrôle. Une information renseignée ne garantit pas qu\'elle soit vraie.':'Green: information present or check passed. Amber: trust needs review. Red: check failed. A populated field does not guarantee accuracy.',
  'Qu’est-ce que le C2PA ?':'What is C2PA?',
  'Le C2PA (Coalition for Content Provenance and Authenticity) est un standard ouvert permettant d’associer des Content Credentials à un fichier : origine déclarée, historique et modifications enregistrées.':'C2PA (Coalition for Content Provenance and Authenticity) is an open standard for attaching Content Credentials to a file: declared origin, history and recorded changes.',
  'Il contribue à la transparence sur la provenance.':'It improves transparency about provenance.',
  'Il peut signaler des modifications ou des étapes impliquant l’IA si elles ont été enregistrées.':'It may disclose edits or AI-related steps if they were recorded.',
  'Il ne prouve pas la véracité de la scène ni la fiabilité de la source.':'It does not prove that a scene is real or that a source is trustworthy.',
  'Un certificat non reconnu comme fiable ne signifie pas automatiquement que l’image a été falsifiée.':'An untrusted certificate does not automatically mean the image was manipulated.',
  'Vérification C2PA':'C2PA verification','Informations sur la photo':'Photo information',
  'Intégrité du fichier':'File integrity','Signature numérique':'Digital signature','Signataire déclaré':'Declared signer',
  'Générateur':'Generator','Auteur / photographe':'Author / photographer','Horodatage certifié (TSA)':'Certified timestamp (TSA)',
  'Date de prise de vue (EXIF)':'Capture date (EXIF)',
  'Données du manifeste':'Manifest data','Identifiant du manifeste':'Manifest ID','Actions déclarées':'Declared actions',
  'Certificat / signataire déclaré':'Certificate / declared signer','Résultats techniques de validation':'Technical validation results',
  'Vérifie que le fichier correspond aux données protégées par le manifeste C2PA.':'Checks that the file matches the data protected by the C2PA manifest.',
  'Vérifie que les informations de provenance n’ont pas été modifiées après leur signature.':'Checks that provenance information has not been altered since signing.',
  'Organisme ou entreprise identifié dans le certificat ayant signé la provenance.':'Organization or company identified in the certificate that signed the provenance.',
  'Appareil ou logiciel ayant créé les informations C2PA.':'Device or software that generated the C2PA information.',
  'Personne déclarée comme auteur de la photo ; cette identité n’est pas forcément vérifiée.':'Person identified as the photo author; their identity may not have been verified.',
  'Date attestée par un tiers indépendant : la signature existait au plus tard à cet instant.':'Time attested by an independent authority: the signature existed no later than this time.',
  'Date enregistrée par l’horloge de l’appareil, modifiable et non certifiée à elle seule.':'Date recorded by the camera clock; editable and not independently certified.',
  'Non renseigné':'Not provided','Non disponible':'Unavailable','Non vérifié':'Not verified',
  'Non confirmé séparément':'Not independently confirmed','Confiance à vérifier':'Trust needs review',
  'Échec':'Failed','Validé':'Validated','Indéterminé':'Undetermined',
  'Information présente':'Information available','Problème détecté':'Problem detected','Information indisponible':'Information unavailable',
  'Aucun résultat détaillé retourné.':'No detailed results returned.',
  'Vérification C2PA en cours…':'C2PA verification in progress…','Analyse en cours…':'Analyzing…','Chargement…':'Loading…',
  'Chargement des informations…':'Loading information…','Aucun manifeste C2PA intégré détecté.':'No embedded C2PA manifest detected.',
  'Aucun manifeste trouvé.':'No manifest found.',
  'Manifeste présent, mais une ou plusieurs vérifications ont échoué.':'Manifest found, but one or more checks failed.',
  'Manifeste présent, mais la confiance du signataire nécessite une vérification.':'Manifest found, but signer trust needs further verification.',
  'Manifeste présent, mais la validation complète ne peut pas être confirmée.':'Manifest found, but full validation cannot be confirmed.',
  'Contrôles C2PA retournés sans problème signalé. Cela ne prouve pas la véracité de la scène.':'C2PA checks reported no issues. This does not prove the scene is truthful.',
  'Les indicateurs verts signalent des informations présentes ou des contrôles réussis ; orange signifie « à vérifier » ; rouge indique un échec de contrôle. Une information renseignée ne prouve pas à elle seule qu’elle est vraie.':'Green indicators mean information is present or a check passed; amber means further review is needed; red indicates a failed check. A populated field alone does not prove accuracy.',
  'Le C2PA (Coalition for Content Provenance and Authenticity) est un standard ouvert qui permet d’associer à un fichier des':'C2PA (Coalition for Content Provenance and Authenticity) is an open standard for attaching',
  ': des informations sur sa provenance et, lorsqu’elles sont renseignées, sur les étapes de sa création ou de ses modifications.':': information about a file’s provenance and, when recorded, the steps of its creation or editing.',
  'Il aide à retracer l’origine déclarée et l’historique d’un contenu.':'It helps trace the declared origin and history of content.',
  'Il peut signaler certaines modifications ou utilisations d’outils d’IA, si elles ont été enregistrées.':'It may disclose certain edits or AI-tool use if these were recorded.',
  'Il ne garantit pas qu’une scène est vraie, ni qu’une source est digne de confiance.':'It does not guarantee that a scene is real or that a source is trustworthy.',
  'À retenir :':'Key point:',
  '« certificat non fiable » ne signifie pas automatiquement « image falsifiée ». Cela signifie que la confiance cryptographique n’a pas pu être établie par le système de vérification utilisé.':'“Untrusted certificate” does not automatically mean “manipulated image.” It means cryptographic trust could not be established by the verification system used.',
  'Rechercher un fichier…':'Search files…','Rechercher':'Search','Filtres':'Filters',
  'Choisir la présentation C2PA':'Choose C2PA display','Fermer le panneau':'Close panel','Fermer le volet':'Close panel',
  'Masquer les informations':'Hide information','Afficher les Content Credentials':'Show Content Credentials',
  'Photo précédente':'Previous photo','Photo suivante':'Next photo','Source :':'Source:',
  'Impossible de lire le manifeste :':'Unable to read manifest:',
  'Que signifie «':'What does “','» ?':'” mean?','Explication :':'Explanation:',
  'photographies':'photos','photographie':'photo','photos chargées':'photos loaded',
  'Aucun fichier':'No file','Aucune photo':'No photo','Aucun résultat':'No results'
}));
const AFP_TEXT_ORIGINAL = new WeakMap();
const AFP_ATTR_ORIGINAL = new WeakMap();
let afpLanguage = 'fr';
const afpLangBtn = document.createElement('button');
afpLangBtn.id = 'afp-language-toggle';
afpLangBtn.type = 'button';
afpLangBtn.className = 'chip';
afpLangBtn.setAttribute('aria-label', 'Switch language to English');
afpLangBtn.textContent = 'EN';
afpLangBtn.title = 'English';
const afpHeader = document.querySelector('header');
if (afpHeader) afpHeader.append(afpLangBtn);
const afpLangCss = document.createElement('style');
afpLangCss.textContent = `#afp-language-toggle{flex-shrink:0;min-width:42px;font-weight:700;white-space:nowrap;order:100}#afp-language-toggle:focus-visible{outline:2px solid #79baff;outline-offset:3px}`;
document.head.append(afpLangCss);
function afpTranslate(s) {
  if (AFP_TRANSLATIONS.has(s)) return AFP_TRANSLATIONS.get(s);
  // Preserve symbols and spacing surrounding labels.
  const trimmed = s.trim();
  if (AFP_TRANSLATIONS.has(trimmed)) return s.replace(trimmed, AFP_TRANSLATIONS.get(trimmed));
  let out = s;
  // Translate longer status sentences and short UI fragments without touching filenames/technical codes.
  for (const [fr,en] of AFP_TRANSLATIONS) {
    if (fr.length > 8 && out.includes(fr)) out = out.split(fr).join(en);
  }
  return out;
}
function afpLocalizeNode(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    if (node.parentElement?.closest('pre,code,script,style')) return;
    let original = AFP_TEXT_ORIGINAL.get(node);
    if (original === undefined) { original = node.nodeValue; AFP_TEXT_ORIGINAL.set(node,original); }
    const wanted = afpLanguage === 'en' ? afpTranslate(original) : original;
    if (node.nodeValue !== wanted) node.nodeValue = wanted;
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return;
  if (node.matches('script,style,pre,code')) return;
  for (const attr of ['title','aria-label','placeholder']) {
    if (!node.hasAttribute(attr) || node === afpLangBtn) continue;
    let record = AFP_ATTR_ORIGINAL.get(node);
    if (!record) { record = {}; AFP_ATTR_ORIGINAL.set(node,record); }
    if (!(attr in record)) record[attr] = node.getAttribute(attr);
    const wanted = afpLanguage === 'en' ? afpTranslate(record[attr]) : record[attr];
    if (node.getAttribute(attr) !== wanted) node.setAttribute(attr,wanted);
  }
  for (const child of node.childNodes) afpLocalizeNode(child);
}
let afpTranslationBusy = false;
function afpApplyLanguage() {
  if (afpTranslationBusy) return;
  afpTranslationBusy = true;
  afpLocalizeNode(document.body);
  document.documentElement.lang = afpLanguage;
  afpLangBtn.textContent = afpLanguage === 'en' ? 'FR' : 'EN';
  afpLangBtn.title = afpLanguage === 'en' ? 'Français' : 'English';
  afpLangBtn.setAttribute('aria-label', afpLanguage === 'en' ? 'Passer en français' : 'Switch language to English');
  afpTranslationBusy = false;
}
afpLangBtn.addEventListener('click', () => {
  afpLanguage = afpLanguage === 'fr' ? 'en' : 'fr';
  afpApplyLanguage();
});
const afpTranslationObserver = new MutationObserver(mutations => {
  if (afpTranslationBusy) return;
  // Application updates may replace text on existing nodes; track their new French source.
  for (const m of mutations) {
    if (m.type === 'characterData') {
      const n = m.target;
      const original = AFP_TEXT_ORIGINAL.get(n);
      if (original !== undefined && n.nodeValue !== original && n.nodeValue !== afpTranslate(original)) AFP_TEXT_ORIGINAL.set(n,n.nodeValue);
    }
    if (m.type === 'attributes' && m.attributeName && m.target !== afpLangBtn) {
      const record = AFP_ATTR_ORIGINAL.get(m.target);
      if (record && m.attributeName in record) {
        const current = m.target.getAttribute(m.attributeName);
        if (current !== record[m.attributeName] && current !== afpTranslate(record[m.attributeName])) record[m.attributeName] = current;
      }
    }
  }
  afpApplyLanguage();
});
afpTranslationObserver.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['title','aria-label','placeholder']});
afpApplyLanguage();
