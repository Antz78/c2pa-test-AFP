console.info('[AFP Distinguo] Marqueurs vectoriels à contraste élevé, couleurs C2PA réelles — v20261106-v5-origin-panel');
console.info('[C2PA AFP] Version filtres v3 chargée — badges À vérifier');
// Galerie C2PA — 100 % statique, fonctionne sur GitHub Pages.
// Deux modes :
//  A) ./photos.json existe (généré par GitHub Action à chaque push) → galerie automatique.
//  B) Sinon, glissez le dossier PHOTOS/ (ou des photos) directement sur la page.
// Version SDK fixée pour éviter les changements silencieux du CDN.
// Le SDK C2PA est chargé à la demande : une panne du CDN ne bloque PLUS la galerie.
const SDK_URL = 'https://cdn.jsdelivr.net/npm/@contentauth/c2pa-web@0.15.4/+esm';
let C2paReader = null;
let sdkFailure = null;

/* ===== Interface FR / EN : sans MutationObserver, sans analyse C2PA supplémentaire =====
   Seuls les libellés changent. Les données brutes de provenance restent intactes. */
const TRANSLATIONS = {
  'À analyser': 'Pending analysis',
  'Vérifiée': 'Verified',
  'À vérifier ⚠': 'Needs verification ⚠',
  'À vérifier': 'Needs verification',
  'Échec ✕': 'Failed ✕',
  'Échec': 'Failed',
  'Sans C2PA': 'No C2PA',
  'Analyse indisponible': 'Analysis unavailable',
  'Non renseigné': 'Not provided',
  'Non disponible': 'Not available',
  'Non vérifié': 'Not verified',
  'Non confirmé séparément': 'Not independently confirmed',
  'Confiance à vérifier': 'Trust not established',
  'Pourquoi ces indicateurs orange ?': 'Why are these indicators amber?',
  'Le certificat du signataire n’est pas reconnu comme fiable : son identité reste à confirmer. Cela ne signifie pas que la photo est fausse ou modifiée.': 'The signer’s certificate is not recognized as trusted, so their identity remains unconfirmed. This does not mean the photo is fake or altered.',
  'Certaines vérifications n’ont pas pu être confirmées par cet outil. Les informations restent à examiner : un indicateur orange ne prouve pas que la photo a été falsifiée.': 'This tool could not confirm some checks. The information needs further review: an amber indicator does not prove the photo was manipulated.',
  'Certificat non reconnu comme fiable par ce vérificateur.': 'This verifier does not recognize the certificate as trusted.',
  'Nom déclaré, mais identité non confirmée par ce vérificateur.': 'Declared name, but this verifier has not confirmed the identity.',
  'Orange : confiance ou vérification non confirmée.': 'Amber: trust or verification not confirmed.',
  'Gris : résultat non confirmé, donnée déclarative ou information absente. Ce n’est pas une preuve de falsification.': 'Grey: result not confirmed, declarative data or unavailable information. This is not evidence of tampering.',
  'Vert : information renseignée ou contrôle C2PA réussi selon le champ. Cela ne prouve pas que la scène est vraie.': 'Green: information available or a successful C2PA check, depending on the field. This does not prove the scene is true.',
  'Orange : une vérification reste incomplète ou le certificat du signataire n’est pas reconnu comme fiable. Cela ne signifie pas que l’image est fausse.': 'Amber: a check is incomplete or the signer’s certificate is not recognized as trusted. This does not mean the image is fake.',
  'Rouge : un contrôle C2PA a échoué (par exemple une incohérence de signature ou d’intégrité). Examiner le détail avant de conclure.': 'Red: a C2PA check failed (for example a signature or integrity mismatch). Review details before drawing conclusions.',
  'Rouge : le lecteur n’a pas pu analyser le fichier. Ce n’est pas une preuve que la photo a été modifiée.': 'Red: the reader could not analyze the file. This does not prove the photo was modified.',
  'Gris : aucun manifeste C2PA intégré détecté dans cette photo. La photo peut néanmoins être affichée.': 'Grey: no embedded C2PA manifest was found in this photo. The photo can still be displayed.',
  'Bleu : la vérification de la provenance est encore en cours.': 'Blue: provenance verification is still running.',
  'Signification de cet indicateur': 'Meaning of this indicator',
  'Source non renseignée': 'Source not provided',
  'Source : ': 'Source: ',
  'Provenance': 'Provenance',
  'Provenance à examiner': 'Provenance to review',
  'Informations sur la photo': 'Photo information',
  'Vérification C2PA': 'C2PA verification',
  'Intégrité du fichier': 'File integrity',
  'Signature numérique': 'Digital signature',
  'Signataire déclaré': 'Declared signer',
  'Générateur': 'Generator',
  'Auteur / photographe': 'Author / photographer',
  'Horodatage certifié (TSA)': 'Trusted timestamp (TSA)',
  'Date de prise de vue (EXIF)': 'Date taken (EXIF)',
  'Informations complémentaires': 'Additional information',
  'Données du manifeste': 'Manifest details',
  'Identifiant du manifeste': 'Manifest identifier',
  'Actions déclarées': 'Declared actions',
  'Certificat / signataire déclaré': 'Certificate / declared signer',
  'Résultats techniques de validation': 'Technical validation results',
  'Validé': 'Validated',
  'Indéterminé': 'Undetermined',
  'Aucun résultat détaillé retourné.': 'No detailed results returned.',
  'Chargement…': 'Loading…',
  'Chargement des informations…': 'Loading information…',
  'Vérification C2PA en cours…': 'C2PA verification in progress…',
  'Aucun manifeste trouvé.': 'No manifest found.',
  'Aucun manifeste C2PA intégré détecté.': 'No embedded C2PA manifest detected.',
  'Manifeste présent, mais une ou plusieurs vérifications ont échoué.': 'Manifest found, but one or more checks failed.',
  'Manifeste présent, mais la confiance du signataire nécessite une vérification.': 'Manifest found, but signer trust has not been established.',
  'Manifeste présent, mais la validation complète ne peut pas être confirmée.': 'Manifest found, but full validation could not be confirmed.',
  'Contrôles C2PA retournés sans problème signalé. Cela ne prouve pas la véracité de la scène.': 'C2PA checks reported no issue. This does not prove the scene is truthful.',
  'Information présente': 'Information available',
  'Information indisponible': 'Information unavailable',
  'Image inaccessible : vérifier le fichier dans PHOTOS/': 'Image unavailable: check the file in PHOTOS/',
  'Problème détecté': 'Issue detected',
  'Que signifie': 'What does',
  'Voir la provenance': 'View provenance',
  'Source sous la photo ↓': 'Source below photo ↓',
  '◈  Provenance': '◈  Provenance',
  'Soulever le coin pour voir la provenance C2PA': 'Lift the corner to view C2PA provenance',
  'Ouvrir la provenance C2PA depuis le coin lumineux': 'Open C2PA provenance from the glowing corner',
  'Ouvrir la provenance C2PA depuis le sceau': 'Open C2PA provenance from the seal',
  'Voir la provenance C2PA': 'View C2PA provenance',
  'Voir les informations C2PA': 'View C2PA information',
  'Origine non précisée': 'Origin not specified',
  'Origine du contenu (C2PA)': 'Content origin (C2PA)',
  'Catégorie affichée': 'Displayed category',
  'digitalSourceType (IPTC)': 'digitalSourceType (IPTC)',
  'Action C2PA': 'C2PA action',
  'Photo capturée': 'Captured photo',
  'Image générée par IA': 'AI-generated image',
  'Image composée': 'Composite image',
  'Origine inconnue': 'Unknown origin',
  'Image composée déclarée': 'Declared composite image',
  'Non renseigné dans le manifeste': 'Not specified in the manifest',
  'Sans manifeste C2PA intégré': 'No embedded C2PA manifest',
  'Lecture C2PA indisponible': 'C2PA reading unavailable',
  'Analyse en cours': 'Analysis in progress',
  'La catégorie résume le champ digitalSourceType déclaré dans le manifeste actif. Elle ne prouve pas la véracité de la scène.': 'The category summarizes the digitalSourceType declared in the active manifest. It does not prove the scene is real.',
  'Aucune valeur digitalSourceType utilisable : « inconnue » est une classification de cette interface, pas une valeur officielle C2PA.': 'No usable digitalSourceType value: “unknown” is a classification by this interface, not an official C2PA value.',
  'Prise du réel déclarée': 'Declared real-world capture',
  'Image générée par IA déclarée': 'Declared AI-generated image',
  'Image composite avec contenu IA déclaré': 'Declared composite image with AI-generated content',
  'Aucun index photo trouvé': 'Photo index not found',
  'Aucune photo indexée': 'No indexed photos',
  'Recherche des photos…': 'Looking for photos…',
  'Vérification de photos.json et du dossier PHOTOS/…': 'Checking photos.json and the PHOTOS/ folder…',
  'La galerie ne peut pas se charger automatiquement': 'The gallery could not load automatically',
  'Le fichier photos.json est introuvable ou inaccessible. Si vous avez ouvert index.html en local (double-clic), les photos listées par GitHub ne sont pas visibles : utilisez les boutons ci-dessous ou glissez vos photos sur la page. Sur GitHub Pages, vérifiez que photos.json est bien présent à la racine du site.':
    'The photos.json file is missing or inaccessible. If you opened index.html locally, GitHub photos cannot be listed: use the buttons below or drop photos onto the page. On GitHub Pages, check that photos.json exists at the site root.',
  'photos.json contient une liste vide et le dossier PHOTOS/ n\'a pas pu être lu via GitHub. Vérifiez que les fichiers JPG/PNG sont présents dans PHOTOS/ sur GitHub, puis relancez le workflow « Galerie C2PA » dans Actions. Vous pouvez aussi importer vos photos avec les boutons ci-dessous.':
    'photos.json is empty and the PHOTOS/ folder could not be listed via GitHub. Check that JPG/PNG files exist in PHOTOS/ and rerun the “Galerie C2PA” workflow in Actions. You can also import photos using the buttons below.',
  'Vérifie que le fichier correspond aux données protégées par le manifeste C2PA.': 'Checks whether the file matches the data protected by the C2PA manifest.',
  'Vérifie que les informations de provenance n’ont pas été modifiées après leur signature.': 'Checks that provenance information has not changed since it was signed.',
  'Organisme ou entreprise identifié dans le certificat ayant signé la provenance.': 'Organization or company identified by the certificate used to sign the provenance.',
  'Appareil ou logiciel ayant créé les informations C2PA.': 'Camera or software that created the C2PA information.',
  'Interprétation simplifiée de digitalSourceType par cette galerie. Ce n’est pas un verdict sur la vérité de la scène.': 'Simplified interpretation of digitalSourceType by this gallery. It is not a verdict about the scene.',
  'Champ standard de la spécification C2PA, dont la valeur est un identifiant officiel IPTC. Une valeur absente ne prouve rien sur la génération IA.': 'A field defined by C2PA using an official IPTC identifier. A missing value proves nothing about AI generation.',
  'Action (par exemple c2pa.created) portant le digitalSourceType dans le manifeste actif.': 'The action (for example c2pa.created) carrying digitalSourceType in the active manifest.',
  'Personne déclarée comme auteur de la photo ; cette identité n’est pas forcément vérifiée.': 'Person named as the photo author; their identity is not necessarily verified.',
  'Date attestée par un tiers indépendant : la signature existait au plus tard à cet instant.': 'Time certified by an independent authority: the signature existed no later than this time.',
  'Date enregistrée par l’horloge de l’appareil, modifiable et non certifiée à elle seule.': 'Date recorded by the camera clock; it can be modified and is not independently certified.',
  'EXIF Copyright (crédit déclaré)': 'EXIF Copyright (declared credit)',
  'Les photos ne se sont pas affichées. Vous pouvez ouvrir vos photos avec les boutons ci-dessous, puis vérifier le fichier photos.json et le script app.js sur GitHub.':
    'The photos have not appeared. You can open photos with the buttons below, then check photos.json and app.js on GitHub.'
};
let uiLanguage = 'fr';
try { uiLanguage = localStorage.getItem('afp-c2pa-language') === 'en' ? 'en' : 'fr'; } catch (_) {}
function tr(text) { return uiLanguage === 'en' ? (TRANSLATIONS[text] ?? text) : text; }
function statusLabel(state) { return tr(LABEL[state] ?? state); }
const STATIC_TRANSLATIONS = [
  ['header h1', 'Galerie & Content Credentials', 'Gallery & Content Credentials', 'heading'],
  ['.chip[data-filter="all"]', 'Toutes', 'All'],
  ['.chip[data-filter="ok"]', '✓ Vérifiées', '✓ Verified'],
  ['.chip[data-filter="warn"]', '⚠ À vérifier', '⚠ Review needed'],
  ['.chip[data-filter="bad"]', '✕ Échecs', '✕ Failed'],
  ['.chip[data-filter="none"]', 'Sans C2PA', 'No C2PA'],
  ['.mode-label', 'Présentation :', 'Presentation:'],
  ['#presentation-mode option[value="random"]', '🎲 Aléatoire', '🎲 Random'],
  ['#presentation-mode option[value="info"]', 'ⓘ Icône info', 'ⓘ Info icon'],
  ['#presentation-mode option[value="afp"]', 'AFP · Onglet', 'AFP · Tab'],
  ['#presentation-mode option[value="direct"]', 'Panneau visible', 'Visible panel'],
  ['#presentation-mode option[value="banner"]', 'Bandeau', 'Banner'],
  ['#presentation-mode option[value="status"]', 'Pastille de confiance', 'Trust indicator'],
  ['#presentation-mode option[value="corner"]', 'Coin de page transparent', 'Transparent page corner'],
  ['#presentation-mode option[value="glow"]', 'Bordure lumineuse', 'Glowing corner'],
  ['#presentation-mode option[value="seal"]', 'Sceau de provenance', 'Provenance seal'],
  ['#presentation-mode option[value="drawer"]', 'Volet à tirer depuis le bas', 'Pull-up bottom sheet'],
  ['#presentation-mode option[value="shield"]', 'Petit bouclier coché', 'Small check shield'],
  ['#presentation-mode option[value="shield-delayed"]', 'Bouclier coloré après 2 secondes', 'Colored shield after 2 seconds'],
  ['#presentation-mode option[value="origin-distinguo"]', 'Distinguo IA / réel / composé', 'AI / real / composite distinction'],
  ['#presentation-mode option[value="cr-official"]', 'CR officiel', 'Official CR'],
  ['#presentation-mode option[value="delayed"]', 'Pastille retardée (1,5 s)', 'Delayed indicator (1.5 s)'],
  ['#presentation-mode option[value="tap"]', 'Révélation au tap / glissement', 'Tap / swipe reveal'],
  ['#presentation-mode option[value="caption"]', 'Légende liée sous la photo', 'Caption under photo'],
  ['#reshuffle', '↻ Redistribuer', '↻ Shuffle'],
  ['#empty-title', 'Glissez votre dossier PHOTOS/ (ou vos photos) sur cette page', 'Drop your PHOTOS/ folder (or photos) here', 'empty'],
  ['#pick-photos', '🖼️ Choisir des photos', '🖼️ Choose photos'],
  ['#pick-folder', '📁 Choisir un dossier', '📁 Choose a folder'],
  ['#empty .hint', 'Sur GitHub Pages, la galerie lit automatiquement le dossier PHOTOS/ du repo (via photos.json généré par le workflow, ou en repli via l’API GitHub).', 'On GitHub Pages, the gallery automatically loads the PHOTOS/ folder (using workflow-generated photos.json or the GitHub API as a fallback).', 'hint'],
  ['#dropzone .drop-inner', 'Relâchez pour importer vos photos', 'Drop to import your photos'],
  ['#tap-reveal .tap-reveal-title', 'Provenance numérique', 'Digital provenance'],
  ['#tap-reveal-more', 'Voir les informations complètes ›', 'View full information ›'],
  ['#side-panel .eyebrow', 'Provenance numérique', 'Digital provenance'],
  ['#bottom-sheet .eyebrow', 'Provenance numérique', 'Digital provenance'],
  ['#credentials .eyebrow', 'Provenance numérique', 'Digital provenance'],
  ['#side-panel details > summary', 'Informations techniques du manifeste', 'Technical manifest data'],
  ['#bottom-sheet details > summary', 'Informations techniques du manifeste', 'Technical manifest data'],
  ['#credentials details > summary', 'Informations techniques du manifeste', 'Technical manifest data'],
  ['#side-panel .note', 'Vert : information présente ou contrôle réussi. Orange : confiance à vérifier. Rouge : échec de contrôle. Une information renseignée ne garantit pas qu\'elle soit vraie.', 'Green: information available or a successful check. Amber: trust requires review. Red: a failed check. A declared value is not proof it is true.'],
  ['#bottom-sheet .bottom-sheet-note', 'Les Content Credentials décrivent une provenance déclarée et les contrôles effectués. Ils ne garantissent pas la véracité de la scène.', 'Content Credentials describe declared provenance and checks performed. They do not guarantee that the scene is true.'],
  ['#credentials .note', 'Les indicateurs verts signalent des informations présentes ou des contrôles réussis ; orange signifie « à vérifier » ; rouge indique un échec de contrôle. Une information renseignée ne prouve pas à elle seule qu’elle est vraie.', 'Green indicators show available information or successful checks; amber means review needed, and red indicates a failed check. A provided value does not, by itself, prove it is true.'],
  ['#side-panel .c2pa-explainer h3', 'ⓘ Qu’est-ce que le C2PA ?', 'ⓘ What is C2PA?'],
  ['#side-panel .c2pa-explainer p:nth-of-type(1)', 'Le C2PA (Coalition for Content Provenance and Authenticity) est un standard ouvert permettant d’associer des Content Credentials à un fichier : origine déclarée, historique et modifications enregistrées.', 'C2PA (Coalition for Content Provenance and Authenticity) is an open standard for attaching Content Credentials to a file: declared origin, history, and recorded edits.'],
  ['#side-panel .c2pa-explainer li:nth-child(1)', 'Il contribue à la transparence sur la provenance.', 'It increases transparency about provenance.'],
  ['#side-panel .c2pa-explainer li:nth-child(2)', 'Il peut signaler des modifications ou des étapes impliquant l’IA si elles ont été enregistrées.', 'It may describe edits or AI-related steps if they were recorded.'],
  ['#side-panel .c2pa-explainer li:nth-child(3)', 'Il ne prouve pas la véracité de la scène ni la fiabilité de la source.', 'It does not prove that a scene is real or a source trustworthy.'],
  ['#side-panel .c2pa-explainer p:nth-of-type(2)', 'Un certificat non reconnu comme fiable ne signifie pas automatiquement que l’image a été falsifiée.', 'An untrusted certificate does not automatically mean the image was manipulated.'],
  ['#c2pa-explain-title', 'Qu’est-ce que le C2PA ?', 'What is C2PA?'],
  ['#credentials .c2pa-explainer > p:nth-of-type(1)', 'Le C2PA (Coalition for Content Provenance and Authenticity) est un standard ouvert qui permet d’associer à un fichier des Content Credentials : des informations sur sa provenance et, lorsqu’elles sont renseignées, sur les étapes de sa création ou de ses modifications.', 'C2PA is an open standard for attaching Content Credentials to a file: information about its provenance and, when recorded, steps in its creation or editing.'],
  ['#credentials .c2pa-explainer li:nth-child(1)', 'Il aide à retracer l’origine déclarée et l’historique d’un contenu.', 'It helps trace the declared origin and history of content.'],
  ['#credentials .c2pa-explainer li:nth-child(2)', 'Il peut signaler certaines modifications ou utilisations d’outils d’IA, si elles ont été enregistrées.', 'It may disclose edits or the use of AI tools if recorded.'],
  ['#credentials .c2pa-explainer li:nth-child(3)', 'Il ne garantit pas qu’une scène est vraie, ni qu’une source est digne de confiance.', 'It does not guarantee that a scene is true or that a source is trustworthy.'],
  ['#credentials .c2pa-explainer > p:nth-of-type(2)', '« certificat non fiable » ne signifie pas automatiquement « image falsifiée ». Cela signifie que la confiance cryptographique n’a pas pu être établie par le système de vérification utilisé.', 'An “untrusted certificate” does not automatically mean an “altered image.” It means cryptographic trust could not be established by the verification system.', 'strong'],
  ['#cr-close', 'Fermer', 'Close'],
];
const STATIC_ATTRIBUTES = [
  ['#search', 'placeholder', 'Rechercher un fichier…', 'Search files…'],
  ['#search', 'aria-label', 'Rechercher', 'Search'],
  ['.filters', 'aria-label', 'Filtres', 'Filters'],
  ['#presentation-mode', 'aria-label', 'Choisir la présentation C2PA', 'Choose C2PA presentation'],
  ['#reshuffle', 'title', 'Redistribuer les présentations', 'Shuffle presentations'],
  ['#lb-close', 'aria-label', 'Fermer', 'Close'],
  ['#lb-prev', 'aria-label', 'Photo précédente', 'Previous photo'],
  ['#lb-next', 'aria-label', 'Photo suivante', 'Next photo'],
  ['#side-panel', 'aria-label', 'Content Credentials de la photographie', 'Photo Content Credentials'],
  ['#side-close', 'aria-label', 'Fermer le panneau', 'Close panel'],
  ['#bottom-sheet', 'aria-label', 'Volet des informations C2PA', 'C2PA information sheet'],
  ['#bottom-sheet-handle', 'aria-label', 'Tirer le volet de provenance vers le bas pour le fermer', 'Pull the provenance sheet down to close it'],
  ['#bottom-close', 'aria-label', 'Fermer le volet', 'Close sheet'],
  ['#tap-reveal-close', 'aria-label', 'Masquer les informations', 'Hide information'],
  ['#cr-badge', 'aria-label', 'Afficher les Content Credentials', 'View Content Credentials'],
];
function updateStaticTranslations() {
  ensurePresentationOptions();
  document.documentElement.lang = uiLanguage;
  document.title = uiLanguage === 'en' ? 'Gallery · Content Credentials' : 'Galerie · Content Credentials';
  for (const [selector, fr, en, special] of STATIC_TRANSLATIONS) {
    const el = document.querySelector(selector);
    if (!el) continue;
    const value = uiLanguage === 'en' ? en : fr;
    if (special === 'heading') {
      // Conserver le logo AFP, traduire uniquement le nœud texte.
      const node = [...el.childNodes].find(n => n.nodeType === Node.TEXT_NODE);
      if (node) node.textContent = ' ' + value;
    } else if (special === 'hint') {
      el.replaceChildren(document.createTextNode(value));
    } else if (special === 'strong') {
      const node = [...el.childNodes].find(n => n.nodeType === Node.TEXT_NODE);
      if (node) node.textContent = value;
    } else if (special === 'empty') {
      // Ne pas écraser les messages de diagnostic générés par setEmpty().
      if (el.dataset.dynamicEmpty !== '1') el.textContent = value;
    } else {
      el.textContent = value;
    }
  }
  for (const [selector, attr, fr, en] of STATIC_ATTRIBUTES) {
    const el = document.querySelector(selector);
    if (el) el.setAttribute(attr, uiLanguage === 'en' ? en : fr);
  }
}
function changeLanguage(next) {
  if (!['fr','en'].includes(next) || next === uiLanguage) return;
  uiLanguage = next;
  if (typeof hideColorHelp === 'function') hideColorHelp();
  try { localStorage.setItem('afp-c2pa-language', next); } catch (_) {}
  updateStaticTranslations();
  syncLanguageButtons();
  updateCount();
  for (const photo of photos) {
    const card = grid.querySelector(`[data-idx="${photo.idx}"]`);
    if (!card) continue;
    const tag = card.querySelector('.tag');
    const textNode = tag?.lastChild;
    if (textNode?.nodeType === Node.TEXT_NODE) textNode.textContent = statusLabel(photo.state);
  }
  const overlays = document.querySelectorAll('.demo-overlay, #cr-badge');
  for (const overlay of overlays) {
    const mode = [...overlay.classList].find(c => c.startsWith('mode-'))?.slice(5) || 'info';
    const banner = overlay.querySelector('.banner-label'); if (banner) banner.textContent = tr('Voir la provenance');
    const caption = overlay.querySelector('.caption-marker'); if (caption) caption.textContent = tr('Source sous la photo ↓');
    const delayed = overlay.querySelector('.delayed-badge'); if (delayed) delayed.textContent = tr('◈  Provenance');
    overlay.setAttribute('aria-label', mode === 'corner' ? tr('Soulever le coin pour voir la provenance C2PA') : mode === 'glow' ? tr('Ouvrir la provenance C2PA depuis le coin lumineux') : mode === 'seal' ? tr('Ouvrir la provenance C2PA depuis le sceau') : tr('Voir la provenance C2PA'));
  }
  for (const photo of photos) {
    const card = grid.querySelector(`[data-idx="${photo.idx}"]`);
    if (card) updateCaption(card, photo);
  }
  if (currentIdx >= 0 && photos[currentIdx]) {
    const photo = photos[currentIdx];
    const captionBtn = document.querySelector('#lb-caption-source');
    if (captionBtn && !captionBtn.hidden) captionBtn.textContent = tr('Source : ') + sourceLabel(photo) + '  ›';
    if (!tapReveal.hidden) document.querySelector('#tap-reveal-summary').textContent = tr('Source : ') + sourceLabel(photo) + ' · ' + statusLabel(photo.state);
    // Uniquement du rendu : ne pas appeler openLightbox() / analyze().
    fillDetails(photo);
    if (!sidePanel.hidden && sidePhoto === photo) refreshSidePanel(photo);
    if (!bottomSheet.hidden && bottomPhoto === photo) refreshBottomSheet(photo);
  }
  if (emptyBox && !emptyBox.hidden) {
    // Conserver la cause du diagnostic, mais retraduire les messages connus.
    emptyTitle.textContent = tr(emptyTitle.dataset.frText || emptyTitle.textContent);
    emptyMsg.textContent = tr(emptyMsg.dataset.frText || emptyMsg.textContent);
  }
}
function syncLanguageButtons() {
  for (const box of document.querySelectorAll('.afp-language-switch')) {
    for (const button of box.querySelectorAll('button')) {
      const active = button.dataset.lang === uiLanguage;
      button.setAttribute('aria-pressed', String(active));
      button.classList.toggle('is-current', active);
    }
  }
}
function installLanguageSwitch() {
  if (document.querySelector('#afp-language-switch')) return;
  const style = document.createElement('style');
  style.textContent = `
    .afp-language-switch{display:inline-flex;gap:2px;align-items:center;padding:3px;border:1px solid #40516a;border-radius:999px;background:#1c2733;white-space:nowrap;margin-left:auto;flex-shrink:0}
    .afp-language-switch button{border:0;border-radius:999px;background:transparent;color:#b9c8da;font:700 12px/1.4 system-ui,sans-serif;padding:5px 9px;cursor:pointer}
    .afp-language-switch button.is-current{background:#4f8ff7;color:white}
    .afp-language-switch button:focus-visible{outline:2px solid #91bdff;outline-offset:2px}
    #lightbox .afp-language-switch{margin-left:0;background:#172232dc;backdrop-filter:blur(8px);z-index:32}
    #credentials .afp-language-switch{float:right;margin-left:8px}
    #side-panel > .afp-language-switch, #bottom-sheet > .afp-language-switch{display:flex;width:max-content;margin:0 0 12px auto}
    @media(max-width:700px){.afp-language-switch{margin-left:0} .afp-language-switch button{padding:5px 8px}}
  `;
  document.head.append(style);
  const placements = [
    ['header', 'afp-language-switch'],
    ['#lightbox .lb-top', 'afp-language-switch-lightbox'],
    ['#credentials .credential-head', 'afp-language-switch-credentials'],
    ['#side-panel', 'afp-language-switch-side'],
    ['#bottom-sheet', 'afp-language-switch-bottom']
  ];
  for (const [parentSelector, id] of placements) {
    const parent = document.querySelector(parentSelector);
    if (!parent) continue;
    const box = document.createElement('div');
    box.id = id; box.className = 'afp-language-switch';
    box.setAttribute('role','group');
    box.setAttribute('aria-label','Language / Langue');
    for (const lang of ['fr','en']) {
      const button = document.createElement('button');
      button.type='button'; button.dataset.lang=lang; button.textContent=lang.toUpperCase();
      button.addEventListener('click', () => changeLanguage(lang));
      box.append(button);
    }
    if (id === 'afp-language-switch-side') {
      parent.insertBefore(box, parent.querySelector('#side-status'));
    } else if (id === 'afp-language-switch-bottom') {
      parent.insertBefore(box, parent.querySelector('.bottom-sheet-body'));
    } else if (id === 'afp-language-switch-lightbox') {
      const close = parent.querySelector('#lb-close');
      parent.insertBefore(box, close);
    } else parent.append(box);
  }
  updateStaticTranslations(); syncLanguageButtons();
}

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

