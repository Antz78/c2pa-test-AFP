// Version SDK fixée pour éviter les changements silencieux du CDN.
// Dépendance chargée en module ESM; le moteur de vérification utilise WebAssembly.
import { createC2pa, Reader } from 'https://cdn.jsdelivr.net/npm/@contentauth/c2pa-web@0.15.4/+esm';

const PHOTO_URL = './D36K4MF-org.jpg';
const WASM_URL = 'https://cdn.jsdelivr.net/npm/@contentauth/c2pa-web@0.15.4/dist/resources/c2pa_bg.wasm';
const status = document.querySelector('#status');
const output = document.querySelector('#manifest');
const badge = document.querySelector('#cr');
const dialog = document.querySelector('#credentials');
const summary = document.querySelector('#summary');

document.querySelector('#close').addEventListener('click', () => dialog.close());
badge.addEventListener('click', () => dialog.showModal());

function setStatus(message, cssClass = '') {
  status.textContent = message;
  status.className = `status ${cssClass}`;
}
function textLine(parent, label, value) {
  const p = document.createElement('p');
  const b = document.createElement('strong');
  b.textContent = `${label} : `;
  p.append(b, document.createTextNode(String(value ?? 'Non renseigné')));
  parent.append(p);
}

async function start() {
  let c2pa, reader;
  try {
    const response = await fetch(PHOTO_URL, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Photo introuvable (HTTP ${response.status}). Vérifier son nom et sa casse.`);
    const blob = await response.blob();
    c2pa = await createC2pa({ wasmSrc: WASM_URL });
    reader = await Reader.fromBlob(c2pa, 'image/jpeg', blob);
    if (!reader) {
      setStatus('Aucun manifeste C2PA intégré détecté.', 'warn');
      output.textContent = 'Aucun manifeste trouvé.';
      return;
    }
    const store = await reader.manifestStore();
    const active = await reader.activeManifest();
    output.textContent = JSON.stringify(store, null, 2);
    const validation = store?.validation_status ?? store?.validationStatus ?? [];
    const entries = Array.isArray(validation) ? validation : [];
    const failures = entries.filter(item => item && typeof item === 'object' &&
      (String(item.code ?? '').includes('failure') || String(item.code ?? '').includes('mismatch') || String(item.code ?? '').includes('untrusted')));
    // Ne jamais confondre absence d'erreur dans un JSON avec preuve de confiance.
    // Le badge donne accès aux données, mais ne prétend pas que le signataire est fiable.
    badge.hidden = false;
    summary.replaceChildren();
    textLine(summary, 'Titre', active?.title);
    textLine(summary, 'Générateur', active?.claim_generator ?? active?.claimGenerator);
    textLine(summary, 'Manifeste actif', store?.active_manifest ?? store?.activeManifest);
    textLine(summary, 'Résultats de validation', entries.length ? `${entries.length} message(s)` : 'Aucun message de validation retourné');
    if (failures.length) {
      setStatus('Manifeste présent, mais des problèmes de validation sont signalés. Consulter les détails.', 'warn');
    } else {
      setStatus('Manifeste C2PA trouvé. Vérifier les détails de validation et de confiance du signataire.', 'ok');
    }
  } catch (error) {
    console.error('C2PA', error);
    setStatus(`Impossible de terminer la lecture C2PA : ${error.message}`, 'error');
    output.textContent = String(error.stack ?? error);
  } finally {
    if (reader) { try { await reader.free(); } catch (e) { console.warn(e); } }
    if (c2pa) { try { c2pa.dispose(); } catch (e) { console.warn(e); } }
  }
}
start();
