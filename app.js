console.info('[C2PA AFP] Version filtres v3 chargée — badges À vérifier');
// Galerie C2PA — 100 % statique, fonctionne sur GitHub Pages.
// Deux modes :
//  A) ./photos.json existe (généré par GitHub Action à chaque push) → galerie automatique.
//  B) Sinon, glissez le dossier PHOTOS/ (ou des photos) directement sur la page.
// Version SDK fixée pour éviter les changements silencieux du CDN.
import { createC2pa, Reader } from 'https://cdn.jsdelivr.net/npm/@contentauth/c2pa-web@0.15.4/+esm';

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

const PRESENTATIONS = ['info','afp','direct','banner','status','corner'];
const modeSelect = document.querySelector('#presentation-mode');
let selectedMode = 'random';
function presentationFor(photo) {
  if (!photo.demoStyle || !PRESENTATIONS.includes(photo.demoStyle))
    photo.demoStyle = PRESENTATIONS[Math.floor(Math.random()*PRESENTATIONS.length)];
  return selectedMode === 'random' ? photo.demoStyle : selectedMode;
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
  } else if (mode === 'corner') {
    const el=document.createElement('span'); el.className='page-corner';
    el.setAttribute('aria-hidden','true'); target.append(el);
  }
  // En mode pastille, le point coloré est l'unique élément.
  if (mode !== 'corner') {
    const dot=document.createElement('span'); dot.className='dot '+state;
    dot.setAttribute('aria-hidden','true'); target.append(dot);
  }
  target.setAttribute('aria-label', mode === 'corner' ? 'Soulever le coin pour voir la provenance C2PA' : 'Voir la provenance C2PA');
}
function redrawPresentations() {
  photos.forEach(photo => {
    const card=grid.querySelector(`[data-idx="${photo.idx}"]`);
    const overlay=card?.querySelector('.demo-overlay');
    if(overlay){overlay.className='demo-overlay';addBadgeContent(overlay,presentationFor(photo),photo.state);}
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
  overlay.addEventListener('click',event=>{event.stopPropagation();openLightbox(photo.idx);openSidePanel(photo);});
  card.append(img, tag, name, overlay);
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
function field(label, value, level = 'ok', help = '') {
  const row = document.createElement('div'); row.className = 'credential-row';
  const marker = document.createElement('span'); marker.className = `signal ${level}`;
  marker.textContent = level === 'ok' ? '✓' : level === 'warn' ? '!' : level === 'bad' ? '×' : 'i';
  marker.setAttribute('aria-label', level === 'ok' ? 'Information présente' : level === 'warn' ? 'À vérifier' : level === 'bad' ? 'Problème détecté' : 'Information indisponible');
  const name = document.createElement('div'); name.className = 'field-label'; name.textContent = label;
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
  crBadge.className=`cr ${photo.state}`;
  addBadgeContent(crBadge,mode,photo.state);
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
  analyze(photo).then(() => {
    if (currentIdx >= 0 && photos[currentIdx] === photo) {
      crBadge.className = `cr ${photo.state}`;
      addBadgeContent(crBadge,presentationFor(photo),photo.state);
      if (!sidePanel.hidden) refreshSidePanel(photo);
      if (credentials.open) fillDetails(photo); // rafraîchir le panneau déjà ouvert
      renderCard(photo);
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
  const date = firstValue(a.created_at, a.createdAt, sig.time, sig.timestamp);
  const manifest = firstValue(photo.store?.active_manifest, photo.store?.activeManifest);
  const signerLevel = levels.includes('bad') ? 'bad' : levels.includes('warn') || !entries.length ? 'warn' : present(signer);
  const validationSection = document.createElement('section'); validationSection.className = 'credential-section';
  const vh = document.createElement('h3'); vh.textContent = 'Vérification et confiance';
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
  else { const line = document.createElement('p'); line.textContent = 'Aucun résultat de validation détaillé retourné. La confiance du signataire n’est pas établie par cette absence.'; vl.append(line); }
  validationSection.append(vh, vl);
  lbSummary.replaceChildren(
    section('Informations sur le contenu', [
      field('Titre', a.title, present(a.title)),
      field('Générateur', generator, present(generator)),
      field('Date de création', date, present(date)),
    ]),
    section('Signature et provenance', [
      field('Signataire déclaré', signer, signerLevel, signerLevel === 'warn' ? 'Le certificat du signataire n’est pas reconnu comme fiable.' : signerLevel === 'bad' ? 'Un problème de validation est signalé.' : ''),
      field('Manifeste actif', manifest, present(manifest)),
    ]),
    validationSection
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
  openSidePanel(photos[currentIdx]);
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
