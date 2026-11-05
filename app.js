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
const lbPhoto = document.querySelector('#lb-photo');
const lbTitle = document.querySelector('#lb-title');
const lbStatus = document.querySelector('#lb-status');
const lbSummary = document.querySelector('#lb-summary');
const lbJson = document.querySelector('#lb-json');
const dropZone = document.querySelector('#dropzone');

const photos = [];            // { url, name, blob?, state, store?, active?, validation?, error? }
let currentFilter = 'all';
let currentIdx = -1;
let c2pa = null;

/* ---------- Mode A : index photos.json (généré par CI) ---------- */
async function loadJsonIndex() {
  try {
    const r = await fetch('./photos.json', { cache: 'no-store' });
    if (!r.ok) return [];
    const data = await r.json();
    const list = Array.isArray(data) ? data : data.photos;
    return (list ?? []).map(p => p.url ?? p).filter(u => IMAGE_RE.test(u));
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
  const imgs = [...files].filter(f => IMAGE_RE.test(f.name));
  if (!imgs.length) return false;
  imgs.forEach((f, i) => {
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
  if (!c2pa) c2pa = await createC2pa({ wasmSrc: WASM_URL });
  return c2pa;
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
    const failures = list.filter(i => i && typeof i === 'object' &&
      /failure|mismatch|untrusted/.test(String(i.code ?? '')));
    photo.state = failures.length ? 'warn' : (store ? 'ok' : 'none');
    try { await reader.free(); } catch (_) {}
  } catch (e) {
    console.warn('C2PA', photo.name, e);
    photo.error = e.message ?? String(e);
    photo.state = 'error';
  }
}

/* Analyse parallèle limitée */
async function analyzeAll(limit = 3) {
  const queue = () => photos.filter(p => p.state === 'loading');
  const workers = Array.from({ length: limit }, async () => {
    while (queue().length) {
      const p = queue().shift();
      await analyze(p);
      renderCard(p);
      updateCount();
    }
  });
  await Promise.all(workers);
}

/* ---------- Rendu ---------- */
const LABEL = { loading: 'Analyse…', ok: 'Signée', warn: 'Validée ⚠', none: 'Sans CR', error: 'Erreur' };

function cardEl(photo) {
  const card = document.createElement('figure');
  card.className = 'card';
  card.dataset.idx = String(photo.idx);
  const img = document.createElement('img');
  img.loading = 'lazy';
  img.src = photo.url;
  img.alt = photo.name.split('/').pop();
  const tag = document.createElement('span');
  tag.className = 'tag loading';
  tag.append(Object.assign(document.createElement('span'), { className: 'dot' }),
             document.createTextNode(LABEL.loading));
  const name = document.createElement('figcaption');
  name.className = 'name';
  name.textContent = photo.name.split('/').pop();
  card.append(img, tag, name);
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
  applyFilterToCard(card, photo);
}

function applyFilterToCard(card, photo) {
  const visible = currentFilter === 'all' ||
    (currentFilter === 'none' && ['none', 'error'].includes(photo.state)) ||
    photo.state === currentFilter;
  card.style.display = visible ? '' : 'none';
}

function updateCount() {
  const n = (s) => photos.filter(p => p.state === s).length;
  countEl.textContent = `${photos.length} photo(s) · ${n('ok')} signée(s) · ${n('warn')} à vérifier · ${n('none') + n('error')} sans manifeste`;
}

function rebuildGrid() {
  grid.replaceChildren(...photos.map(cardEl));
  photos.forEach(p => {
    const card = grid.querySelector(`[data-idx="${p.idx}"]`);
    if (card) applyFilterToCard(card, p);
  });
  updateCount();
}

/* ---------- Lightbox ---------- */
function field(label, value) {
  const div = document.createElement('div');
  div.className = 'field';
  div.append(Object.assign(document.createElement('strong'), { textContent: label }),
             Object.assign(document.createElement('span'), { textContent: String(value ?? 'Non renseigné') }));
  return div;
}

function openLightbox(idx) {
  currentIdx = idx;
  const photo = photos[idx];
  lbTitle.textContent = photo.name.split('/').pop();
  lbPhoto.src = photo.url;
  lbPhoto.alt = photo.name.split('/').pop();
  lbStatus.className = 'status-line none';
  lbStatus.textContent = 'Analyse…';
  lbSummary.replaceChildren();
  lbJson.textContent = 'Chargement…';
  analyze(photo).then(() => fillDetails(photo)).then(() => { renderCard(photo); updateCount(); });
  lightbox.showModal();
}

function fillDetails(photo) {
  if (currentIdx < 0 || photos[currentIdx] !== photo) return;
  if (photo.state === 'error') {
    lbStatus.className = 'status-line error';
    lbStatus.textContent = `Impossible de lire le manifeste : ${photo.error}`;
    lbJson.textContent = photo.error;
    return;
  }
  if (photo.state === 'none') {
    lbStatus.className = 'status-line none';
    lbStatus.textContent = 'Aucun manifeste C2PA intégré détecté.';
    lbSummary.replaceChildren();
    lbJson.textContent = 'Aucun manifeste trouvé.';
    return;
  }
  const entries = photo.validation ?? [];
  const failures = entries.filter(i => /failure|mismatch|untrusted/.test(String(i?.code ?? '')));
  if (failures.length) {
    lbStatus.className = 'status-line warn';
    lbStatus.textContent = 'Manifeste présent, mais des problèmes de validation sont signalés.';
  } else {
    lbStatus.className = 'status-line ok';
    lbStatus.textContent = 'Manifeste C2PA trouvé. Vérifiez la confiance du signataire dans les détails.';
  }
  const a = photo.active ?? {};
  lbSummary.replaceChildren(
    field('Titre', a.title),
    field('Générateur', a.claim_generator ?? a.claimGenerator),
    field('Signataire', a.signature_info?.[0]?.name ?? a.signatureInfo?.[0]?.name),
    field('Date de création', a.created_at ?? a.createdAt),
    field('Manifeste actif', photo.store?.active_manifest ?? photo.store?.activeManifest),
    field('Résultats de validation', entries.length ? entries.map(e => e.code).join(', ') : 'Aucun message retourné'),
  );
  lbJson.textContent = JSON.stringify(photo.store, null, 2);
}

function step(dir) {
  const visible = photos.map((p, i) => i)
    .filter(i => currentFilter === 'all' || photos[i].state === currentFilter ||
      (currentFilter === 'none' && ['none', 'error'].includes(photos[i].state)));
  if (!visible.length) return;
  const next = visible[(visible.indexOf(currentIdx) + dir + visible.length) % visible.length];
  openLightbox(next);
}

document.querySelector('#lb-close').addEventListener('click', () => lightbox.close());
document.querySelector('#lb-prev').addEventListener('click', () => step(-1));
document.querySelector('#lb-next').addEventListener('click', () => step(1));
lightbox.addEventListener('click', e => { if (e.target === lightbox) lightbox.close(); });
lightbox.addEventListener('close', () => { currentIdx = -1; });
window.addEventListener('keydown', e => {
  if (!lightbox.open) return;
  if (e.key === 'ArrowLeft') step(-1);
  if (e.key === 'ArrowRight') step(1);
});

/* ---------- Filtres & recherche ---------- */
document.querySelectorAll('.chip').forEach(chip => chip.addEventListener('click', () => {
  document.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', String(c === chip)));
  currentFilter = chip.dataset.filter;
  rebuildGrid();
}));

search.addEventListener('input', () => {
  const q = search.value.trim().toLowerCase();
  photos.forEach(p => {
    const card = grid.querySelector(`[data-idx="${p.idx}"]`);
    if (!card) return;
    const visible = p.name.toLowerCase().includes(q) &&
      (currentFilter === 'all' || p.state === currentFilter ||
        (currentFilter === 'none' && ['none', 'error'].includes(p.state)));
    card.style.display = visible ? '' : 'none';
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

/* ---------- Démarrage : mode A, sinon message d'accueil ---------- */
async function start() {
  const urls = [...new Set(await loadJsonIndex())].sort();
  if (!urls.length) return; // on garde l'écran d'accueil (glisser-déposer)
  emptyBox.hidden = true;
  urls.forEach(url => photos.push({ url, name: decodeURIComponent(url), idx: photos.length, state: 'loading' }));
  rebuildGrid();
  analyzeAll();
}
start();
