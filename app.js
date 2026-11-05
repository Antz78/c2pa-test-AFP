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
  const imgs = [...files].filter(f => IMAGE_RE.test(f.name));
  if (!imgs.length) return false;
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

/* ---------- Lightbox plein écran ---------- */
function setStatusLine(cls, text) {
  lbStatus.className = `status-line ${cls}`;
  lbStatus.replaceChildren(
    Object.assign(document.createElement('span'), { className: 'dot' }),
    Object.assign(document.createElement('span'), { textContent: text }),
  );
}

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
  crBadge.className = `cr ${photo.state}`;
  setStatusLine('loading', 'Analyse en cours…');
  lbSummary.replaceChildren();
  lbJson.textContent = 'Chargement…';
  // Si le panneau était ouvert sur la photo précédente, on le ferme.
  if (credentials.open) credentials.close();
  analyze(photo).then(() => {
    if (currentIdx >= 0 && photos[currentIdx] === photo) {
      crBadge.className = `cr ${photo.state}`;
      if (credentials.open) fillDetails(photo); // rafraîchir le panneau déjà ouvert
      renderCard(photo);
      updateCount();
    }
  });
  lightbox.showModal();
}

/* ---------- Panneau Content Credentials (bouton logo AFP) ---------- */
function fillDetails(photo) {
  if (photo.state === 'loading') {
    setStatusLine('loading', 'Analyse en cours…');
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
  const failures = entries.filter(i => /failure|mismatch|untrusted/.test(String(i?.code ?? '')));
  if (failures.length) {
    setStatusLine('warn', 'Manifeste présent, mais des problèmes de validation sont signalés.');
  } else {
    setStatusLine('ok', 'Manifeste C2PA trouvé. Vérifiez la confiance du signataire dans les détails.');
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

crBadge.addEventListener('click', () => {
  if (currentIdx < 0) return;
  fillDetails(photos[currentIdx]);
  credentials.showModal();
});
document.querySelector('#cr-close').addEventListener('click', () => credentials.close());
credentials.addEventListener('click', e => { if (e.target === credentials) credentials.close(); });

/* ---------- Navigation ---------- */
function step(dir) {
  if (credentials.open) return; // navigation désactivée pendant la lecture des détails
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
