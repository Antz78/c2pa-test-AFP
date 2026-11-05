
import {
  createC2pa,
  Reader
} from 'https://cdn.jsdelivr.net/npm/@contentauth/c2pa-web@0.15.4/+esm';

const PHOTO = './D36K4MF-org.jpg';

const WASM =
  'https://cdn.jsdelivr.net/npm/@contentauth/c2pa-web@0.15.4/dist/resources/c2pa_bg.wasm';

const $ = s => document.querySelector(s);

const badge = $('#cr');
const dialog = $('#credentials');
const info = $('#information');
const status = $('#status');
const explanation = $('#explanation');
const output = $('#manifest');
const intro = $('#intro');

$('#close').onclick = () => dialog.close();
badge.onclick = () => dialog.showModal();

dialog.onclick = e => {
  if (e.target === dialog) dialog.close();
};

function row(icon, title, description, value = '', kind = '') {
  const d = document.createElement('div');
  d.className = 'info-row';

  const i = document.createElement('div');
  i.className = 'ico ' + kind;
  i.textContent = icon;

  const t = document.createElement('div');
  t.className = 'info-text';

  const b = document.createElement('strong');
  b.textContent = title;

  const s = document.createElement('small');
  s.textContent = description;

  t.append(b, s);
  d.append(i, t);

  if (value) {
    const v = document.createElement('div');
    v.className = 'value';

    if (['green', 'orange', 'red'].includes(kind)) {
      v.className += ' pill ' + (kind === 'green' ? '' : kind);
    }

    v.textContent = value;
    d.append(v);
  }

  info.append(d);
}

function dateFR(value) {
  if (!value) return 'Non renseignée';

  const match = String(value).match(
    /^(\d{4})-(\d{2})-(\d{2})/
  );

  if (!match) return value;

  const d = new Date(Date.UTC(
    +match[1],
    +match[2] - 1,
    +match[3]
  ));

  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(d);
}

function codes(items) {
  return new Set(
    (items || []).map(item => item.code)
  );
}