// Réseau borné dans le temps : une API GitHub lente ne doit pas laisser l'écran vide.
async function fetchWithTimeout(url, options = {}, milliseconds = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), milliseconds);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/* Une image indexée peut avoir des espaces, accents, #, ?, % ou être rangée dans un sous-dossier.
   Toujours encoder chaque segment du chemin AVANT de créer une URL DOM. */
function photoUrl(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const path = raw.trim().replace(/\\/g, '/');
  if (/^(?:blob:|data:)/i.test(path)) return path;
  if (/^https?:\/\//i.test(path)) {
    try { const u = new URL(path); return IMAGE_RE.test(u.pathname) ? u.href : null; }
    catch (_) { return null; }
  }
  const parts = path.replace(/^\.\//, '').split('/').filter(Boolean);
  if (!parts.length) return null;
  const last = parts[parts.length - 1];
  // Accepter aussi les caractères # et ? dans le nom réel, sans les traiter en paramètres d'URL.
  if (!IMAGE_RE.test(safeDecode(last))) return null;
  return './' + parts.map(s => encodeURIComponent(safeDecode(s))).join('/');
}
function safeDecode(value) { try { return decodeURIComponent(value); } catch (_) { return value; } }
function photoKey(url) {
  try { return new URL(url, location.href).pathname.toLowerCase(); } catch (_) { return String(url).toLowerCase(); }
}

/* ---------- Mode A : index photos.json (généré par CI) ---------- */
/* Renvoie { state: 'ok' | 'missing' | 'empty', urls: string[] } */
async function probeIndex() {
  try {
    const r = await fetchWithTimeout('./photos.json', { cache: 'no-store' }, 5500);
    if (!r.ok) return { state: 'missing', urls: [] };
    const data = await r.json();
    const list = Array.isArray(data) ? data : (Array.isArray(data?.photos) ? data.photos : []);
    const urls = list.map(p => photoUrl(typeof p === 'string' ? p : p?.url)).filter(Boolean);
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
  const found = new Set();
  const dirs = ['PHOTOS'];
  // Le endpoint Contents n'est pas récursif : ne pas oublier les PNG des sous-dossiers.
  for (let n = 0; dirs.length && n < 20; n++) {
    const dir = dirs.shift();
    try {
      const path = dir.split('/').map(encodeURIComponent).join('/');
      const r = await fetchWithTimeout(`https://api.github.com/repos/${repo}/contents/${path}`, { cache: 'no-store' }, 6500);
      if (!r.ok) { console.warn('[C2PA AFP] GitHub Contents:', r.status, dir); continue; }
      const items = await r.json();
      if (!Array.isArray(items)) continue;
      for (const item of items) {
        if (item.type === 'dir') dirs.push(item.path);
        if (item.type === 'file' && IMAGE_RE.test(item.name)) {
          const url = photoUrl('./' + item.path);
          if (url) found.add(url);
        }
      }
    } catch (error) { console.warn('[C2PA AFP] Liste GitHub indisponible', dir, error); }
  }
  return [...found];
}

/* ---------- Mode B : glisser-déposer (fichiers ou dossier) ---------- */
function collectFromDataTransfer(items) {
  const entries = [...items].map(i => i.webkitGetAsEntry?.()).filter(Boolean);
  const files = [];
  const walk = (entry, path = '') => new Promise(resolve => {
    if (entry.isFile) {
      entry.file(f => { try { Object.defineProperty(f, 'webkitRelativePath', { value: path + entry.name, configurable: true }); } catch (_) {} files.push(f); resolve(); },
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
  scheduleAnalysis(); // Laisser le navigateur afficher les vignettes avant la vérification.
  return true;
}

/* EXIF / crédits lus dans les octets d'origine, sans réencoder l'image.
   JPEG : segment APP1 ; PNG : bloc eXIf et blocs textuels tEXt / iTXt.
   Il s'agit de déclarations, PAS de preuves cryptographiques. */
function parseTiffExif(data, tiff, result) {
  if (tiff + 8 > data.byteLength) return;
  const endian = data.getUint16(tiff);
  if (endian !== 0x4949 && endian !== 0x4d4d) return;
  const le = endian === 0x4949;
  const u16 = p => p >= tiff && p + 2 <= data.byteLength ? data.getUint16(p, le) : null;
  const u32 = p => p >= tiff && p + 4 <= data.byteLength ? data.getUint32(p, le) : null;
  if (u16(tiff + 2) !== 42) return;
  function entries(offset) {
    const out = new Map();
    if (!Number.isInteger(offset) || offset < 0) return out;
    const start = tiff + offset, n = u16(start);
    if (n === null || n > 1024 || start + 2 + n * 12 > data.byteLength) return out;
    for (let i = 0; i < n; i++) {
      const e = start + 2 + i * 12;
      const tag = u16(e), type = u16(e + 2), count = u32(e + 4);
      if (tag === null || count === null) continue;
      if (type === 2 && count > 0 && count <= 4096) {
        const offsetValue = u32(e + 8);
        const at = count <= 4 ? e + 8 : tiff + offsetValue;
        if (at >= tiff && at + count <= data.byteLength) {
          const bytes = new Uint8Array(data.buffer, data.byteOffset + at, count);
          const zero = bytes.indexOf(0);
          const str = new TextDecoder('latin1').decode(bytes.subarray(0, zero < 0 ? count : zero)).trim();
          if (str) out.set(tag, str);
        }
      } else if (type === 4 && count === 1) out.set(tag, u32(e + 8));
    }
    return out;
  }
  const root = entries(u32(tiff + 4));
  const exif = typeof root.get(0x8769) === 'number' ? entries(root.get(0x8769)) : new Map();
  result.artist ||= root.get(0x013b) || null;
  result.copyright ||= root.get(0x8298) || null;
  const raw = exif.get(0x9003) || root.get(0x0132);
  if (typeof raw === 'string' && /^\d{4}:\d{2}:\d{2} \d{2}:\d{2}:\d{2}$/.test(raw)) {
    const offset = exif.get(0x9011) || exif.get(0x9010) || '';
    result.date ||= `${raw.slice(8,10)}/${raw.slice(5,7)}/${raw.slice(0,4)} ${raw.slice(11)}${/^[+-]\d{2}:\d{2}$/.test(offset) ? ' (UTC' + offset + ')' : ''}`;
  }
}
function applyPngText(key, value, result) {
  const name = key.trim().toLowerCase();
  const text = value.trim();
  if (!text) return;
  if (['author', 'artist', 'creator', 'dc:creator', 'by-line'].includes(name)) result.artist ||= text;
  else if (['copyright', 'copyright notice', 'rights', 'dc:rights'].includes(name)) result.copyright ||= text;
  else if (['date time original', 'datetimeoriginal', 'date created', 'creation time'].includes(name)) {
    // Les dates PNG non EXIF sont déclaratives et peuvent avoir plusieurs formats.
    const exif = text.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}:\d{2}:\d{2})$/);
    result.date ||= exif ? `${exif[3]}/${exif[2]}/${exif[1]} ${exif[4]}` : text.slice(0, 90);
  }
  // XMP simple (non compressé) : valeur textuelle fréquente dans les PNG exportés.
  if (name.includes('xmp') && text.length < 500000) {
    const xmlUnescape = str => str.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
    const author = text.match(/<dc:creator\b[^>]*>[\s\S]*?<rdf:li\b[^>]*>([^<]+)<\/rdf:li>/i) || text.match(/\b(?:photoshop:AuthorsPosition|dc:creator)="([^"]+)"/i);
    if (author) result.artist ||= xmlUnescape(author[1]);
    const rights = text.match(/<dc:rights\b[^>]*>[\s\S]*?<rdf:li\b[^>]*>([^<]+)<\/rdf:li>/i);
    if (rights) result.copyright ||= xmlUnescape(rights[1]);
    const date = text.match(/\bexif:DateTimeOriginal="([^"]+)"/i) || text.match(/<exif:DateTimeOriginal>([^<]+)<\/exif:DateTimeOriginal>/i);
    if (date) applyPngText('DateTimeOriginal', date[1], result);
  }
}
async function readExifMetadata(blob) {
  const result = { date: null, artist: null, copyright: null };
  try {
    // Une tranche limitée pour préserver les performances des images haute résolution.
    const data = new DataView(await blob.slice(0, 8 * 1024 * 1024).arrayBuffer());
    if (data.byteLength < 12) return result;
    if (data.getUint16(0) === 0xffd8) {
      let pos = 2;
      while (pos + 4 <= data.byteLength) {
        if (data.getUint8(pos) !== 0xff) break;
        const marker = data.getUint8(pos + 1);
        if (marker === 0xda || marker === 0xd9) break;
        if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { pos += 2; continue; }
        const length = data.getUint16(pos + 2);
        if (length < 2 || pos + 2 + length > data.byteLength) break;
        const base = pos + 4;
        if (marker === 0xe1 && length >= 8 && [69,120,105,102,0,0].every((v,i) => data.getUint8(base+i) === v)) {
          parseTiffExif(data, base + 6, result);
          break;
        }
        pos += 2 + length;
      }
    } else if ([137,80,78,71,13,10,26,10].every((v,i) => data.getUint8(i) === v)) {
      // Chaque bloc PNG a : longueur (4), type (4), données, CRC (4).
      let pos = 8;
      while (pos + 12 <= data.byteLength) {
        const size = data.getUint32(pos); // PNG : big-endian
        const end = pos + 12 + size;
        if (end > data.byteLength) break; // tranche incomplète
        const kind = String.fromCharCode(...new Uint8Array(data.buffer, data.byteOffset + pos + 4, 4));
        const from = pos + 8;
        if (kind === 'eXIf') parseTiffExif(data, from, result);
        if ((kind === 'tEXt' || kind === 'iTXt') && size <= 1024 * 1024) {
          const bytes = new Uint8Array(data.buffer, data.byteOffset + from, size);
          const zero = bytes.indexOf(0);
          if (zero > 0) {
            const key = new TextDecoder('latin1').decode(bytes.subarray(0, zero));
            if (kind === 'tEXt') {
              applyPngText(key, new TextDecoder('latin1').decode(bytes.subarray(zero + 1)), result);
            } else if (zero + 3 < size && bytes[zero + 1] === 0) {
              // iTXt non compressé : flag/méthode, langue NUL, traduction NUL, texte UTF-8.
              const langEnd = bytes.indexOf(0, zero + 3);
              const translatedEnd = langEnd < 0 ? -1 : bytes.indexOf(0, langEnd + 1);
              if (translatedEnd >= 0) applyPngText(key, new TextDecoder('utf-8').decode(bytes.subarray(translatedEnd + 1)), result);
            }
          }
        }
        pos = end;
        if (kind === 'IEND') break;
      }
    }
  } catch (err) { console.warn('Lecture EXIF/PNG', err); }
  return result;
}

/* ---------- Analyse C2PA ---------- */
async function ensureC2pa() {
  if (sdkFailure) throw sdkFailure;
  if (!c2paPromise) {
    c2paPromise = (async () => {
      const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Chargement du moteur C2PA trop long')), 12000));
      const sdk = await Promise.race([import(SDK_URL), timeout]);
      C2paReader = sdk.Reader;
      if (typeof sdk.createC2pa !== 'function' || !C2paReader) throw new Error('SDK C2PA incomplet');
      c2pa = await sdk.createC2pa({ wasmSrc: WASM_URL });
      return c2pa;
    })().catch(error => { sdkFailure = error; throw error; });
  }
  return c2paPromise;
}

async function getBlob(photo) {
  if (photo.blob) return photo.blob;
  const response = await fetchWithTimeout(photo.url, { cache: 'no-store' }, 30000);
  if (!response.ok) throw new Error('Photo inaccessible (HTTP ' + response.status + ')');
  const blob = await response.blob();
  if (/text\/html/i.test(blob.type)) throw new Error('Le serveur a renvoyé une page HTML au lieu de la photo');
  return blob;
}

async function analyze(photo) {
  if (photo.state !== 'loading') return;
  if (photo.analysisPromise) return photo.analysisPromise;
  photo.analysisPromise = (async () => {
    let reader = null;
    try {
      const blob = await getBlob(photo);
      photo.exif = await readExifMetadata(blob);
      photo.exifDate = photo.exif.date;
      const ext = photo.name.split('.').pop().toLowerCase();
      if (ext === 'png') {
        const header = new Uint8Array(await blob.slice(0, 8).arrayBuffer());
        if (!([137,80,78,71,13,10,26,10].every((v, i) => header[i] === v))) {
          throw new Error('Fichier .png invalide ou image inaccessible (en-tête PNG absent)');
        }
      }
      const engine = await ensureC2pa();
      // Utiliser le format du fichier avant le Content-Type HTTP, parfois générique.
      // Indispensable pour analyser correctement les PNG hébergés sur GitHub Pages.
      const mime = ({jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',tif:'image/tiff',tiff:'image/tiff'})[ext] || blob.type;
      reader = await C2paReader.fromBlob(engine, mime, blob);
      if (!reader) { photo.state = 'none'; return; }
      const store = await reader.manifestStore();
      photo.store = store;
      const entries = store?.validation_status ?? store?.validationStatus ?? [];
      const list = Array.isArray(entries) ? entries : [];
      photo.validation = list;
      photo.active = await reader.activeManifest().catch(() => null);
      const levels = list.map(validationLevel);
      photo.state = !store ? 'none' : levels.includes('bad') ? 'bad' : levels.includes('warn') ? 'warn' : levels.includes('neutral') || !list.length ? 'warn' : 'ok';
    } catch (error) {
      console.warn('C2PA', photo.name, error);
      photo.error = error?.message ?? String(error);
      // Certains moteurs lancent une exception pour un PNG valide dépourvu de manifeste.
      // Cela n'est ni une falsification, ni une erreur d'affichage de la photo.
      photo.state = /no.?manifest|manifest.?not.?found|no.?c2pa.?manifest/i.test(photo.error) ? 'none' : 'error';
    } finally {
      if (reader) try { await reader.free(); } catch (_) {}
    }
  })().finally(() => { photo.analysisPromise = null; });
  return photo.analysisPromise;
}

// Traiter les photos l'une après l'autre, APRÈS l'affichage de la grille.
// Une validation C2PA lourde ne peut ainsi plus retarder l'apparition des images.
let analysisScheduled = false;
let analysisRunning = false;
function scheduleAnalysis() {
  if (analysisScheduled || analysisRunning) return;
  analysisScheduled = true;
  setTimeout(() => { analysisScheduled = false; analyzeAll().catch(error => console.warn('Analyse galerie', error)); }, 800);
}
async function analyzeAll() {
  if (analysisRunning) return;
  analysisRunning = true;
  try {
    while (true) {
      const photo = photos.find(p => p.state === 'loading' && !p.processing);
      if (!photo) break;
      photo.processing = true;
      // Un rendu intermédiaire est possible même avec beaucoup de fichiers.
      await new Promise(resolve => setTimeout(resolve, 75));
      await analyze(photo);
      photo.processing = false;
      renderCard(photo);
      updateCount();
      refreshSidePanel(photo);
    }
  } finally {
    analysisRunning = false;
  }
}

/* ---------- Rendu ---------- */
const LABEL = { loading: 'À analyser', ok: 'Vérifiée', warn: 'À vérifier ⚠', bad: 'Échec ✕', none: 'Sans C2PA', error: 'Analyse indisponible' };


const PRESENTATIONS = ['info','afp','direct','banner','status','corner','glow','seal','drawer','shield','origin-distinguo','cr-official','delayed','tap','caption','shield-delayed'];
const modeSelect = document.querySelector('#presentation-mode');
const EXTRA_PRESENTATION_OPTIONS = [
  { value: 'origin-distinguo', fr: 'Distinguo IA / réel / composé', en: 'AI / real / composite distinction' },
  { value: 'cr-official', fr: 'CR officiel', en: 'Official CR' }
];
function ensurePresentationOptions() {
  if (!modeSelect) return;
  for (const item of EXTRA_PRESENTATION_OPTIONS) {
    let option = modeSelect.querySelector(`option[value="${item.value}"]`);
    if (!option) {
      option = document.createElement('option');
      option.value = item.value;
      modeSelect.append(option);
    }
    option.textContent = uiLanguage === 'en' ? item.en : item.fr;
  }
}
ensurePresentationOptions();
const originBadgeStyle = document.createElement('style');
originBadgeStyle.textContent = `
  /* Distinguo : 4 pictogrammes homogènes, plus gros, plus lisibles sur tous les fonds. */
  @keyframes afpDistinguoHop {
    0%,100% { transform:translateY(0) scale(1); }
    22% { transform:translateY(-2px) scale(1.05) rotate(-2deg); }
    48% { transform:translateY(0) scale(1.01) rotate(1.5deg); }
    72% { transform:translateY(-1.4px) scale(1.045) rotate(-1.2deg); }
  }
  #grid .demo-overlay.mode-origin-distinguo,
  #lightbox #cr-badge.mode-origin-distinguo {
    box-sizing:border-box!important;
    display:grid!important;place-items:center!important;
    position:absolute!important;
    padding:0!important;margin:0!important;
    width:48px!important;height:48px!important;min-width:0!important;min-height:0!important;
    right:10px!important;bottom:6px!important;left:auto!important;top:auto!important;
    background:transparent!important;border:0!important;border-radius:0!important;
    outline:0!important;box-shadow:none!important;backdrop-filter:none!important;
    -webkit-backdrop-filter:none!important;overflow:visible!important;
    opacity:0!important;visibility:hidden!important;pointer-events:none!important;
    transition:filter .2s ease, opacity .22s ease!important;
    filter:none!important;
  }
  #lightbox #cr-badge.mode-origin-distinguo {
    width:56px!important;height:56px!important;
    right:18px!important;bottom:8px!important;
  }
  #grid .demo-overlay.mode-origin-distinguo.origin-visible,
  #lightbox #cr-badge.mode-origin-distinguo.delayed-visible {
    opacity:.88!important;visibility:visible!important;pointer-events:auto!important;
  }
  #grid .demo-overlay.mode-origin-distinguo svg,
  #lightbox #cr-badge.mode-origin-distinguo svg {
    display:block!important;overflow:visible!important;flex:none!important;
    width:40px!important;height:40px!important;
    padding:0!important;margin:0!important;fill:none!important;stroke:none!important;
    opacity:1!important;transform-origin:center!important;pointer-events:none!important;
    filter:drop-shadow(0 0 1px rgba(255,255,255,.55)) drop-shadow(0 1px 2px rgba(0,0,0,.72))!important;
  }
  #lightbox #cr-badge.mode-origin-distinguo svg {width:46px!important;height:46px!important;}
  #grid .demo-overlay.mode-origin-distinguo svg .origin-halo,
  #lightbox #cr-badge.mode-origin-distinguo svg .origin-halo {
    fill:none!important;stroke:#0b1220!important;stroke-width:4.9!important;
    stroke-linecap:round!important;stroke-linejoin:round!important;opacity:1!important;
  }
  #grid .demo-overlay.mode-origin-distinguo svg .origin-ink,
  #lightbox #cr-badge.mode-origin-distinguo svg .origin-ink {
    fill:none!important;stroke:var(--origin-foreground,#cfd6de)!important;
    stroke-width:2.55!important;stroke-linecap:round!important;stroke-linejoin:round!important;
    opacity:1!important;
  }
  #grid .demo-overlay.mode-origin-distinguo.origin-visible:hover,
  #grid .demo-overlay.mode-origin-distinguo.origin-visible:focus-visible,
  #lightbox #cr-badge.mode-origin-distinguo.delayed-visible:hover,
  #lightbox #cr-badge.mode-origin-distinguo.delayed-visible:focus-visible {
    opacity:1!important;
    filter:brightness(1.18) drop-shadow(0 0 5px var(--origin-foreground,#cfd6de)) drop-shadow(0 0 9px rgba(255,255,255,.22))!important;
  }
  #grid .demo-overlay.mode-origin-distinguo.origin-visible:hover svg,
  #grid .demo-overlay.mode-origin-distinguo.origin-visible:focus-visible svg,
  #lightbox #cr-badge.mode-origin-distinguo.delayed-visible:hover svg,
  #lightbox #cr-badge.mode-origin-distinguo.delayed-visible:focus-visible svg {
    animation:afpDistinguoHop .75s ease-in-out infinite!important;
  }
  #grid .demo-overlay.mode-origin-distinguo::before,
  #grid .demo-overlay.mode-origin-distinguo::after,
  #lightbox #cr-badge.mode-origin-distinguo::before,
  #lightbox #cr-badge.mode-origin-distinguo::after {display:none!important;}

  /* CR officiel : mode autonome, inchangé. */
  #grid .demo-overlay.mode-cr-official,
  #lightbox #cr-badge.mode-cr-official {
    display:flex!important;align-items:center!important;justify-content:center!important;
    width:34px!important;height:34px!important;
    padding:0!important;margin:0!important;
    background:transparent!important;border:0!important;border-radius:0!important;
    box-shadow:none!important;outline:0!important;
    top:8px!important;right:8px!important;bottom:auto!important;left:auto!important;
    color:#E4EAF2!important;opacity:.89!important;
  }
  #lightbox #cr-badge.mode-cr-official {top:10px!important;right:10px!important;}
  #grid .demo-overlay.mode-cr-official svg,
  #lightbox #cr-badge.mode-cr-official svg {
    display:block!important;width:31px!important;height:31px!important;
    fill:none!important;stroke:currentColor!important;stroke-width:1.85!important;
    stroke-linejoin:round!important;stroke-linecap:round!important;
  }
  #grid .demo-overlay.mode-cr-official::before,
  #grid .demo-overlay.mode-cr-official::after,
  #cr-badge.mode-cr-official::before,
  #cr-badge.mode-cr-official::after {display:none!important;}
  @media (prefers-reduced-motion:reduce) {
    #grid .demo-overlay.mode-origin-distinguo svg,
    #lightbox #cr-badge.mode-origin-distinguo svg {animation:none!important;}
  }
`;
document.head.append(originBadgeStyle);

function originStatusLevel(state) {
  return ['ok','warn','bad','error','none','loading','neutral'].includes(state) ? state : 'neutral';
}
/* Unique source de vérité pour les pictogrammes ET le panneau.
   On lit l'action C2PA du MANIFESTE ACTIF et pas le nom de l'application,
   le fichier EXIF ni les ingrédients historiques. */
function c2paActiveManifest(photo) {
  if (photo?.active && typeof photo.active === 'object') return photo.active;
  const store = photo?.store ?? {};
  const key = store.active_manifest ?? store.activeManifest;
  const m = store.manifests;
  if (m && key && typeof m === 'object') {
    return Array.isArray(m) ? m.find(x => [x?.label, x?.id].includes(key)) ?? null : m[key] ?? null;
  }
  return null;
}
function c2paSourceDetails(photo) {
  const manifest = c2paActiveManifest(photo);
  const results = [];
  if (!manifest) return { kind: 'unknown', raw: null, action: null, hasField: false };

  function asObject(v) {
    if (typeof v === 'string' && /^\s*[\[{]/.test(v)) {
      try { return JSON.parse(v); } catch (_) { return null; }
    }
    return v;
  }
  function collect(v, actionName = null, depth = 0) {
    v = asObject(v);
    if (!v || depth > 8) return;
    if (Array.isArray(v)) { v.forEach(x => collect(x, actionName, depth + 1)); return; }
    if (typeof v !== 'object') return;
    const action = typeof v.action === 'string' ? v.action : actionName;
    const source = v.digitalSourceType ?? v.digital_source_type ?? v['digital-source-type'];
    if (typeof source === 'string' && source.trim()) {
      results.push({ uri: source.trim(), action: action ?? null });
    }
    // Ces champs forment le conteneur de l'assertion actions ; ne pas suivre
    // 'ingredients', 'thumbnail' ou tout autre manifeste d'ingredient.
    for (const key of ['actions', 'data', 'value', 'payload']) {
      if (v[key] != null) collect(v[key], action, depth + 1);
    }
  }
  // Assertions de type c2pa.actions, qu'elles soient v1 ou v2.
  const assertions = Array.isArray(manifest.assertions)
    ? manifest.assertions
    : Object.entries(manifest.assertions ?? {}).map(([label, data]) => ({ label, data }));
  for (const assertion of assertions) {
    if (/^c2pa\.actions(?:\.v\d+)?(?:__\d+)?$/i.test(String(assertion?.label ?? assertion?.type ?? ''))) {
      collect(assertion?.data ?? assertion?.value ?? assertion);
    }
  }
  // Certains SDK exposent l'assertion directement sur le manifeste actif.
  if (results.length === 0) collect(manifest.actions);

  // Les URIs officielles ne sont pas créées par notre interface.
  const found = [...new Map(results.map(r => [r.uri + '\u0000' + (r.action ?? ''), r])).values()];
  const names = found.map(r => r.uri.split(/[\/#]/).pop().toLowerCase());
  const any = (...values) => names.some(name => values.includes(name));
  let kind = 'unknown';
  // Les composites explicites ont priorité sur les captures ou générations.
  if (any('compositewithtrainedalgorithmicmedia', 'compositesynthetic',
          'compositecapture', 'composite', 'virtualrecording') ||
      (any('trainedalgorithmicmedia') && any('digitalcapture', 'computationalcapture'))) {
    kind = 'composite';
  } else if (any('trainedalgorithmicmedia')) {
    kind = 'ai';
  } else if (any('digitalcapture','computationalcapture')) {
    kind = 'capture';
  }
  return {
    kind,
    raw: found.length ? found.map(r => r.uri).join(' ; ') : null,
    action: found.length ? [...new Set(found.map(r => r.action).filter(Boolean))].join(' ; ') || null : null,
    hasField: found.length > 0
  };
}
function detectDeclaredOrigin(photo) {
  return c2paSourceDetails(photo).kind;
}
function originTitle(origin) {
  if (origin === 'capture') return tr('Prise du réel déclarée');
  if (origin === 'ai') return tr('Image générée par IA déclarée');
  if (origin === 'composite') return tr('Image composée déclarée');
  return tr('Origine non précisée');
}

/* La teinte du dessin représente le statut C2PA, PAS l'origine.
   Ne jamais déduire la couleur de 'unknown' : un '?' peut être orange ou rouge. */
const DISTINGUO_COLORS = Object.freeze({
  ok: '#35C979',
  warn: '#F6A928',
  bad: '#F16B6B',
  error: '#F16B6B',
  none: '#C7D0DA',
  neutral: '#C7D0DA',
  loading: '#C7D0DA'
});
function appendOriginBadge(target, photo, state) {
  const origin = detectDeclaredOrigin(photo) || 'unknown';
  const level = originStatusLevel(state);
  const color = DISTINGUO_COLORS[level] || '#FFFFFF';
  target.style.setProperty('--origin-foreground', color);
  target.dataset.originStatus = level;
  target.dataset.originKind = origin;
  target.title = originTitle(origin);
  target.setAttribute('aria-label', originTitle(origin) + ' — ' + (level === 'warn' ? tr('À vérifier') : level === 'bad' ? tr('Échec') : level === 'ok' ? tr('Validé') : tr('Indéterminé')));
  target.classList.add(level, 'origin-' + origin);

  // Dessins optiquement équilibrés sur un cadre SVG 24 × 24 : appareil, AI, calques, ?.
  // Un seul trait coloré fin + très fin contour sombre pour les fonds blancs / noirs.
  let iconPaths;
  if (origin === 'capture') {
    iconPaths = '<path d="M5.4 8.1h2.4l1.6-2.2h5.2l1.6 2.2h2.4a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5.4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Z"/><circle cx="12" cy="13.35" r="3.15"/><path d="M17.9 11.2h.02"/>';
  } else if (origin === 'ai') {
    iconPaths = '<path d="M3.5 18.6 8.4 5.4l4.9 13.2 M5.2 14h6.35"/><path d="M17 5.4h4.1 M19.05 5.4v13.2 M17 18.6h4.1"/>';
  } else if (origin === 'composite') {
    iconPaths = '<path d="M12 4.5 20.8 9.1 12 13.7 3.2 9.1Z"/><path d="m3.2 12.35 8.8 4.55 8.8-4.55"/><path d="m3.2 15.7 8.8 4.5 8.8-4.5"/>';
  } else {
    iconPaths = '<path d="M7.3 9a4.75 4.75 0 1 1 7.85 3.6C13.2 14 12 14.9 12 16.2"/><path d="M12 19.25v.12"/>';
  }
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('class', `origin-icon origin-icon--${origin}`);
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable','false');
  svg.style.setProperty('--origin-foreground',color);
  svg.innerHTML = `<g class="origin-halo">${iconPaths}</g><g class="origin-ink">${iconPaths}</g>`;
  // Protection contre les anciennes déclarations CSS pouvant imposer le gris.
  svg.querySelector('.origin-ink').style.setProperty('stroke', color, 'important');
  target.append(svg);

  // Miniatures : apparition après 2 s, sans redémarrer le timer à chaque analyse.
  if (target.id !== 'cr-badge') {
    const now = performance.now();
    if (!target._originRevealDeadline) target._originRevealDeadline = now + 2000;
    clearTimeout(target._originRevealTimer);
    if (now >= target._originRevealDeadline) target.classList.add('origin-visible');
    else target._originRevealTimer = setTimeout(() => {
      if (target.isConnected && target.classList.contains('mode-origin-distinguo')) {
        target.classList.add('origin-visible');
      }
    }, Math.max(0, target._originRevealDeadline - now));
  }
}

function appendOfficialCr(target) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns,'svg');
  svg.setAttribute('viewBox','0 0 24 24');
  svg.setAttribute('aria-hidden','true');
  // CR filaire, sans rectangle, fond ni pastille circulaire supplémentaire.
  // Le C dessine un contour ouvert autour du R, proche de l'esprit du pictogramme CR.
  svg.innerHTML = '<path d="M18.6 6.2a8.9 8.9 0 1 0 0 11.6"/><path d="M9 8.5v7 M9 8.5h3.3a2.1 2.1 0 0 1 0 4.2H9 M11.4 12.7l2.6 2.8"/>';
  target.append(svg);
  target.title = 'Content Credentials (CR)';
}
// Affichage initial : Distinguo ; l'utilisateur peut ensuite choisir un autre mode.
let selectedMode = 'origin-distinguo';
modeSelect.value = selectedMode;
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
function addBadgeContent(target, mode, state, photo = null) {
  if (mode !== 'origin-distinguo') {
    clearTimeout(target._originRevealTimer);
    target._originRevealDeadline = null;
  }
  target.dataset.c2paStatus = state;
  target.replaceChildren();
  target.classList.add('mode-' + mode, originStatusLevel(state), 'state-' + originStatusLevel(state));
  if (mode === 'direct') return;
  if (mode === 'origin-distinguo') {
    appendOriginBadge(target, photo, state);
  } else if (mode === 'cr-official') {
    appendOfficialCr(target);
  } else if (mode === 'info') {
    const el=document.createElement('span'); el.className='info-symbol';
    el.textContent='i'; target.append(el);
  } else if (mode === 'afp') {
    const logo=document.createElement('img'); logo.src='./afp-gelule.png';
    logo.alt='AFP'; logo.className='afp-tab-art'; target.append(logo);
    target.classList.add('afp-tab');
  } else if (mode === 'banner') {
    const el=document.createElement('span'); el.className='banner-label';
    el.textContent=tr('Voir la provenance'); target.append(el);
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
    badge.textContent=tr('◈  Provenance');target.append(badge);
    target.classList.add('delayed-pending');
  } else if (mode === 'tap') {
    // Aucun indicateur visible au repos ; la photo elle-même est interactive.
  } else if (mode === 'caption') {
    const label=document.createElement('span');label.className='caption-marker';
    label.textContent=tr('Source sous la photo ↓');target.append(label);
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
  if (!['corner','glow','seal','drawer','shield','shield-delayed','origin-distinguo','cr-official','delayed','tap','caption'].includes(mode)) {
    const dot=document.createElement('span'); dot.className='dot '+state;
    dot.setAttribute('aria-hidden','true'); target.append(dot);
  }
  target.setAttribute('aria-label', mode === 'corner' ? tr('Soulever le coin pour voir la provenance C2PA') : mode === 'glow' ? tr('Ouvrir la provenance C2PA depuis le coin lumineux') : mode === 'seal' ? tr('Ouvrir la provenance C2PA depuis le sceau') : tr('Voir la provenance C2PA'));
}
function sourceLabel(photo) {
  const a=photo.active||{};
  const sig=a.signature_info||a.signatureInfo||{};
  const signer=sig.issuer||sig.signer||sig.organization||a.claim_generator||a.claimGenerator;
  return signer ? String(signer).slice(0,90) : tr('Source non renseignée');
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
  x.fillText(tr('Source : ') + sourceLabel(photo).slice(0, 40), 776 * s, 268 * s);
  const lvl = photo.state === 'ok' ? ['#9be6b1', '#12683b']
    : (photo.state === 'bad' || photo.state === 'error') ? ['#ffb0b0', '#4b2325']
    : ['#ffcf77', '#4a3410'];
  x.fillStyle = lvl[0]; x.beginPath(); x.roundRect(776 * s, 300 * s, 210 * s, 44 * s, 22 * s); x.fill();
  x.fillStyle = lvl[1]; x.font = `700 ${24 * s}px system-ui,sans-serif`;
  x.fillText((statusLabel(photo.state) || tr('Provenance')).slice(0, 20), 792 * s, 330 * s);
  return c;
}
function updateCaption(card,photo) {
  const el=card.querySelector('.caption-source');if(!el)return;
  el.hidden=true;
  el.textContent=tr('Source : ')+sourceLabel(photo)+'  ›';
}
let delayedTimer=0;
let delayedRevealReady=false;
function scheduleDelayedBadge(mode) {
  clearTimeout(delayedTimer);
  delayedRevealReady=false;
  crBadge.classList.remove('delayed-visible');
  if(mode==='delayed' || mode==='shield-delayed' || mode==='origin-distinguo') delayedTimer=setTimeout(()=>{
    if(lightbox.open && currentIdx>=0 && ['delayed','shield-delayed','origin-distinguo'].includes(presentationFor(photos[currentIdx]))) {
      delayedRevealReady=true;
      crBadge.classList.add('delayed-visible');
    }
  },2000);
}
function redrawPresentations() {
  photos.forEach(photo => {
    const card=grid.querySelector(`[data-idx="${photo.idx}"]`);
    const overlay=card?.querySelector('.demo-overlay');
    if(overlay){overlay.className='demo-overlay';addBadgeContent(overlay,presentationFor(photo),photo.state,photo);}
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
  img.addEventListener('error', () => {
    card.classList.add('photo-unavailable');
    img.alt = tr('Image inaccessible : vérifier le fichier dans PHOTOS/');
    console.warn('[C2PA AFP] Photo inaccessible ou illisible :', photo.url);
  });
  const tag = document.createElement('span');
  tag.className = `tag ${photo.state}`;
  tag.tabIndex = 0;
  tag.title = tr(C2PA_STATUS_TIPS[photo.state] || C2PA_STATUS_TIPS.neutral);
  tag.append(Object.assign(document.createElement('span'), { className: 'dot' }),
             document.createTextNode(statusLabel(photo.state)));
  const name = document.createElement('figcaption');
  name.className = 'name';
  name.textContent = photo.name.split('/').pop();
  const overlay = document.createElement('button');
  overlay.type='button'; overlay.className='demo-overlay';
  overlay.setAttribute('aria-label',tr('Voir les informations C2PA'));
  addBadgeContent(overlay,presentationFor(photo),photo.state,photo);
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
  tag.title = tr(C2PA_STATUS_TIPS[photo.state] || C2PA_STATUS_TIPS.neutral);
  tag.textContent = '';
  tag.append(Object.assign(document.createElement('span'), { className: 'dot' }),
             document.createTextNode(statusLabel(photo.state)));
  const overlay = card.querySelector('.demo-overlay');
  if (overlay) { overlay.className='demo-overlay'; addBadgeContent(overlay,presentationFor(photo),photo.state,photo); }
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
  countEl.textContent = uiLanguage === 'en' ? `${photos.length} photos · ${n('ok')} verified · ${n('warn')} need review · ${n('bad')} failed · ${n('none')} without C2PA · ${n('error')} read errors` : `${photos.length} photo(s) · ${n('ok')} vérifiée(s) · ${n('warn')} à vérifier · ${n('bad')} échec(s) · ${n('none')} sans C2PA · ${n('error')} erreur(s) de lecture`;
}

function rebuildGrid() {
  grid.replaceChildren(...photos.map(cardEl));
  photos.forEach(renderCard);
  updateCount();
}

/* ---------- Lightbox plein écran ---------- */
function setStatusLine(cls, text, semanticStatus = cls) {
  lbStatus.className = `status ${cls}`;
  lbStatus.dataset.c2paStatus = semanticStatus;
  lbStatus.title = tr(C2PA_STATUS_TIPS[semanticStatus] || C2PA_STATUS_TIPS.neutral);
  lbStatus.textContent = tr(text);
}

/* Métadonnées présentées sans inventer de valeurs absentes. */
function firstValue(...values) { return values.find(v => v !== undefined && v !== null && v !== '') ?? null; }
function readable(value) {
  if (value == null) return tr('Non renseigné');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
// Aide courte : repliée par défaut pour préserver la place sur mobile.
const C2PA_FIELD_HELP = {
  'Intégrité du fichier': 'Vérifie que le fichier correspond aux données protégées par le manifeste C2PA.',
  'Signature numérique': 'Vérifie que les informations de provenance n’ont pas été modifiées après leur signature.',
  'Signataire déclaré': 'Organisme ou entreprise identifié dans le certificat ayant signé la provenance.',
  'Générateur': 'Appareil ou logiciel ayant créé les informations C2PA.',
  'Catégorie affichée': 'Interprétation simplifiée de digitalSourceType par cette galerie. Ce n’est pas un verdict sur la vérité de la scène.',
  'digitalSourceType (IPTC)': 'Champ standard de la spécification C2PA, dont la valeur est un identifiant officiel IPTC. Une valeur absente ne prouve rien sur la génération IA.',
  'Action C2PA': 'Action (par exemple c2pa.created) portant le digitalSourceType dans le manifeste actif.',
  'Auteur / photographe': 'Personne déclarée comme auteur de la photo ; cette identité n’est pas forcément vérifiée.',
  'Horodatage certifié (TSA)': 'Date attestée par un tiers indépendant : la signature existait au plus tard à cet instant.',
  'Date de prise de vue (EXIF)': 'Date enregistrée par l’horloge de l’appareil, modifiable et non certifiée à elle seule.'
};
// Les aides sont intégrées dans la ligne (et non en superposition) :
// pas de débordement dans le panneau latéral ni sur téléphone.
const c2paHelpStyle = document.createElement('style');
c2paHelpStyle.textContent = `
  .credential-row .field-label{min-width:0;display:flex;flex-wrap:nowrap;align-items:center;gap:7px;line-height:1.35;overflow-wrap:anywhere}
  .credential-row .field-label > span{min-width:0;flex:1 1 auto;overflow-wrap:anywhere}
  .credential-row .field-value{min-width:0;overflow-wrap:anywhere}
  .credential-row .c2pa-help-trigger{
    display:inline-grid;place-items:center;flex:0 0 17px;
    width:17px;height:17px;min-width:17px;max-width:17px;
    margin:0;padding:0;box-sizing:border-box;
    border:1px solid #8197ad;border-radius:50%;background:transparent;
    color:inherit;font:700 11px/1 Arial,sans-serif;cursor:pointer;
    vertical-align:middle;opacity:.9;box-shadow:none;
  }
  .credential-row .c2pa-help-trigger:hover,
  .credential-row .c2pa-help-trigger:focus-visible,
  .credential-row .c2pa-help-trigger[aria-expanded="true"]{
    background:#446887;border-color:#7299bc;color:#fff;outline-offset:2px;opacity:1;
  }
  .credential-row .c2pa-help-copy{
    grid-column:1 / -1;min-width:0;
    margin:3px 0 0;padding:9px 11px;
    background:#293b4d;color:#f0f5ff;border-radius:7px;
    font-size:12px;font-weight:400;line-height:1.5;
    overflow-wrap:anywhere;white-space:normal;
  }
  .credential-row .c2pa-help-copy[hidden]{display:none!important}
  .c2pa-warning-explainer{
    border:1px solid #dba84b;border-left:3px solid #e5a12f;
    border-radius:9px;margin:0 0 16px;padding:11px 12px;
    background:#fff6e8;color:#714b10;font-size:12px;line-height:1.5;
    overflow-wrap:anywhere;
  }
  .c2pa-warning-explainer strong{display:block;font-size:12.5px;margin:0 0 4px}
  .c2pa-warning-explainer p{margin:0;font-size:12px;line-height:1.5}
  #side-panel .c2pa-warning-explainer{
    background:#352b1a;color:#ffe1aa;border-color:#71521c;border-left-color:#f2ae36;
  }
  .bottom-sheet .c2pa-warning-explainer{background:#fff6e8;color:#714b10}
  #side-panel .credential-row{
    grid-template-columns:22px minmax(0,38%) minmax(0,1fr);
    gap:5px 8px;align-items:start;padding:11px 10px;min-width:0;
  }
  #side-panel .credential-row .signal{margin-top:1px}
  #side-panel .credential-row .field-label{min-width:0}
  #side-panel .credential-row .field-value{min-width:0;line-height:1.4}
  #side-panel .credential-row .c2pa-help-copy{display:block;position:static}
  .bottom-sheet .credential-row .c2pa-help-copy,
  dialog#credentials .credential-row .c2pa-help-copy{
    background:#eef4fa;color:#233a52;border:1px solid #dce7f1;
  }
  @media(max-width:480px){
    #side-panel .credential-row,
    .bottom-sheet .credential-row{
      grid-template-columns:22px minmax(0,1fr);gap:3px 9px;
    }
    #side-panel .credential-row > .signal,
    .bottom-sheet .credential-row > .signal{grid-column:1;grid-row:1 / span 2}
    #side-panel .credential-row > .field-label,
    .bottom-sheet .credential-row > .field-label{grid-column:2;grid-row:1}
    #side-panel .credential-row > .field-value,
    .bottom-sheet .credential-row > .field-value{grid-column:2;grid-row:2}
    #side-panel .credential-row > .c2pa-help-copy,
    .bottom-sheet .credential-row > .c2pa-help-copy{grid-column:1 / -1;grid-row:3}
    #side-panel .credential-row{padding:10px}
    dialog#credentials .credential-row > .c2pa-help-copy{grid-column:1 / -1}
  }
`;
document.head.append(c2paHelpStyle);

// Délégation du clic : fonctionne aussi dans les copies du panneau et du volet.
document.addEventListener('click', event => {
  const trigger = event.target.closest?.('.c2pa-help-trigger');
  if (!trigger) return;
  event.preventDefault();
  event.stopPropagation();
  const row = trigger.closest('.credential-row');
  const copy = row?.querySelector('.c2pa-help-copy');
  if (!copy) return;
  copy.hidden = !copy.hidden;
  trigger.setAttribute('aria-expanded', String(!copy.hidden));
});

/* Légende des indicateurs de couleur : souris, clavier et toucher.
   Une unique bulle flottante, hors des cellules (sinon elles se chevauchent).
   Popover natif : la bulle reste visible au-dessus des panneaux et dialogs. */
const C2PA_STATUS_TIPS = {
  neutral: 'Gris : résultat non confirmé, donnée déclarative ou information absente. Ce n’est pas une preuve de falsification.',
  ok: 'Vert : information renseignée ou contrôle C2PA réussi selon le champ. Cela ne prouve pas que la scène est vraie.',
  warn: 'Orange : une vérification reste incomplète ou le certificat du signataire n’est pas reconnu comme fiable. Cela ne signifie pas que l’image est fausse.',
  bad: 'Rouge : un contrôle C2PA a échoué (par exemple une incohérence de signature ou d’intégrité). Examiner le détail avant de conclure.',
  error: 'Rouge : le lecteur n’a pas pu analyser le fichier. Ce n’est pas une preuve que la photo a été modifiée.',
  none: 'Gris : aucun manifeste C2PA intégré détecté dans cette photo. La photo peut néanmoins être affichée.',
  loading: 'Bleu : la vérification de la provenance est encore en cours.'
};
const colorHelp = document.createElement('div');
colorHelp.className = 'c2pa-color-help';
colorHelp.id = 'c2pa-color-help';
colorHelp.setAttribute('role', 'tooltip');
colorHelp.setAttribute('popover', 'manual');
colorHelp.hidden = true;
document.body.append(colorHelp);
const colorHelpStyle = document.createElement('style');
colorHelpStyle.textContent = `
  .c2pa-color-help,
  .c2pa-color-help:popover-open{
    position:fixed;display:block;box-sizing:border-box;width:max-content;max-width:min(335px,calc(100vw - 24px));
    margin:0;padding:11px 13px;border:1px solid #54657c;border-radius:11px;
    background:#233348;color:#fff;box-shadow:0 10px 26px #0008;
    font:500 13px/1.45 system-ui,-apple-system,'Segoe UI',sans-serif;
    z-index:2147483647;pointer-events:none;white-space:normal;overflow-wrap:anywhere;
  }
  .c2pa-color-help[hidden]{display:none!important}
  .credential-row .signal,.validation-item .signal,.tag,.demo-overlay .dot,.cr .dot{cursor:help}
  .photo-unavailable img{min-height:90px;object-fit:contain}
`;
document.head.append(colorHelpStyle);
let colorHelpTarget = null;
function colorKey(el) {
  if (!el) return null;
  if (C2PA_STATUS_TIPS[el.dataset?.c2paStatus]) return el.dataset.c2paStatus;
  const classes = el.classList;
  for (const key of ['error','bad','warn','ok','none','neutral','loading']) if (classes.contains(key)) return key;
  return null;
}
function colorTarget(node) {
  if (!(node instanceof Element)) return null;
  return node.closest('.credential-row > .signal, .validation-item > .signal, #grid .tag, #grid .demo-overlay, #cr-badge, #side-status, #lb-status, #bottom-status, #credentials .status');
}
function showColorHelp(target) {
  if (!target) return;
  const cls = colorKey(target) || colorKey(target.querySelector('.dot'));
  if (!cls || !C2PA_STATUS_TIPS[cls]) return;
  colorHelpTarget = target;
  colorHelp.textContent = tr(C2PA_STATUS_TIPS[cls]);
  colorHelp.hidden = false;
  try { if (typeof colorHelp.showPopover === 'function' && !colorHelp.matches(':popover-open')) colorHelp.showPopover(); } catch (_) {}
  // Clamp the explanation to the visible viewport.
  const rect = target.getBoundingClientRect();
  const vw = Math.min(window.innerWidth, window.visualViewport?.width || Infinity, document.documentElement.clientWidth || Infinity);
  const vh = Math.min(window.innerHeight, window.visualViewport?.height || Infinity);
  const width = Math.min(335, Math.max(160, vw - 24));
  const left = Math.max(12, Math.min(vw - width - 12, rect.left));
  colorHelp.style.width = width + 'px';
  colorHelp.style.left = left + 'px';
  const bubbleHeight = colorHelp.getBoundingClientRect().height || 85;
  const below = rect.bottom + 9;
  colorHelp.style.top = (below + bubbleHeight <= vh - 8 ? below : Math.max(8, rect.top - bubbleHeight - 9)) + 'px';
}
function hideColorHelp() {
  colorHelpTarget = null;
  try { if (typeof colorHelp.hidePopover === 'function' && colorHelp.matches(':popover-open')) colorHelp.hidePopover(); } catch (_) {}
  colorHelp.hidden = true;
}
document.addEventListener('pointerover', e => {
  if (e.pointerType === 'touch') return;
  const target = colorTarget(e.target);
  if (target && target !== colorHelpTarget) showColorHelp(target);
});
document.addEventListener('pointerout', e => {
  if (e.pointerType === 'touch') return;
  if (colorHelpTarget && !colorHelpTarget.contains(e.relatedTarget)) hideColorHelp();
});
document.addEventListener('focusin', e => { const target = colorTarget(e.target); if (target) showColorHelp(target); });
document.addEventListener('focusout', e => { if (colorHelpTarget?.contains(e.target)) hideColorHelp(); });
document.addEventListener('click', e => {
  const target = colorTarget(e.target);
  if (!target) { hideColorHelp(); return; }
  if (matchMedia('(hover: none)').matches && (target.classList.contains('signal') || target.classList.contains('tag'))) {
    e.stopPropagation(); e.preventDefault();
    if (colorHelpTarget === target) hideColorHelp(); else showColorHelp(target);
  }
}, true);
document.addEventListener('keydown', e => { if (e.key === 'Escape') hideColorHelp(); });
// Tooltip reste affichée jusqu'au prochain contact / clic / fermeture.
window.addEventListener('resize', hideColorHelp);
function field(label, value, level = 'ok', help = '') {
  const row = document.createElement('div'); row.className = 'credential-row';
  const marker = document.createElement('span'); marker.className = `signal ${level}`;
  marker.textContent = level === 'ok' ? '✓' : level === 'warn' ? '!' : level === 'bad' ? '×' : 'i';
  marker.setAttribute('aria-label', tr(level === 'ok' ? 'Information présente' : level === 'warn' ? 'À vérifier' : level === 'bad' ? 'Problème détecté' : 'Information indisponible'));
  marker.tabIndex = 0;
  marker.setAttribute('aria-describedby', 'c2pa-color-help');
  marker.title = tr(C2PA_STATUS_TIPS[level] || C2PA_STATUS_TIPS.neutral);
  const name = document.createElement('div'); name.className = 'field-label';
  const labelText = document.createElement('span'); labelText.textContent = tr(label);
  name.append(labelText);
  const detail = document.createElement('div'); detail.className = 'field-value'; detail.textContent = readable(value);
  if (help) { const note = document.createElement('small'); note.textContent = help; detail.append(note); }
  row.append(marker, name, detail);
  if (C2PA_FIELD_HELP[label]) {
    const trigger = document.createElement('button'); trigger.type = 'button';
    trigger.className = 'c2pa-help-trigger'; trigger.textContent = 'i';
    trigger.setAttribute('aria-label', (uiLanguage === 'en' ? 'Explanation: ' : 'Explication : ') + tr(label));
    trigger.setAttribute('aria-expanded', 'false');
    trigger.title = uiLanguage === 'en' ? 'What does “' + tr(label) + '” mean?' : 'Que signifie « ' + label + ' » ?';
    name.append(trigger);
    const copy = document.createElement('div'); copy.className = 'c2pa-help-copy';
    copy.textContent = tr(C2PA_FIELD_HELP[label]); copy.hidden = true;
    row.append(copy);
  }
  return row;
}
function section(title, rows) {
  const block = document.createElement('section'); block.className = 'credential-section';
  const heading = document.createElement('h3'); heading.textContent = tr(title);
  const dl = document.createElement('div'); dl.className = 'credential-fields';
  dl.append(...rows); block.append(heading, dl); return block;
}
function present(value) { return value === null || value === undefined || value === '' ? 'neutral' : 'ok'; }
function validationLevel(v) {
  const code = String(typeof v === 'string' ? v : v?.code ?? v?.status ?? '').toLowerCase();
  if (/mismatch|invalid|tamper|failure|error|revoked/.test(code)) return 'bad';
  if (/expired|untrusted|unknown|unsupported|warning|not.?trusted/.test(code)) return 'warn';
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
  captionBtn.textContent=tr('Source : ')+sourceLabel(photo)+'  ›';
  closeBottomSheet();
  hideTapReveal();
  crBadge.className=`cr ${photo.state}`;
  addBadgeContent(crBadge,mode,photo.state,photo);
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
  setStatusLine(photo.state === 'loading' ? 'loading' : photo.state, tr('Chargement des informations…'));
  lbSummary.replaceChildren();
  lbJson.textContent = tr('Chargement…');
  // Si le panneau était ouvert sur la photo précédente, on le ferme.
  if (credentials.open) credentials.close();
  if (!lightbox.open) lightbox.showModal();
  requestAnimationFrame(syncLargeCaptionWidth);
  analyze(photo).then(() => {
    if (currentIdx >= 0 && photos[currentIdx] === photo) {
      crBadge.className = `cr ${photo.state}`;
      addBadgeContent(crBadge,presentationFor(photo),photo.state,photo);
      if(['delayed','shield-delayed','origin-distinguo'].includes(presentationFor(photo)) && delayedRevealReady) crBadge.classList.add('delayed-visible');
      if (!bottomSheet.hidden && bottomPhoto === photo) refreshBottomSheet(photo);
      if (!sidePanel.hidden) refreshSidePanel(photo);
      if (credentials.open) fillDetails(photo); // rafraîchir le panneau déjà ouvert
      renderCard(photo);
      if (presentationFor(photo)==='caption') {
        document.querySelector('#lb-caption-source').textContent=tr('Source : ')+sourceLabel(photo)+'  ›';
        syncLargeCaptionWidth();
      }
      updateCount();
    }
  });
}

/* Même classification / même valeur IPTC pour le badge et la fiche.
   "Inconnue" est NOTRE catégorie, et jamais un digitalSourceType inventé. */
function originPanelSection(photo) {
  const detail = c2paSourceDetails(photo);
  const categories = { capture: 'Photo capturée', ai: 'Image générée par IA',
                       composite: 'Image composée', unknown: 'Origine inconnue' };
  const pending = photo.state === 'loading';
  const missing = photo.state === 'none';
  const error = photo.state === 'error';
  const explanatory = detail.hasField
    ? 'La catégorie résume le champ digitalSourceType déclaré dans le manifeste actif. Elle ne prouve pas la véracité de la scène.'
    : 'Aucune valeur digitalSourceType utilisable : « inconnue » est une classification de cette interface, pas une valeur officielle C2PA.';
  const raw = pending ? tr('Analyse en cours') : missing ? tr('Sans manifeste C2PA intégré')
    : error ? tr('Lecture C2PA indisponible') : detail.raw ?? tr('Non renseigné dans le manifeste');
  const rows = [
    field('Catégorie affichée', tr(pending ? 'Analyse en cours' : categories[detail.kind]), 'neutral', tr(explanatory)),
    field('digitalSourceType (IPTC)', raw, 'neutral'),
    field('Action C2PA', detail.action ?? (pending ? tr('Analyse en cours') : tr('Non renseigné')), 'neutral')
  ];
  return section('Origine du contenu (C2PA)', rows);
}

/* ---------- Panneau Content Credentials (bouton logo AFP) ---------- */
function fillDetails(photo) {
  if (photo.state === 'loading') {
    setStatusLine('loading', tr('Vérification C2PA en cours…'));
    lbSummary.replaceChildren(originPanelSection(photo));
    lbJson.textContent = tr('Chargement…');
    return;
  }
  if (photo.state === 'error') {
    setStatusLine('error', (uiLanguage === 'en' ? 'C2PA analysis unavailable: ' : 'Analyse C2PA indisponible : ') + photo.error);
    lbSummary.replaceChildren(originPanelSection(photo), section('Informations sur la photo', [
      field('Auteur / photographe', photo.exif?.artist || photo.exif?.copyright || null, 'neutral'),
      field('Date de prise de vue (EXIF)', photo.exifDate || null, 'neutral')
    ]));
    lbJson.textContent = photo.error;
    return;
  }
  if (photo.state === 'none') {
    setStatusLine('none', 'Aucun manifeste C2PA intégré détecté.');
    lbSummary.replaceChildren(originPanelSection(photo), section('Informations sur la photo', [
      field('Auteur / photographe', photo.exif?.artist || photo.exif?.copyright || null, 'neutral'),
      field('Date de prise de vue (EXIF)', photo.exifDate || tr('Non disponible'), 'neutral')
    ]));
    lbJson.textContent = tr('Aucun manifeste trouvé.');
    return;
  }
  const entries = photo.validation ?? [];
  const levels = entries.map(validationLevel);
  if (levels.includes('bad')) setStatusLine('error', 'Manifeste présent, mais une ou plusieurs vérifications ont échoué.', 'bad');
  else if (levels.includes('warn')) setStatusLine('warn', 'Manifeste présent, mais la confiance du signataire nécessite une vérification.');
  else if (!entries.length || levels.includes('neutral')) setStatusLine('warn', 'Manifeste présent, mais la validation complète ne peut pas être confirmée.');
  else setStatusLine('ok', 'Contrôles C2PA retournés sans problème signalé. Cela ne prouve pas la véracité de la scène.');
  const codesForWarning = entries.map(v => String(typeof v === 'string' ? v : v?.code ?? v?.status ?? '').toLowerCase());
  const hasUntrustedSignerWarning = codesForWarning.some(c => /signingcredential\.(untrusted|unknown)|signer\.untrusted/.test(c));
  const warningNotice = document.createElement('div');
  warningNotice.className = 'c2pa-warning-explainer';
  warningNotice.setAttribute('role', 'note');
  const warningTitle = document.createElement('strong');
  warningTitle.textContent = tr('Pourquoi ces indicateurs orange ?');
  const warningBody = document.createElement('p');
  warningBody.textContent = tr(hasUntrustedSignerWarning
    ? 'Le certificat du signataire n’est pas reconnu comme fiable : son identité reste à confirmer. Cela ne signifie pas que la photo est fausse ou modifiée.'
    : 'Certaines vérifications n’ont pas pu être confirmées par cet outil. Les informations restent à examiner : un indicateur orange ne prouve pas que la photo a été falsifiée.');
  warningNotice.append(warningTitle, warningBody);
  const a = photo.active ?? {};
  const sig = signatureOf(a);
  const generator = firstValue(a.claim_generator, a.claimGenerator, a.claim_generator_info?.[0]?.name, a.claimGeneratorInfo?.[0]?.name);
  const signer = firstValue(sig.name, sig.issuer, sig.organization, a.signer);
  const manifest = firstValue(photo.store?.active_manifest, photo.store?.activeManifest);
  const signerLevel = present(signer);
  // Ne pas déduire une intégrité valide de la seule présence d'un manifeste.
  const codes = entries.map(v => String(typeof v === 'string' ? v : v?.code ?? v?.status ?? '').toLowerCase());
  const hasIntegrityFailure = codes.some(c => /assertion\.datahash\.mismatch|assertion\.bmffhash\.mismatch|assertion\.hasheduri\.mismatch|assertion\.boxhash\.mismatch|hash\.mismatch/.test(c));
  const hasSignatureFailure = codes.some(c => /claimsignature\.mismatch|claimsignature\.invalid|signature\.invalid/.test(c));
  const hasUntrustedSigner = codes.some(c => /signingcredential\.untrusted|signingcredential\.unknown/.test(c));
  // Un statut global positif sans détail ne prouve pas individuellement ces contrôles.
  const integrityStatus = tr(hasIntegrityFailure ? 'Échec' : 'Non confirmé séparément');
  const signatureStatus = tr(hasSignatureFailure ? 'Échec' : hasUntrustedSigner ? 'Confiance à vérifier' : 'Non confirmé séparément');
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
  const c2paAuthor = authorName(authorValue);
  const author = firstValue(c2paAuthor, photo.exif?.artist, photo.exif?.copyright);
  const authorSource = c2paAuthor ? 'C2PA' : photo.exif?.artist ? 'EXIF Artist' : photo.exif?.copyright ? tr('EXIF Copyright (crédit déclaré)') : null;

  const validationSection = document.createElement('section'); validationSection.className = 'credential-section';
  const vh = document.createElement('h3'); vh.textContent = tr('Résultats techniques de validation');
  const vl = document.createElement('div'); vl.className = 'validation-list';
  if (entries.length) entries.forEach(v => {
    const line = document.createElement('div'); line.className = 'validation-item';
    const level = validationLevel(v);
    const marker = document.createElement('span'); marker.className = `signal ${level}`;
    marker.textContent = level === 'ok' ? '✓' : level === 'warn' ? '!' : level === 'bad' ? '×' : 'i';
    marker.tabIndex = 0;
    marker.title = tr(C2PA_STATUS_TIPS[level] || C2PA_STATUS_TIPS.neutral);
    const code = document.createElement('span'); code.textContent = validationText(v);
    const label = document.createElement('span'); label.className = `validation-pill ${level}`;
    label.textContent = tr(level === 'ok' ? 'Validé' : level === 'warn' ? 'À vérifier' : level === 'bad' ? 'Échec' : 'Indéterminé');
    line.append(marker, code, label); vl.append(line);
  });
  else { const line = document.createElement('p'); line.textContent = tr('Aucun résultat détaillé retourné.'); vl.append(line); }
  validationSection.append(vh, vl);

  const extras = document.createElement('details');
  extras.className = 'credential-section';
  extras.style.cssText = 'border:1px solid #354252;border-radius:10px;padding:12px;margin-top:16px';
  const summary = document.createElement('summary');
  summary.textContent = tr('Informations complémentaires');
  summary.style.cssText = 'cursor:pointer;font-weight:700';
  extras.append(summary,
    section('Données du manifeste', [
      field('Identifiant du manifeste', manifest, 'neutral'),
      field('Actions déclarées', firstValue(a.actions, assertions.find(x => /actions/i.test(String(x?.label ?? '')))?.data?.actions), 'neutral'),
      field('Certificat / signataire déclaré', signer, signerLevel),
    ]), validationSection);

  lbSummary.replaceChildren(
    originPanelSection(photo),
    ...(!levels.includes('bad') && (levels.includes('warn') || !entries.length || levels.includes('neutral')) ? [warningNotice] : []),
    section('Vérification C2PA', [
      field('Intégrité du fichier', integrityStatus, integrityLevel),
      field('Signature numérique', signatureStatus, signatureLevel, hasUntrustedSignerWarning && signatureLevel === 'warn' ? tr('Certificat non reconnu comme fiable par ce vérificateur.') : ''),
      field('Signataire déclaré', signer, signerLevel, hasUntrustedSignerWarning && signerLevel === 'warn' ? tr('Nom déclaré, mais identité non confirmée par ce vérificateur.') : ''),
      field('Générateur', generator, present(generator)),
    ]),
    section('Informations sur la photo', [
      field('Auteur / photographe', author ? `${author}${authorSource ? ' — ' + authorSource : ''}` : null, 'neutral'),
      field('Horodatage certifié (TSA)', tr('Non vérifié'), 'neutral'),
      field('Date de prise de vue (EXIF)', photo.exifDate ?? tr('Non disponible'), 'neutral'),
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
  status.dataset.c2paStatus = lbStatus.dataset.c2paStatus;
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
  emptyTitle.dataset.dynamicEmpty = '1';
  emptyTitle.dataset.frText = title;
  emptyMsg.dataset.frText = msg;
  emptyTitle.textContent = tr(title);
  emptyMsg.textContent = tr(msg);
}

document.querySelector('#pick-photos').addEventListener('click', () => filePhotos.click());
document.querySelector('#pick-folder').addEventListener('click', () => fileFolder.click());
filePhotos.addEventListener('change', () => { if (addFiles(filePhotos.files)) emptyBox.hidden = true; filePhotos.value = ''; });
fileFolder.addEventListener('change', () => { if (addFiles(fileFolder.files)) emptyBox.hidden = true; fileFolder.value = ''; });

// Fusionner l'index et l'API, sans doublons, même en présence de noms encodés.
function addRemotePhotos(urls) {
  const known = new Set(photos.map(p => photoKey(p.url)));
  let added = 0;
  for (const raw of urls) {
    const url = photoUrl(raw);
    if (!url) continue;
    const key = photoKey(url);
    if (known.has(key)) continue;
    known.add(key);
    const name = safeDecode(url.replace(/^\.\//, ''));
    photos.push({ url, name, idx: photos.length, state: 'loading' });
    added++;
  }
  if (added) {
    emptyBox.hidden = true;
    rebuildGrid();
    scheduleAnalysis();
  }
  return added;
}

async function start() {
  const { state, urls } = await probeIndex();
  if (state === 'ok') {
    // Afficher immédiatement ce qui est indexé ; l'API complètera ensuite
    // les PNG (ou autres photos) absents d'un ancien photos.json.
    addRemotePhotos(urls);
    githubApiList().then(extra => addRemotePhotos(extra)).catch(error => console.warn('Complément GitHub', error));
    return;
  }
  // Fichier photos.json absent ou vide : lire le dossier PHOTOS/ dans GitHub.
  const apiUrls = await githubApiList();
  if (addRemotePhotos(apiUrls)) return;
  if (state === 'missing') {
    setEmpty('Aucun index photo trouvé',
      'Le fichier photos.json est introuvable ou inaccessible. Si vous avez ouvert index.html en local '
      + '(double-clic), les photos listées par GitHub ne sont pas visibles : utilisez les boutons ci-dessous '
      + 'ou glissez vos photos sur la page. Sur GitHub Pages, vérifiez que photos.json est bien présent à la racine du site.');
    return;
  }
  setEmpty('Aucune photo indexée',
    'photos.json contient une liste vide et le dossier PHOTOS/ n\'a pas pu être lu via GitHub. Vérifiez que les fichiers JPG/PNG sont présents dans PHOTOS/ sur GitHub, puis relancez le workflow « Galerie C2PA » dans Actions. Vous pouvez aussi importer vos photos avec les boutons ci-dessous.');
}

installLanguageSwitch();
setEmpty('Recherche des photos…', 'Vérification de photos.json et du dossier PHOTOS/…');
start().catch(error => {
  console.error('[C2PA AFP] Initialisation de la galerie', error);
  setEmpty('La galerie ne peut pas se charger automatiquement',
    (uiLanguage === 'en' ? 'Error: ' : 'Erreur : ') + (error?.message || String(error)) + (uiLanguage === 'en' ? '. You can still choose photos or a folder using the buttons below.' : '. Vous pouvez toujours choisir des photos ou un dossier avec les boutons ci-dessous.'));
});

/* Mode 9 : volet inférieur tactile et souris, données C2PA identiques au panneau. */
const bottomSheet=document.querySelector('#bottom-sheet');
const bottomHandle=document.querySelector('#bottom-sheet-handle');
let bottomPhoto=null;
function refreshBottomSheet(photo){
  if(bottomSheet.hidden || bottomPhoto!==photo) return;
  fillDetails(photo);
  const s=document.querySelector('#bottom-status');
  s.className=lbStatus.className; s.dataset.c2paStatus=lbStatus.dataset.c2paStatus; s.textContent=lbStatus.textContent;
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
  summary.textContent=tr('Source : ')+sourceLabel(photo)+' · '+(statusLabel(photo.state)||tr('Provenance à examiner'));
  tapReveal.hidden=false;
}
document.querySelector('#tap-reveal-close').addEventListener('click',e=>{e.stopPropagation();hideTapReveal();});
document.querySelector('#tap-reveal-more').addEventListener('click',e=>{e.stopPropagation();if(currentIdx>=0)openSidePanel(photos[currentIdx]);});
