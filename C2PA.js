
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

function setStatus(message, css = '') {
  status.textContent = message;
  status.className = `status ${css}`;
}

function textLine(label, value) {
  const p = document.createElement('p');
  const b = document.createElement('strong');
  b.textContent = label + ' : ';
  p.append(b, document.createTextNode(String(value ?? 'Non renseigné')));
  summary.append(p);
}

async function start() {
  let c2pa, reader;
  try {
    const response = await fetch(PHOTO_URL, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Photo introuvable : HTTP ${response.status}`);
    const blob = await response.blob();

    c2pa = await createC2pa({ wasmSrc: WASM_URL });
    reader = await Reader.fromBlob(c2pa, 'image/jpeg', blob);

    if (!reader) {
      setStatus('Aucun manifeste C2PA détecté.', 'warn');
      output.textContent = 'Aucun manifeste trouvé.';
      return;
    }

    const store = await reader.manifestStore();
    const active = await reader.activeManifest();
    output.textContent = JSON.stringify(store, null, 2);

    const results = store?.validation_results?.activeManifest ?? {};
    const successes = results.success ?? [];
    const failures = results.failure ?? [];
    const informational = results.informational ?? [];
    const codes = items => items.map(x => x.code);

    const successCodes = codes(successes);
    const failureCodes = codes(failures);

    const signatureValid = successCodes.includes('claimSignature.validated');
    const dataValid = successCodes.includes('assertion.dataHash.match');
    const untrusted = failureCodes.includes('signingCredential.untrusted');

    const otherFailures = failures.filter(
      x => x.code !== 'signingCredential.untrusted'
    );

    badge.hidden = false;
    summary.replaceChildren();

    const signature = active?.signature_info ??
      store?.manifests?.[store?.active_manifest]?.signature_info ?? {};

    textLine('Photographie', active?.title);
    textLine('Appareil / Générateur', active?.claim_generator);
    textLine('Signataire', signature.issuer);
    textLine('Photographe',
      active?.assertions?.find(x =>
        x.label === 'stds.schema-org.CreativeWork'
      )?.data?.author?.[0]?.name
    );

    textLine('Signature cryptographique',
      signatureValid ? 'Valide' : 'Non confirmée');

    textLine('Intégrité du JPEG',
      dataValid ? 'Vérifiée' : 'Non confirmée');

    textLine('Confiance du certificat',
      untrusted ? 'Non établie' :
      failures.length ? 'Vérification avec anomalies' :
      'Aucune anomalie de confiance signalée');

    textLine('État de validation',
      store?.validation_state ?? 'Non renseigné');

    if (otherFailures.length) {
      setStatus(
        'C2PA : anomalies de validation détectées. Voir les détails.',
        'error'
      );
    } else if (signatureValid && dataValid && untrusted) {
      setStatus(
        'C2PA : signature et intégrité valides. Certificat du signataire non reconnu comme fiable.',
        'warn'
      );
    } else if (signatureValid && dataValid && !failures.length) {
      setStatus(
        'C2PA : signature et intégrité vérifiées. Aucune anomalie signalée.',
        'ok'
      );
    } else {
      setStatus(
        'C2PA : vérification incomplète. Consulter les détails.',
        'warn'
      );
    }

    if (failures.length) {
      textLine('Anomalies',
        failures.map(x => `${x.code} : ${x.explanation ?? ''}`).join(' | ')
      );
    }

    if (informational.length) {
      textLine('Informations complémentaires',
        informational.map(x => x.code).join(', ')
      );
    }

  } catch (error) {
    console.error('C2PA', error);
    setStatus(`Erreur de lecture C2PA : ${error.message}`, 'error');
    output.textContent = String(error.stack ?? error);
  } finally {
    if (reader) {
      try { await reader.free(); } catch (e) { console.warn(e); }
    }
    if (c2pa) {
      try { c2pa.dispose(); } catch (e) { console.warn(e); }
    }
  }
}

start();