async function init() {
  let c2pa;
  let reader;

  try {
    const response = await fetch(PHOTO, {
      cache: 'no-store'
    });

    if (!response.ok) {
      throw Error(
        'Photographie introuvable : HTTP ' + response.status
      );
    }

    const blob = await response.blob();

    c2pa = await createC2pa({
      wasmSrc: WASM
    });

    reader = await Reader.fromBlob(
      c2pa,
      'image/jpeg',
      blob
    );

    if (!reader) {
      throw Error(
        'Aucun manifeste C2PA détecté dans cette photographie.'
      );
    }

    const store = await reader.manifestStore();
    const active = await reader.activeManifest();

    const id =
      store?.active_manifest ??
      store?.activeManifest;

    const m =
      store?.manifests?.[id] ??
      active ??
      {};

    const assertions = m.assertions ?? [];

    const exif =
      assertions.find(
        a => a.label === 'stds.exif'
      )?.data ?? {};

    const creative =
      assertions.find(
        a => a.label === 'stds.schema-org.CreativeWork'
      )?.data ?? {};

    const results =
      store?.validation_results?.activeManifest ?? {};

    const success = codes(results.success);
    const failures = codes([
      ...(results.failure ?? []),
      ...(store.validation_status ?? [])
    ]);

    const signed =
      success.has('claimSignature.validated');

    const intact =
      success.has('assertion.dataHash.match');

    const untrusted =
      failures.has('signingCredential.untrusted');

    const otherFailures = [...failures].filter(
      code => code !== 'signingCredential.untrusted'
    );

    const author =
      creative.author?.[0]?.name ??
      exif['dc:creator'];

    const camera = exif['tiff:Model'];
    const maker = exif['tiff:Make'];
    const taken = exif['exif:DateTimeOriginal'];
    const issuer = m.signature_info?.issuer;

    const verified =
      signed &&
      intact &&
      otherFailures.length === 0;

    const cameraName = [maker, camera]
      .filter(Boolean)
      .join(' ') || 'Non renseigné';

    info.replaceChildren();

    output.textContent = JSON.stringify(
      store,
      null,
      2
    );

    row(
      '📷',
      'Appareil photo',
      'Modèle enregistré dans les informations de prise de vue.',
      cameraName
    );

    row(
      '👤',
      'Photographe',
      'Nom du photographe déclaré dans le fichier.',
      author || 'Non renseigné'
    );

    row(
      '📅',
      'Date de prise de vue',
      taken
        ? 'Date et heure enregistrées par l’appareil : ' + taken
        : 'Date non renseignée.',
      dateFR(taken)
    );

    row(
      intact ? '✓' : '?',
      'Intégrité de la photographie',
      intact
        ? 'Les données protégées correspondent à celles enregistrées lors de la signature.'
        : 'Le contrôle d’intégrité n’a pas été confirmé.',
      intact ? 'Vérifiée' : 'À vérifier',
      intact ? 'green' : 'orange'
    );

    row(
      signed ? '✓' : '?',
      'Signature de l’appareil',
      signed
        ? 'La signature numérique des informations de provenance est valide.'
        : 'La validité de la signature n’a pas été confirmée.',
      signed ? 'Valide' : 'À vérifier',
      signed ? 'green' : 'orange'
    );

    if (untrusted) {
      row(
        '!',
        'Confiance dans le certificat',
        'Le certificat du signataire n’est pas reconnu comme fiable par ce vérificateur.',
        'Non établie',
        'orange'
      );
    } else if (otherFailures.length) {
      row(
        '!',
        'Vérification du certificat',
        'Une ou plusieurs anomalies ont été signalées pendant la vérification.',
        'Anomalie',
        'red'
      );
    } else {
      row(
        '✓',
        'Vérification du certificat',
        'Aucune anomalie de confiance n’a été signalée par ce vérificateur.',
        'Sans alerte',
        'green'
      );
    }

    if (issuer) {
      row(
        '🏢',
        'Signataire indiqué',
        'Organisation mentionnée dans le certificat numérique.',
        issuer
      );
    }

    if (verified && untrusted) {
      status.textContent =
        'Signature et intégrité vérifiées · Confiance du certificat non établie';

      explanation.textContent =
        'La signature numérique est valide et les données protégées ' +
        'de cette photographie correspondent à celles qui ont été signées. ' +
        'Le certificat utilisé par le signataire n’est toutefois pas reconnu ' +
        'comme fiable par ce vérificateur. Cette réserve concerne la ' +
        'reconnaissance de l’identité du signataire, et non une modification ' +
        'détectée de la photographie.';

      intro.textContent =
        'Cette photographie contient des informations de provenance ' +
        'signées numériquement par un appareil ' + cameraName + '. ' +
        'Les contrôles C2PA confirment la validité de la signature ' +
        'et l’intégrité des données protégées.';

    } else if (verified) {
      status.textContent =
        'Signature et intégrité vérifiées · Aucune anomalie signalée';

      explanation.textContent =
        'La signature numérique est valide et les données protégées ' +
        'correspondent aux informations signées. ' +
        'Ces contrôles apportent des éléments techniques de provenance ' +
        'et d’intégrité de la photographie.';

      intro.textContent =
        'Cette photographie contient des informations de provenance ' +
        'signées numériquement par un appareil ' + cameraName + '. ' +
        'Leur signature et leur intégrité ont été vérifiées.';

    } else {
      status.textContent =
        'Vérification C2PA : certains contrôles restent à examiner';

      explanation.textContent =
        'La vérification n’a pas confirmé tous les contrôles attendus. ' +
        'Consultez les détails techniques pour connaître les résultats ' +
        'et les éventuelles anomalies.';

      intro.textContent =
        'Cette photographie contient des informations de provenance C2PA. ' +
        'Certains contrôles n’ont pas été confirmés.';
    }

  } catch (e) {
    console.error('Erreur C2PA :', e);

    status.textContent =
      'Erreur C2PA : ' + e.message;

    info.replaceChildren();

    row(
      '!',
      'Vérification indisponible',
      'Les informations C2PA n’ont pas pu être vérifiées.',
      'Erreur',
      'red'
    );

    explanation.textContent =
      'Détail de l’erreur : ' + e.message;

    output.textContent = String(
      e.stack ?? e
    );

    intro.textContent =
      'La vérification des informations de provenance ' +
      'n’est pas disponible pour le moment.';

  } finally {
    if (reader) {
      try {
        await reader.free();
      } catch (e) {
        console.warn(e);
      }
    }

    if (c2pa) {
      try {
        c2pa.dispose();
      } catch (e) {
        console.warn(e);
      }
    }
  }
}

init();
