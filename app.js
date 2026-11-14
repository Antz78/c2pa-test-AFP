console.info('[AFP C2PA] Reader-first + full trust comparison v20261113-v4');
console.info('[C2PA AFP] Version filtres v3 chargée : badges À vérifier');
// Galerie C2PA : 100 % statique, fonctionne sur GitHub Pages.
// Deux modes :
//  A) ./photos.json existe (généré par GitHub Action à chaque push) → galerie automatique.
//  B) Sinon, glissez le dossier PHOTOS/ (ou des photos) directement sur la page.
// Version SDK fixée pour éviter les changements silencieux du CDN.
// Le SDK C2PA est chargé à la demande : une panne du CDN ne bloque PLUS la galerie.
const SDK_URL = 'https://cdn.jsdelivr.net/npm/@contentauth/c2pa-web@0.17.0/+esm';
let C2paReader = null;
let C2paContext = null;
let sdkFailure = null; // dernière panne temporaire, jamais mémorisée définitivement

/* ===== Interface FR / EN : sans MutationObserver, sans analyse C2PA supplémentaire =====
   Seuls les libellés changent. Les données brutes de provenance restent intactes. */
const TRANSLATIONS = {
  'Méthode d’identification (détails)': 'How this origin was identified (details)',
  'Comprendre les vérifications': 'Understanding the checks',
  'Ces vérifications portent sur les informations C2PA et leur signature, pas sur la réalité de la scène photographiée.': 'These checks concern the C2PA data and its signature, not whether the scene shown actually happened.',
  'Intégrité du fichier': 'File integrity',
  'Signature cryptographique': 'Cryptographic signature',
  'Confiance dans le certificat': 'Certificate trust',
  'Données signées conformes': 'Signed data match',
  'Différence détectée': 'Mismatch detected',
  'Résultat explicite non communiqué': 'No separate result reported',
  'Signature vérifiée': 'Signature verified',
  'Signature incorrecte': 'Invalid signature',
  'Certificat reconnu': 'Certificate trusted',
  'Certificat reconnu (liste officielle C2PA)': 'Certificate recognized (official C2PA list)',
  'Certificat reconnu (ancienne liste C2PA)': 'Certificate recognized (legacy C2PA list)',
  'Certificat non reconnu par les deux listes': 'Certificate not trusted by either list',
  'Contrôle des listes de confiance indisponible': 'Trust-list checks unavailable',
  'Contrôle des listes de confiance incomplet': 'Trust-list checks incomplete',
  'Reconnaissance officielle C2PA': 'Official C2PA recognition',
  'Reconnaissance provisoire historique C2PA': 'Legacy C2PA recognition',
  'Vérification de confiance à confirmer': 'Trust verification inconclusive',
  'Le certificat a été validé avec la liste officielle C2PA.': 'The signing certificate was validated using the official C2PA list.',
  'Le certificat a été validé avec l’ancienne liste provisoire C2PA, gelée le 1er janvier 2026. Cette validation historique est distincte de celle de la liste officielle actuelle.': 'The certificate was validated using the legacy interim C2PA list, frozen on January 1, 2026. This historic validation is distinct from recognition under the current official list.',
  'Aucune des deux listes C2PA consultées ne permet de reconnaître ce certificat. Cela ne signifie pas que la photo a été falsifiée.': 'Neither of the two C2PA trust lists recognizes this certificate. This does not mean the photo was altered.',
  'Impossible de consulter les listes C2PA. La confiance dans le certificat ne peut pas être confirmée.': 'C2PA trust lists could not be fetched. Certificate trust cannot be confirmed.',
  'Une seule liste C2PA a pu être consultée. La confiance dans le certificat reste à confirmer.': 'Only one C2PA trust list was available. Certificate trust remains unconfirmed.',
  'Certificat non reconnu': 'Certificate not trusted',
  'Confiance non confirmée': 'Trust not confirmed',
  'Certificat ou validation en échec': 'Certificate or validation check failed',
  'Vérification à confirmer': 'Verification needs review',
  'Compare le fichier aux empreintes protégées par les Content Credentials.': 'Compares the file with the fingerprints protected by the Content Credentials.',
  'Vérifie que la signature cryptographique correspond aux données du manifeste.': 'Checks that the cryptographic signature matches the manifest data.',
  'Vérifie si la chaîne du certificat mène à une autorité de confiance reconnue.': 'Checks whether the certificate chain leads to a recognized trust authority.',
  'Aucun résultat isolé ne permet de conclure ici. Voir les codes détaillés si nécessaire.': 'No separate result is available here. See the detailed codes if needed.',
  'Signataire déclaré dans le certificat. Ce nom seul ne confirme pas son identité.': 'Signer named in the certificate. The name alone does not verify their identity.',
  'Appareil ou logiciel ayant créé le manifeste C2PA.': 'Device or software that created the C2PA manifest.',
  'Codes C2PA et identifiants (avancé)': 'C2PA status codes and identifiers (advanced)',
  'Horodatage TSA et date de prise de vue': 'TSA timestamp and capture date',
  'Horodatage TSA': 'TSA time stamp',
  'Horodatage certifié et reconnu': 'Certified, trusted time stamp',
  'Horodatage à vérifier': 'Time stamp needs review',
  'Horodatage valide, confiance à confirmer': 'Valid time stamp, trust not confirmed',
  'Aucun contrôle TSA confirmé': 'No confirmed TSA check',
  'Une heure TSA validée certifie la date de signature. Elle ne remplace pas la date de prise de vue enregistrée par l’appareil (EXIF).': 'A validated TSA timestamp certifies the signing time. It does not replace the capture date recorded by the camera (EXIF).',
  'Cette partie présente les résultats renvoyés par le vérificateur. Une information absente ne signifie pas automatiquement un échec.': 'This section shows the verifier’s results. A missing result does not automatically mean a failed check.',

  'Qu’est-ce que le C2PA ?': 'What is C2PA?',
  'Certificat': 'Certificate',
  'Aucun certificat C2PA détecté dans ce fichier.': 'No C2PA certificate was detected in this file.',
  'Lecture du certificat C2PA indisponible.': 'C2PA certificate details are unavailable.',
  'Vérification du certificat en cours…': 'Checking the certificate…',
  'Le C2PA (Coalition for Content Provenance and Authenticity) est un standard ouvert qui associe à chaque image des informations vérifiables sur son origine : son auteur, sa date de création et les modifications éventuellement apportées.': 'C2PA (Coalition for Content Provenance and Authenticity) is an open standard that associates each image with verifiable information about its origin: its author, creation date, and any subsequent changes.',
  'C’est une démarche volontaire de transparence, qui témoigne d’une volonté de documenter la provenance d’un contenu.': 'It is a voluntary act of transparency, showing a commitment to documenting where content comes from.',
  'Elle permet de retracer l’origine d’une image et les conditions de sa création.': 'It helps trace an image’s origin and the circumstances of its creation.',
  'Il peut indiquer si une image a été modifiée ou générée par IA, lorsque cette information est déclarée.': 'It can indicate whether an image was edited or AI-generated, when this information is declared.',
  'Elle garantit que l’image et les informations signées n’ont subi aucune altération depuis la signature.': 'It guarantees that the image and the signed information have not been altered since signing.',
  'La fiabilité de la scène photographiée relève du travail journalistique, au-delà des seules garanties techniques. En apposant une seconde signature numérique après ses vérifications éditoriales, une agence de presse ou un média engage sa crédibilité et renforce la confiance dans l’authenticité de l’image.': 'The reliability of the photographed scene depends on journalistic work, beyond technical safeguards alone. By adding a second digital signature after its editorial checks, a news agency or media outlet puts its credibility behind the image and strengthens confidence in its authenticity.',
  'Informations techniques du manifeste': 'Technical manifest data',
  'Comprendre les couleurs': 'Understanding the colors',
  'Vert : Contrôle OK': 'Green : Check passed',
  'Orange : Contrôle incertain': 'Amber : Inconclusive check',
  'Rouge : Contrôle négatif': 'Red : Failed check',
  'Gris : Information déclarée': 'Grey : Declared information',
  'Tous les contrôles obligatoires pertinents ont réussi, la confiance est établie et aucun échec bloquant n’est présent.': 'All relevant required checks passed, trust is established, and no blocking failure is present.',
  'La provenance existe, mais un certificat n’est pas reconnu, une vérification reste incomplète ou un élément externe nécessaire est inaccessible.': 'Provenance is present, but a certificate is not trusted, a check is incomplete, or a required external resource is unavailable.',
  'Un contrôle essentiel a établi une incohérence : signature, intégrité, certificat ou structure non valide.': 'An essential check failed: an invalid signature, integrity mismatch, certificate problem, or invalid structure.',
  'Information déclarative sans vérification.': 'Declared information without independent verification.',
  'Une heure TSA validée atteste la date de la signature. Elle ne remplace pas la date de prise de vue EXIF.': 'A validated TSA timestamp attests the signing time. It does not replace the EXIF capture date.',
  'Ces couleurs décrivent les résultats des contrôles, pas la vérité de la scène photographiée.': 'These colors describe verification results, not the truth of the photographed scene.',
  'Capture photographique': 'Photographic Capture',
  'Illustration générée par IA': 'AI generated illustration',
  'Image sans signature C2PA': 'Image without C2PA signature',
  'Le champ C2PA dédié à l’origine de l’image n’est pas renseigné. Toutefois, d’autres métadonnées C2PA permettent d’identifier une capture provenant d’un appareil photo.': 'The C2PA image-origin field is not filled in. However, other C2PA metadata identify a capture originating from a camera.',
  'La provenance C2PA indique une capture photographique, mais les métadonnées du boîtier sont incomplètes. Il s’agit d’une déduction, pas d’une déclaration officielle du type de source.': 'C2PA provenance indicates a photographic capture, but some camera metadata are missing. This is an inference, not an explicit source-type declaration.',
  'Une signature numérique accompagne ces informations. Ce vérificateur ne reconnaît pas le certificat de signature comme fiable. Cela ne prouve pas que la photo est fausse.': 'These details have a digital signature. This verifier does not recognize the signing certificate as trusted. That does not mean the photo is fake.',
  'Certificat numérique à vérifier': 'Digital certificate needs review',
  'Liste officielle C2PA : consultation en cours…': 'Official C2PA trust list: checking…',
  'Liste officielle C2PA : consultation impossible (connexion indisponible).': 'Official C2PA trust list: unavailable (network issue).',
  'Liste officielle C2PA : ': 'Official C2PA trust list: ',
  'Entrée directe au nom du constructeur trouvée': 'Direct entry under the manufacturer’s name found',
  'Aucune entrée directe au nom du constructeur': 'No direct entry under the manufacturer’s name',
  'Ce contrôle informatif ne remplace pas la vérification cryptographique de la chaîne de certificats.': 'This informational check does not replace cryptographic validation of the certificate chain.',
  'Consulter les listes C2PA': 'Browse C2PA lists',
  'À analyser': 'Pending analysis',
  'Vérifiée': 'Verified',
  'À vérifier ⚠': 'Needs verification ⚠',
  'À vérifier': 'Needs verification',
  'Échec ✕': 'Failed ✕',
  'Échec': 'Failed',
  'Sans C2PA': 'No C2PA',
  'Analyse indisponible': 'Analysis unavailable',
  'Résultat mémorisé': 'Saved result',
  'Dernière analyse enregistrée': 'Last saved analysis',
  'Résultat d’une analyse précédente, non vérifié à nouveau pendant cette visite.': 'Result of an earlier analysis, not yet reverified during this visit.',
  'Nouvelle vérification en cours.': 'New verification in progress.',
  'Les couleurs correspondent à la dernière analyse mémorisée, pas à une nouvelle vérification.': 'Colors reflect the last saved analysis, not a new verification.',
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
  'Origine de l’image': 'Image origin',
  'Photo capturée': 'Captured photo',
  'Capture déclarée dans le C2PA': 'Capture declared in C2PA',
  'Origine déclarée dans le C2PA': 'Origin declared in C2PA',
  'Capture déduite du boîtier': 'Camera capture inferred',
  'Capture déduite d’un manifeste Nikon ou Canon antérieur': 'Capture inferred from an earlier Nikon or Canon manifest',
  'Capture déduite du générateur du boîtier (EXIF absent ou supprimé)': 'Capture inferred from camera generator (EXIF absent or redacted)',
  'Image contenant du contenu généré par IA': 'Image containing AI-generated content',
  'Origine indéterminée malgré une signature C2PA': 'Origin undetermined despite a C2PA signature',
  'Vérification ou origine déduite à confirmer': 'Verification or inferred origin needs review',
  'La galerie déduit une capture à partir du boîtier identifié dans les données C2PA signées. Ce n’est pas une déclaration officielle du type de source.': 'This viewer infers a capture from the camera identified in signed C2PA data. This is not an explicit official source-type declaration.',
  'Le type de source est déclaré dans les informations C2PA.': 'The source type is declared in the C2PA information.',
  'L’origine provient d’une étape antérieure de la provenance, et pas nécessairement de la version actuelle.': 'The origin comes from an earlier provenance step, not necessarily the current version.',
  'Aucune origine ne peut être déterminée à partir des informations disponibles.': 'The available information does not establish an image origin.',
  'Cette image ne contient pas de manifeste C2PA intégré détectable.': 'No embedded C2PA manifest was detected in this image.',
  'Impossible de lire les informations C2PA de cette image.': 'C2PA information could not be read from this image.',
  'Origine en cours d’analyse…': 'Checking image origin…',
  'Champ officiel : digitalSourceType': 'Official field: digitalSourceType',
  'Non déclaré': 'Not declared',
  'Capture numérique': 'Digital capture',
  'Capture computationnelle': 'Computational capture',
  'Génération par IA': 'AI generation',
  'Composition avec IA générative': 'Composite with generative AI',
  'Valeur déclarée dans le manifeste': 'Value declared in the manifest',
  'L’absence de ce champ ne signifie pas que la photo a été créée par IA.': 'A missing field does not mean the photo was made with AI.',
  'Cette indication décrit une origine déclarée, pas une preuve que la scène est vraie.': 'This label reports a declared origin; it does not prove that the scene is real.',
  'Comment lire cette information ?': 'How to read this information',
  'D’où vient cette conclusion ?': 'Where does this classification come from?',
  'Méthode de classification': 'Classification method',
  'Déclaré explicitement dans le manifeste C2PA': 'Explicitly declared in the C2PA manifest',
  'Déduit de la création et du boîtier identifiés par les données C2PA signées': 'Inferred from the creation action and camera identified by signed C2PA data',
  'Déclaré dans une étape précédente de la provenance': 'Declared in an earlier provenance step',
  'Aucune information suffisante': 'Not enough information',
  'Emplacement dans le manifeste': 'Location in the manifest',
  'Valeur exacte du champ': 'Exact field value',
  'Appareil identifié': 'Identified camera',
  'Logiciel ou appareil déclarant la provenance': 'Device or software declaring provenance',
  'Qui a signé ces informations ?': 'Who signed these credentials?',
  'Signé par': 'Signed by',
  'Signataire non identifié': 'Signer not identified',
  'Identité du signataire à confirmer': 'Signer identity not confirmed',
  'Le certificat de ce signataire n’est pas reconnu par notre vérificateur. Cela ne prouve pas que la photo est fausse.': 'This verifier does not recognize the signer’s certificate as trusted. This does not prove that the photo is fake.',
  'Certaines vérifications ne sont pas concluantes dans cet outil.': 'Some checks are inconclusive in this viewer.',
  'Une vérification de provenance a échoué.': 'A provenance check has failed.',
  'Les informations C2PA ne doivent pas être considérées comme vérifiées tant que cette erreur n’est pas éclaircie.': 'Do not treat these C2PA credentials as verified until this error is resolved.',
  'Vérification à confirmer': 'Verification needs review',
  'Aucun problème signalé par le vérificateur': 'No issue reported by the verifier',
  'Les contrôles retournés n’indiquent pas d’erreur. Cela ne prouve pas la réalité de la scène.': 'The returned checks report no error. This does not prove that the scene is real.',
  'Informations sur la photo': 'About the photo',
  'Comment cette origine a été déterminée': 'How the origin was determined',
  'Détails de vérification (technique)': 'Verification details (technical)',
  'Pour aller plus loin': 'Learn more',
  'Comprendre les Content Credentials': 'About Content Credentials',
  'Comprendre l’authentification': 'How authentication works',
  'Certificat numérique à vérifier': 'Digital certificate needs verification',
  'Signature C2PA : aucun problème signalé': 'C2PA signature: no issue reported',
  'Échec de vérification': 'Verification failed',
  'Voir les données brutes du manifeste': 'See raw manifest data',
  'Auteur déclaré': 'Declared author',
  'Date enregistrée par l’appareil': 'Date recorded by camera',
  'Signature déclarée': 'Declared signature',
  'Contrôle de l’intégrité': 'Integrity check',
  'Contrôle de la signature': 'Signature check',
  'Identité non confirmée par ce vérificateur': 'Identity not confirmed by this verifier',
  'Nom trouvé dans le certificat, identité non validée ici.': 'Name found in the certificate; identity not verified here.',
  'Le nom du signataire vient du certificat ; il ne garantit pas à lui seul sa fiabilité.': 'The signer name comes from the certificate; the name alone does not guarantee trust.',
  'Origine affichée': 'Displayed origin',
  'Non renseigné dans ce manifeste': 'Not provided in this manifest',
  'Aucune donnée complémentaire disponible.': 'No additional information available.',
  'Date de signature (si indiquée)': 'Signing date (if provided)',
  'Informations de production': 'Production details',
  'Origine non précisée': 'Origin not specified',
  'Origine du contenu (C2PA)': 'Content origin (C2PA)',
  'Catégorie affichée': 'Displayed category',
  'digitalSourceType (IPTC)': 'digitalSourceType (IPTC)',
  'Action C2PA': 'C2PA action',
  'Emplacement de la déclaration': 'Declaration location',
  'Origine retrouvée dans un manifeste parent ou un ingrédient parentOf signé, sous réserve de validation C2PA.': 'Origin found in a parent manifest or signed parentOf ingredient, subject to C2PA validation.',
  'Photo capturée': 'Captured photo',
  'Photo capturée (inférence C2PA)': 'Captured photo (C2PA inference)',
  'Capture déduite de la provenance C2PA du boîtier (non déclarée par digitalSourceType)': 'Capture inferred from the camera’s C2PA provenance (not declared by digitalSourceType)',
  'Fondement de l’inférence': 'Basis for inference',
  'Boîtier déclaré (EXIF signé)': 'Declared camera (signed EXIF)',
  'Générateur déclaré': 'Declared generator',
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
  'Action (par exemple c2pa.created) portant le digitalSourceType dans le manifeste actif.': 'The action (for example c2pa.created) carrying digitalSourceType in the manifest.',
  'Personne déclarée comme auteur de la photo ; cette identité n’est pas forcément vérifiée.': 'Person named as the photo author; their identity is not necessarily verified.',
  'Date attestée par un tiers indépendant : la signature existait au plus tard à cet instant.': 'Time certified by an independent authority: the signature existed no later than this time.',
  'Date enregistrée par l’horloge de l’appareil, modifiable et non certifiée à elle seule.': 'Date recorded by the camera clock; it can be modified and is not independently certified.',
  'EXIF Copyright (crédit déclaré)': 'EXIF Copyright (declared credit)',
  'Les photos ne se sont pas affichées. Vous pouvez ouvrir vos photos avec les boutons ci-dessous, puis vérifier le fichier photos.json et le script app.js sur GitHub.':
    'The photos have not appeared. You can open photos with the buttons below, then check photos.json and app.js on GitHub.'
};
const AFP_READER_EXTRA_TRANSLATIONS = {
  'Résumé de la provenance': 'Provenance summary',
  'Détails de vérification': 'Verification details',
  'Contrôles de sécurité': 'Security checks',
  'Listes de confiance C2PA': 'C2PA trust lists',
  'Signature': 'Signature',
  'Intégrité': 'Integrity',
  'Non confirmée': 'Not confirmed',
  'Échec': 'Failed',
  'Vérifiée': 'Verified',
  'Empreintes et signatures': 'Hashes and signatures',
  'Résultats de validation C2PA': 'C2PA validation results',
  'Informations du manifeste': 'Manifest information',
  'Filigrane invisible (déclaration C2PA)': 'Invisible watermark (C2PA declaration)',
  'Filigrane invisible': 'Invisible watermark',
  'Filigrane déclaré': 'Watermark declared',
  'Filigrane absent': 'Watermark absent',
  'Marque': 'Brand',
  'Technologie': 'Technology',
  'Description déclarée': 'Declared description',
  'SynthID (selon OpenAI)': 'SynthID (according to OpenAI)',
  'Historique de provenance': 'Provenance history',
  'Manifeste actif (version diffusée)': 'Active manifest (distributed version)',
  'Manifeste antérieur': 'Earlier manifest',
  'Manifeste': 'Manifest',
  'Contrôle de confiance officiel': 'Official trust-list check',
  'Contrôle de confiance historique': 'Legacy trust-list check',
  'Reconnu': 'Trusted',
  'Non reconnu': 'Not trusted',
  'Échec cryptographique': 'Cryptographic check failed',
  'Non consulté': 'Not checked',
  'Liste inaccessible': 'List unavailable',
  'Échec de vérification': 'Verification failed',
  'Résultat non disponible': 'Result unavailable',
  'Le certificat est reconnu par l’ancienne liste C2PA, mais pas par la liste officielle actuelle dans ce contrôle.':
    'The certificate is trusted by the legacy C2PA list, but not by the current official list in this check.',
  'Liste officielle actuelle': 'Current official list',
  'Ancienne liste provisoire': 'Legacy interim list',
  'Données techniques du manifeste (JSON)': 'Raw manifest data (JSON)',
  'Comprendre le certificat': 'About the certificate',
  'Afficher les explications': 'Show explanations',
  'Informations non disponibles': 'Information unavailable',
  'L’horodatage TSA, s’il est validé, indique la date de la signature et non la date de prise de vue EXIF.':
    'A validated TSA timestamp dates the signature, not the EXIF capture time.',
  'Les informations ci-dessous décrivent la signature, la confiance et les différentes étapes du fichier.':
    'The details below describe the signature, trust and the file’s provenance steps.'
};

Object.assign(TRANSLATIONS, AFP_READER_EXTRA_TRANSLATIONS);

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
  ['#side-panel .afp-reader-raw > summary', 'Informations techniques du manifeste', 'Technical manifest data'],
  ['#bottom-sheet .afp-reader-raw > summary', 'Informations techniques du manifeste', 'Technical manifest data'],
  ['#credentials .afp-reader-raw > summary', 'Informations techniques du manifeste', 'Technical manifest data'],
  ['#side-panel .note', 'Vert : information présente ou contrôle réussi. Orange : confiance à vérifier. Rouge : échec de contrôle. Une information renseignée ne garantit pas qu\'elle soit vraie.', 'Green: information available or a successful check. Amber: trust requires review. Red: a failed check. A declared value is not proof it is true.'],
  ['#bottom-sheet .bottom-sheet-note', 'Les Content Credentials décrivent une provenance déclarée et les contrôles effectués. Ils ne garantissent pas la véracité de la scène.', 'Content Credentials describe declared provenance and checks performed. They do not guarantee that the scene is true.'],
  ['#credentials .note', 'Les indicateurs verts signalent des informations présentes ou des contrôles réussis ; orange signifie « à vérifier » ; rouge indique un échec de contrôle. Une information renseignée ne prouve pas à elle seule qu’elle est vraie.', 'Green indicators show available information or successful checks; amber means review needed, and red indicates a failed check. A provided value does not, by itself, prove it is true.'],
  // Le bloc « Qu’est-ce que le C2PA ? » est généré dans afpC2paAboutText()
  // et traduit par TRANSLATIONS : plus de textes statiques divergents.
  ['#c2pa-explain-title', 'Qu’est-ce que le C2PA ?', 'What is C2PA?'],
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
  // Les volets permanents « Qu’est-ce que le C2PA ? » sont traduits sans
  // toucher aux états open, ni aux données C2PA affichées.
  refreshC2paAboutPanels();
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
      parent.insertBefore(box, parent.querySelector(':scope > .afp-reader-about') || parent.querySelector('#side-status'));
    } else if (id === 'afp-language-switch-bottom') {
      parent.insertBefore(box, parent.querySelector('.bottom-sheet-body'));
    } else if (id === 'afp-language-switch-lightbox') {
      const close = parent.querySelector('#lb-close');
      parent.insertBefore(box, close);
    } else parent.append(box);
  }
  updateStaticTranslations(); syncLanguageButtons();
}

/* curl.js : Repli de coin de page WebGL, autonome, sans dépendance.
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

const WASM_URL = 'https://cdn.jsdelivr.net/npm/@contentauth/c2pa-web@0.17.0/dist/resources/c2pa_bg.wasm';
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
    const r = await fetchWithTimeout('./photos.json', { cache: 'default' }, 6500);
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
const GITHUB_REPO = ''; // ex. 'antonin/c2pa-galerie' : laissez vide pour la détection auto
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

/* ===== Cache C2PA resilient, strictement lié aux octets d'origine =====
   CacheStorage : JPEG/PNG originaux (mêmes octets, sans réencodage).
   IndexedDB : résultats de l'analyse locale, reliés au SHA-256 du fichier.
   La copie en cache ne prouve pas une nouvelle validation ou une confiance actuelle.
   Les imports locaux (blob:) ne sont jamais persistés. */
const AFP_CACHE_VERSION = 1;
const AFP_CACHE_DB_NAME = 'afp-c2pa-verified-metadata-v1';
const AFP_CACHE_ORIGINALS = 'afp-c2pa-originals-v1';
const AFP_CACHE_LIMIT = 32;
const AFP_MAX_CACHED_PHOTO_BYTES = 28 * 1024 * 1024;
const AFP_MAX_METADATA_BYTES = 4 * 1024 * 1024;
const AFP_ENGINE_VERSION = 'c2pa-web-0.17.0-separate-official-tsa-20261113-v2';
let afpDbPromise = null;

function afpRemoteUrl(photo) {
  if (photo.blob) return null; // pas de cache durable des fichiers personnels importés
  try {
    const u = new URL(photo.url, location.href);
    if (u.origin !== location.origin || !u.pathname.toLowerCase().includes('/photos/')) return null;
    return u.href;
  } catch (_) { return null; }
}
function afpOpenDb() {
  if (!('indexedDB' in window)) return Promise.resolve(null);
  if (!afpDbPromise) afpDbPromise = new Promise(resolve => {
    try {
      const request = indexedDB.open(AFP_CACHE_DB_NAME, AFP_CACHE_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('results')) db.createObjectStore('results', { keyPath: 'url' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => { console.warn('[AFP Cache] IndexedDB indisponible'); resolve(null); };
      request.onblocked = () => resolve(null);
    } catch (_) { resolve(null); }
  });
  return afpDbPromise;
}
async function afpReadRecord(url) {
  if (!url) return null;
  const db = await afpOpenDb(); if (!db) return null;
  return new Promise(resolve => {
    try {
      const r = db.transaction('results','readonly').objectStore('results').get(url);
      r.onsuccess = () => resolve(r.result ?? null);
      r.onerror = () => resolve(null);
    } catch (_) { resolve(null); }
  });
}
async function afpWriteRecord(photo, digest) {
  const url = afpRemoteUrl(photo);
  if (!url || !digest || !['ok','warn','bad','none'].includes(photo.state)) return;
  const db = await afpOpenDb(); if (!db) return;
  // Manifestes JSON uniquement, pas d'instances WASM ni de données de validation inventées.
  let record;
  try {
    record = JSON.stringify({ url, hash:digest, sdk:AFP_ENGINE_VERSION, savedAt:Date.now(),
      state:photo.state, store:photo.store ?? null, active:photo.active ?? null,
      validation:photo.validation ?? [], validationState:photo.validationState ?? null, trustSource:photo.trustSource ?? null, trustChecks:photo.trustChecks ?? null,
      exif:photo.exif ?? null });
    if (record.length > AFP_MAX_METADATA_BYTES) return;
    record = JSON.parse(record);
  } catch (_) { return; }
  await new Promise(resolve => {
    try {
      const tx = db.transaction('results','readwrite');
      tx.objectStore('results').put(record);
      tx.oncomplete = resolve; tx.onerror = resolve; tx.onabort = resolve;
    } catch (_) { resolve(); }
  });
}
async function afpSha256(blob) {
  if (!crypto?.subtle || blob.size > AFP_MAX_CACHED_PHOTO_BYTES) return null;
  try {
    const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
    return [...new Uint8Array(digest)].map(v => v.toString(16).padStart(2,'0')).join('');
  } catch (_) { return null; }
}
async function afpReadCachedOriginal(photo) {
  const url=afpRemoteUrl(photo);
  if (!url || !('caches' in window)) return null;
  try {
    const cache=await caches.open(AFP_CACHE_ORIGINALS);
    const resp=await cache.match(url);
    if (!resp || !resp.ok) return null;
    const blob=await resp.blob();
    return blob.size <= AFP_MAX_CACHED_PHOTO_BYTES ? blob : null;
  } catch (_) { return null; }
}
async function afpSaveOriginal(photo, blob) {
  const url=afpRemoteUrl(photo);
  if (!url || !blob || blob.size > AFP_MAX_CACHED_PHOTO_BYTES || !('caches' in window)) return;
  try {
    const cache=await caches.open(AFP_CACHE_ORIGINALS);
    await cache.put(url, new Response(blob, {headers:{'Content-Type':blob.type || 'application/octet-stream'}}));
    const keys=await cache.keys();
    for (const old of keys.slice(0, Math.max(0,keys.length - AFP_CACHE_LIMIT))) await cache.delete(old);
  } catch (error) { console.warn('[AFP Cache] Photo non stockée (quota ou stockage désactivé)', error?.message||error); }
}
function afpCacheDate(photo) {
  if (!photo.cacheSavedAt) return '';
  try { return new Date(photo.cacheSavedAt).toLocaleString(uiLanguage==='en'?'en-GB':'fr-FR', {dateStyle:'short',timeStyle:'short'}); }
  catch (_) { return ''; }
}
function afpCacheLabel(photo) {
  if (!photo.cacheStatus) return '';
  return `${tr('Dernière analyse enregistrée')}${afpCacheDate(photo)?' : '+afpCacheDate(photo):''}`;
}
function afpShowCacheBanner(photo) {
  if (!photo.cacheStatus) return null;
  const box=document.createElement('div');box.className='afp-c2pa-cache-note';
  box.setAttribute('role','note');
  const title=document.createElement('strong');title.textContent='◷ '+afpCacheLabel(photo);
  const desc=document.createElement('span');
  desc.textContent=tr('Résultat d’une analyse précédente, non vérifié à nouveau pendant cette visite.')+' '+
    (photo.recheckingCache?tr('Nouvelle vérification en cours.'):tr('Les couleurs correspondent à la dernière analyse mémorisée, pas à une nouvelle vérification.'));
  box.append(title,desc);
  return box;
}
function afpRefreshPhoto(photo) {
  renderCard(photo); updateCount();
  if (currentIdx>=0 && photos[currentIdx]===photo && lightbox.open) {
    crBadge.className=`cr ${photo.state}`;
    addBadgeContent(crBadge,presentationFor(photo),photo.state,photo);
    if (['delayed','shield-delayed','origin-distinguo'].includes(presentationFor(photo)) && delayedRevealReady) crBadge.classList.add('delayed-visible');
    if (credentials.open) fillDetails(photo);
    if (!bottomSheet.hidden && bottomPhoto===photo) refreshBottomSheet(photo);
  }
  refreshSidePanel(photo);
}
function afpRestoreRecord(photo, rec, digest) {
  if (!rec || rec.sdk!==AFP_ENGINE_VERSION || rec.hash!==digest || !['ok','warn','bad','none'].includes(rec.state)) return false;
  photo.state=rec.state; photo.store=rec.store; photo.active=rec.active;
  photo.validation=rec.validation || []; photo.validationState=rec.validationState || null; photo.trustSource=rec.trustSource || null; photo.trustChecks=rec.trustChecks || null;
  photo.exif=rec.exif || null; photo.exifDate=photo.exif?.date;
  photo.cacheStatus='stored'; photo.cacheSavedAt=rec.savedAt; photo.error=null;
  photo.recheckingCache=false;
  afpRefreshPhoto(photo);
  return true;
}
function afpUseCachedPhotoImage(photo, blob) {
  if (!blob || !afpRemoteUrl(photo) || photo.displayUrl) return;
  photo.displayUrl=URL.createObjectURL(blob);
  const card=grid.querySelector(`[data-idx="${photo.idx}"]`);
  const img=card?.querySelector('img');
  if (img) {img.src=photo.displayUrl;card.classList.remove('photo-unavailable');}
  if (currentIdx>=0 && photos[currentIdx]===photo) lbPhoto.src=photo.displayUrl;
}

/* Service Worker : ressource statique + CDN figé + JPEG/PNG d'origine.
   L'enregistrement est opportuniste ; le site reste utilisable s'il est interdit. */
if ('serviceWorker' in navigator && location.protocol==='https:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(new URL('./sw.js', import.meta.url), {updateViaCache:'none'})
      .catch(err=>console.warn('[AFP Cache] Service Worker non activé',err?.message||err));
  }, {once:true});
}
window.addEventListener('online', () => {
  let retry=false;
  for (const p of photos) {
    if ((p.cacheStatus==='stored' || ['unavailable','incomplete'].includes(p.trustSource)) &&
        Date.now()-(p.lastCacheRetry||0)>20000) {
      p.needsRetry=true; p.lastCacheRetry=Date.now(); retry=true;
    }
  }
  if (retry) scheduleAnalysis();
});


/* ---------- Analyse C2PA ---------- */
// Ne jamais conserver un échec CDN temporaire pour toute la session : réessai possible.
let afpSdkRetryAfter = 0;
async function ensureC2pa() {
  if (c2pa) return c2pa;
  if (Date.now() < afpSdkRetryAfter) throw (sdkFailure || new Error('Moteur C2PA momentanément indisponible'));
  if (!c2paPromise) {
    c2paPromise = (async () => {
      let timer;
      try {
        const timeout = new Promise((_, reject) => { timer=setTimeout(() => reject(new Error('Chargement du moteur C2PA trop long')), 14000); });
        const sdk = await Promise.race([import(SDK_URL), timeout]);
        C2paReader = sdk.Reader; C2paContext = sdk.Context;
        if (typeof sdk.createC2pa !== 'function' || !C2paReader || !C2paContext) throw new Error('SDK C2PA incomplet (Context absent)');
        c2pa = await sdk.createC2pa({ wasmSrc: WASM_URL });
        sdkFailure = null;
        // Réchauffement opportuniste des deux ressources externes pour les connexions futures.
        afpWarmSdkCache().catch(()=>{});
        return c2pa;
      } finally { clearTimeout(timer); }
    })().catch(error => {
      sdkFailure=error; afpSdkRetryAfter=Date.now()+7000;
      c2paPromise=null; throw error;
    });
  }
  return c2paPromise;
}
async function afpWarmSdkCache() {
  if (!('caches' in window) || !navigator.onLine) return;
  try {
    const cache=await caches.open('afp-c2pa-sdk-v1');
    for (const url of [SDK_URL,WASM_URL]) {
      if (await cache.match(url)) continue;
      try {
        const res=await fetchWithTimeout(url,{mode:'cors',cache:'default'},8000);
        if(res.ok && res.type==='cors') await cache.put(url,res);
      } catch (_) { /* hors connexion, ne bloque pas le lecteur */ }
    }
  } catch (_) {}
}
async function getBlob(photo) {
  if (photo.blob) return photo.blob;
  try {
    const response = await fetchWithTimeout(photo.url, { cache: 'default' }, 20000);
    if (!response.ok) throw new Error('Photo inaccessible (HTTP ' + response.status + ')');
    const blob = await response.blob();
    if (/text\/html/i.test(blob.type)) throw new Error('Le serveur a renvoyé une page HTML au lieu de la photo');
    await afpSaveOriginal(photo,blob);
    return blob;
  } catch (error) {
    const cached=await afpReadCachedOriginal(photo);
    if (cached) {
      photo.usedCachedBytes=true;
      afpUseCachedPhotoImage(photo,cached);
      return cached;
    }
    throw error;
  }
}
/* ===== Validation C2PA : listes officielles puis liste provisoire historique =====
   Les listes contiennent des certificats d'autorités, pas des noms de marques.
   Seul le lecteur cryptographique peut confirmer que le certificat du fichier
   mène réellement à l'une de ces autorités. Jamais de confiance par nom/exif. */
const AFP_TRUST_PEM_URLS = Object.freeze({
  official: 'https://raw.githubusercontent.com/c2pa-org/conformance-public/main/trust-list/C2PA-TRUST-LIST.pem',
  legacy: 'https://contentcredentials.org/trust/anchors.pem'
});
const AFP_LEGACY_TRUST_FILES = Object.freeze({
  config:'https://contentcredentials.org/trust/store.cfg',
  allowed:'https://contentcredentials.org/trust/allowed.sha256.txt'
});
const AFP_TSA_TRUST_PEM_URL = 'https://raw.githubusercontent.com/c2pa-org/conformance-public/main/trust-list/C2PA-TSA-TRUST-LIST.pem';
let afpTsaTrustPemPromise=null;
async function afpTsaTrustPem(){
  if(!afpTsaTrustPemPromise) {
    afpTsaTrustPemPromise=(async()=>{
      const response=await fetchWithTimeout(AFP_TSA_TRUST_PEM_URL,{mode:'cors',cache:'no-cache'},8000);
      if(!response.ok)throw new Error('Liste de confiance TSA : HTTP '+response.status);
      const pem=await response.text();
      if(!/-----BEGIN CERTIFICATE-----[\s\S]*-----END CERTIFICATE-----/.test(pem))
        throw new Error('Liste de confiance TSA : format inattendu');
      return pem;
    })().catch(error=>{afpTsaTrustPemPromise=null;throw error;});
  }
  return afpTsaTrustPemPromise;
}
const afpTrustContexts = new Map();
const afpTrustRetryAfter = Object.create(null);
async function afpTrustContext(source) {
  if (!C2paContext || !AFP_TRUST_PEM_URLS[source]) throw new Error('Contexte de confiance C2PA indisponible');
  if (Date.now() < (afpTrustRetryAfter[source]||0)) throw new Error('Liste '+source+' momentanément inaccessible');
  if (!afpTrustContexts.has(source)) {
    const promise = (async () => {
      // Le délai est borné et les listes sont résolues UNE fois pour la galerie.
      const response = await fetchWithTimeout(AFP_TRUST_PEM_URLS[source], {mode:'cors',cache:'no-cache'}, 8000);
      if (!response.ok) throw new Error('Liste de confiance '+source+' : HTTP '+response.status);
      const pem = await response.text();
      if (!/-----BEGIN CERTIFICATE-----[\s\S]*-----END CERTIFICATE-----/.test(pem))
        throw new Error('Liste de confiance '+source+' : format de certificat inattendu');
      // Keep current official and historical validation independent.
      // The historical list requires its EKU config and end-entity allowlist.
      const trust={trustAnchors:pem};
      if(source==='legacy'){
        const [configResponse,allowedResponse]=await Promise.all([
          fetchWithTimeout(AFP_LEGACY_TRUST_FILES.config,{mode:'cors',cache:'no-cache'},8000),
          fetchWithTimeout(AFP_LEGACY_TRUST_FILES.allowed,{mode:'cors',cache:'no-cache'},8000)
        ]);
        if(!configResponse.ok || !allowedResponse.ok) throw new Error('Configuration de confiance historique indisponible');
        trust.trustConfig=await configResponse.text();
        trust.allowedList=await allowedResponse.text();
      }
      const tsaPem=await afpTsaTrustPem();
      // c2pa-web 0.17 exposes signer/CAWG anchors through Context, but not TSA
      // anchors. Preserve its official settings serialization and append a
      // separate, purpose-scoped TSA anchor at the WASM configuration boundary.
      class AfpTsaContext extends C2paContext {
        async toJson(options){
          const settings=JSON.parse(await super.toJson(options));
          if(!Array.isArray(settings.trust?.anchors)||!settings.trust.anchors.length)
            throw new Error('Ancres de signature C2PA absentes');
          settings.trust.anchors.push({
            trust_anchors:tsaPem,trust_kind:'tsa',trust_uri:'c2pa_tsa_official'
          });
          return JSON.stringify(settings);
        }
      }
      return new AfpTsaContext({
        verify:{verifyTrust:true,verifyAfterReading:true,verifyTimestampTrust:true,ocspFetch:false},
        trust
      });
    })();
    afpTrustContexts.set(source, promise);
    // Une liste momentanément inaccessible peut être retentée à la prochaine analyse.
    promise.catch(() => {
      afpTrustRetryAfter[source]=Date.now()+20000;
      if (afpTrustContexts.get(source)===promise) afpTrustContexts.delete(source);
    });
  }
  return afpTrustContexts.get(source);
}
/* Le SDK renvoie deux formats distincts :
   - validation_results.activeManifest : les succès, avertissements et échecs ;
   - validation_status (ancien format) : principalement les erreurs.
   Lire seulement validation_status masquait les contrôles réussis, notamment
   les certificats Google Pixel, la signature, l'empreinte et le TSA. */
function afpExtractValidationResults(store) {
  const results=store?.validation_results??store?.validationResults;
  const active=results?.activeManifest??results?.active_manifest??null;
  const old=store?.validation_status??store?.validationStatus??[];
  const entries=[];
  const seen=new Set();
  const add=(raw,kind)=>{
    if(!raw)return;
    const code=String(typeof raw==='string'?raw:raw?.code??raw?.status??'').trim();
    if(!code)return;
    const key=kind+'|'+code.toLowerCase()+'|'+String(raw?.url??'');
    if(seen.has(key))return;
    seen.add(key);
    entries.push({...((raw && typeof raw==='object')?raw:{}),code,afpResultKind:kind});
  };
  if(active && typeof active==='object') {
    // Conserver les catégories officielles sans deviner le succès par le nom du code.
    for(const key of ['success','informational','failure']) {
      for(const item of (Array.isArray(active[key])?active[key]:[]))add(item,key);
    }
  }
  // Certains SDK anciens ne fournissent pas les succès, mais uniquement
  // validation_status. Les incorporer sans perdre les résultats modernes.
  for(const item of (Array.isArray(old)?old:[])){
    const code=String(typeof item==='string'?item:item?.code??'').toLowerCase();
    let kind='informational';
    if(item?.success===true)kind='success';
    else if(item?.success===false)kind='failure';
    else if(/^(?:signingcredential\.(?:untrusted|unknown|ocsp\.inaccessible)|algorithm\.unsupported)$/.test(code))kind='failure';
    else if(/(?:\.mismatch|\.invalid|\.malformed|\.revoked|\.expired|\.outsidevalidity)$/.test(code))kind='failure';
    add(item,kind);
  }
  const rawState=store?.validation_state??store?.validationState??null;
  const state=typeof rawState==='string'?rawState.toLowerCase():
    typeof rawState==='object'&&rawState?String(rawState.state??rawState.status??'').toLowerCase():null;
  return {entries,state};
}
function afpValidationCodes(result) {
  return (result?.validation||[]).map(v=>String(typeof v==='string'?v:v?.code??v?.status??'').toLowerCase());
}
function afpHasTrustedCertificate(result) {
  if (result?.validationState==='trusted') return true;
  return afpValidationCodes(result).some(c=>c==='signingcredential.trusted');
}
function afpHasCriticalFailure(result) {
  // Un ancrage absent d'une liste n'est pas un échec cryptographique.
  // Même distinction pour l'OCSP non consulté ou les exclusions documentées.
  return (result?.validation||[]).some(entry => {
    const code=String(typeof entry==='string'?entry:entry?.code??entry?.status??'').toLowerCase();
    return validationLevel(entry)==='bad' &&
      !/^(?:signingcredential\.(?:untrusted|unknown|ocsp\.inaccessible)|algorithm\.unsupported)$/.test(code);
  });
}
function afpBenignNotice(entry) {
  const code=String(typeof entry==='string'?entry:entry?.code??entry?.status??'').toLowerCase();
  return /^(?:signingcredential\.ocsp\.skipped|assertion\.datahash\.additionalexclusionspresent|assertion\.redacted)$/.test(code);
}
async function afpReadC2pa(engine,mime,blob,source) {
  const ctx=source ? await afpTrustContext(source) : undefined;
  let reader=null;
  try {
    reader=await C2paReader.fromBlob(engine,mime,blob,ctx);
    if(!reader) return {store:null,active:null,validation:[],validationState:null};
    const store=await reader.manifestStore();
    const {entries, state}=afpExtractValidationResults(store);
    const active=await reader.activeManifest().catch(()=>null);
    return {store,active,validation:entries,validationState:state};
  } finally {
    if(reader) try {await reader.free();} catch (_) {}
  }
}
/* Deux validations distinctes : l'une avec les racines officielles,
   l'autre, si nécessaire, avec les racines historiques. Les sources,
   échecs réseau et éventuels échecs cryptographiques restent explicites. */
async function afpValidateAgainstTrustLists(engine,mime,blob) {
  const checks={official:{status:'unavailable'},legacy:{status:'not_checked'}};
  let official=null,legacy=null;
  try {
    official=await afpReadC2pa(engine,mime,blob,'official');
    checks.official={status:afpHasCriticalFailure(official)?'failed':afpHasTrustedCertificate(official)?'trusted':'untrusted',
      codes:afpValidationCodes(official)};
  }catch(error){checks.official={status:'unavailable',reason:String(error?.message||error)};}
  if(official?.store && checks.official.status==='trusted') {
    return {...official,trustSource:'official',trustChecks:checks};
  }
  try {
    legacy=await afpReadC2pa(engine,mime,blob,'legacy');
    checks.legacy={status:afpHasCriticalFailure(legacy)?'failed':afpHasTrustedCertificate(legacy)?'trusted':'untrusted',
      codes:afpValidationCodes(legacy)};
  }catch(error){checks.legacy={status:'unavailable',reason:String(error?.message||error)};}
  // Une validation positive historique ne remplace JAMAIS un véritable échec
  // d'intégrité/signature détecté dans les deux validations.
  const cryptoFailure=[official,legacy].some(result=>result?.store && afpHasCriticalFailure(result));
  if(legacy?.store && checks.legacy.status==='trusted' && !cryptoFailure) {
    return {...legacy,trustSource:'legacy',trustChecks:checks};
  }
  if(official?.store || legacy?.store) {
    const chosen=official?.store?official:legacy;
    const statuses=[checks.official.status,checks.legacy.status];
    const source=statuses.every(s=>s==='unavailable')?'unavailable':
      statuses.includes('unavailable')?'incomplete':'untrusted';
    return {...chosen,trustSource:source,trustChecks:checks};
  }
  // Les listes ne déterminent jamais à elles seules si le fichier est sans C2PA.
  // En dernier recours, lire le manifeste sans vérification de confiance.
  const neutral=await afpReadC2pa(engine,mime,blob,null);
  return {...neutral,trustSource:neutral.store?'unavailable':null,trustChecks:checks};
}

async function analyze(photo) {
  if (photo.state !== 'loading' && !photo.needsRetry) return;
  if (photo.analysisPromise) return photo.analysisPromise;
  photo.needsRetry=false;
  photo.analysisPromise = (async () => {
    let blob=null, digest=null, restore=false;
    const cachedMetadata=await afpReadRecord(afpRemoteUrl(photo));
    try {
      // Dès l'ouverture, restaurer le résultat seulement si l'original conservé
      // possède EXACTEMENT les mêmes octets que ceux analysés précédemment.
      if (cachedMetadata) {
        const savedOriginal=await afpReadCachedOriginal(photo);
        if (savedOriginal) {
          const oldHash=await afpSha256(savedOriginal);
          restore=afpRestoreRecord(photo,cachedMetadata,oldHash);
          if (restore && !navigator.onLine) afpUseCachedPhotoImage(photo,savedOriginal);
        }
      }
      if (restore) {
        photo.recheckingCache=!!navigator.onLine;
        if (!navigator.onLine) { afpRefreshPhoto(photo); return; }
        afpRefreshPhoto(photo);
      }
      blob=await getBlob(photo);
      digest=await afpSha256(blob);
      if (!restore && cachedMetadata && digest) restore=afpRestoreRecord(photo,cachedMetadata,digest);
      // Si la photo téléchargée a changé : ne JAMAIS reprendre son ancien statut.
      if (restore && digest!==cachedMetadata.hash) {
        restore=false; photo.cacheStatus=null; photo.cacheSavedAt=null;
        photo.state='loading'; photo.store=null; photo.active=null; photo.validation=[]; photo.validationState=null; photo.trustSource=null; photo.trustChecks=null;
        afpRefreshPhoto(photo);
      }
      if (!photo.exif || !restore) {
        photo.exif=await readExifMetadata(blob);
        photo.exifDate=photo.exif.date;
      }
      const ext=photo.name.split('.').pop().toLowerCase();
      if (ext==='png') {
        const header = new Uint8Array(await blob.slice(0,8).arrayBuffer());
        if (!([137,80,78,71,13,10,26,10].every((v,i)=>header[i]===v)))
          throw new Error('Fichier .png invalide ou image inaccessible (en-tête PNG absent)');
      }
      const engine=await ensureC2pa();
      const mime=({jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',tif:'image/tiff',tiff:'image/tiff'})[ext]||blob.type;
      const check=await afpValidateAgainstTrustLists(engine,mime,blob);
      photo.store=check.store; photo.active=check.active; photo.validation=check.validation; photo.validationState=check.validationState;
      photo.trustSource=check.trustSource; photo.trustChecks=check.trustChecks;
      const levels=photo.validation.map(validationLevel);
      // Never suppress the exact SDK reason behind a red result.
      const blockingCodes=photo.validation.filter(v=>validationLevel(v)==='bad')
        .map(v=>String(typeof v==='string'?v:v?.code??v?.status??''));
      if(blockingCodes.length) console.warn('[AFP C2PA] Échecs bloquants',photo.name,{
        blockingCodes,trustChecks:photo.trustChecks,validationState:photo.validationState
      });
      const certificateTrusted=afpHasTrustedCertificate(check);
      const unknownChecks=photo.validation.some(v=>validationLevel(v)==='neutral' && !afpBenignNotice(v));
      photo.state=!check.store?'none':levels.includes('bad')?'bad':
        (!certificateTrusted || photo.trustSource!=='official' ||
         levels.includes('warn') || unknownChecks)?'warn':'ok';
      photo.error=null;
      photo.cacheStatus=null;photo.cacheSavedAt=null;photo.recheckingCache=false;
      await afpWriteRecord(photo,digest);
    } catch (error) {
      console.warn('[C2PA AFP] Analyse',photo.name,error);
      photo.error=error?.message??String(error);
      if (restore && digest && cachedMetadata?.hash!==digest) restore=false;
      if (restore) {
        // Une panne réseau/SDK ne transforme PAS un ancien résultat en validation rouge.
        photo.state=cachedMetadata.state;
        photo.cacheStatus='stored';photo.cacheSavedAt=cachedMetadata.savedAt;
        photo.recheckingCache=false;
      } else {
        photo.cacheStatus=null;photo.recheckingCache=false;
        photo.state=/no.?manifest|manifest.?not.?found|no.?c2pa.?manifest/i.test(photo.error)?'none':'error';
        if (photo.state==='none' && digest) await afpWriteRecord(photo,digest);
      }
    } finally {
      if (photo.cacheStatus || photo.state!=='loading') afpRefreshPhoto(photo);
    }
  })().finally(()=>{photo.analysisPromise=null;});
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
      const photo = photos.find(p => (p.state === 'loading' || p.needsRetry) && !p.processing);
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
  /* Au repos : opacite 35%. Intro lumineuse 100% pendant 1 s apres 2 s. */
  #grid .demo-overlay.mode-origin-distinguo.origin-visible,
  #lightbox #cr-badge.mode-origin-distinguo.delayed-visible {
    opacity:.35!important;visibility:visible!important;pointer-events:auto!important;
    -webkit-touch-callout:none!important;-webkit-user-select:none!important;
    user-select:none!important;touch-action:manipulation!important;
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
  /* Premiere seconde, appui long et clavier : meme lumiere, meme tressautement. */
  #grid .demo-overlay.mode-origin-distinguo.origin-visible.origin-intro,
  #lightbox #cr-badge.mode-origin-distinguo.delayed-visible.origin-intro,
  #grid .demo-overlay.mode-origin-distinguo.origin-visible.origin-touch-hold,
  #lightbox #cr-badge.mode-origin-distinguo.delayed-visible.origin-touch-hold,
  #grid .demo-overlay.mode-origin-distinguo.origin-visible:focus-visible,
  #lightbox #cr-badge.mode-origin-distinguo.delayed-visible:focus-visible {
    opacity:1!important;
    filter:brightness(1.18) drop-shadow(0 0 5px var(--origin-foreground,#cfd6de)) drop-shadow(0 0 9px rgba(255,255,255,.22))!important;
  }
  #grid .demo-overlay.mode-origin-distinguo.origin-visible.origin-intro svg,
  #lightbox #cr-badge.mode-origin-distinguo.delayed-visible.origin-intro svg,
  #grid .demo-overlay.mode-origin-distinguo.origin-visible.origin-touch-hold svg,
  #lightbox #cr-badge.mode-origin-distinguo.delayed-visible.origin-touch-hold svg,
  #grid .demo-overlay.mode-origin-distinguo.origin-visible:focus-visible svg,
  #lightbox #cr-badge.mode-origin-distinguo.delayed-visible:focus-visible svg {
    animation:afpDistinguoHop .75s ease-in-out infinite!important;
  }
  /* Les pseudo-etats :hover peuvent rester collés sur iOS. Hover = vraie souris uniquement. */
  @media (hover:hover) and (pointer:fine) {
    #grid .demo-overlay.mode-origin-distinguo.origin-visible:hover,
    #lightbox #cr-badge.mode-origin-distinguo.delayed-visible:hover {
      opacity:1!important;
      filter:brightness(1.18) drop-shadow(0 0 5px var(--origin-foreground,#cfd6de)) drop-shadow(0 0 9px rgba(255,255,255,.22))!important;
    }
    #grid .demo-overlay.mode-origin-distinguo.origin-visible:hover svg,
    #lightbox #cr-badge.mode-origin-distinguo.delayed-visible:hover svg {
      animation:afpDistinguoHop .75s ease-in-out infinite!important;
    }
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
/* Lecture multi-emplacements des déclarations de source C2PA.
   Priorité : c2pa.actions v1/v2 (avec templates), puis c2pa.metadata / IPTC,
   puis parentOf uniquement si le manifeste actif n'a aucune déclaration.
   Les indices EXIF, le fabricant, et le simple c2pa.created ne suffisent jamais à
   inventer un digitalSourceType. La confiance cryptographique reste indépendante. */
function c2paSourceDetails(photo) {
  const manifest = c2paActiveManifest(photo);
  const unknown = { kind:'unknown', raw:null, action:null, source:null, hasField:false,
    declared:false, inherited:false, note:null };
  if (!manifest) return unknown;
  const store = photo?.store ?? {};
  const all = store.manifests ?? {};
  const byLabel = new Map();
  if (Array.isArray(all)) {
    for (const m of all) if (m && typeof m === 'object') {
      for (const k of [m.label,m.id,m.instanceID,m.instance_id]) if (k) byLabel.set(String(k), m);
    }
  } else {
    for (const [key,m] of Object.entries(all)) if (m && typeof m === 'object') {
      byLabel.set(key,m);
      for (const k of [m.label,m.id,m.instanceID,m.instance_id]) if (k) byLabel.set(String(k),m);
    }
  }
  function manifestId(value) {
    if (!value) return null;
    if (typeof value === 'object') return manifestId(value.url ?? value.uri ?? value.label ?? value.id ?? value.value);
    const s=String(value).trim();
    const match=s.match(/(?:^|\/)(urn:uuid:[0-9a-f-]{36})(?=\/|$|[#?])/i);
    if (match) return match[1].toLowerCase();
    if (/^urn:uuid:[0-9a-f-]{36}$/i.test(s)) return s.toLowerCase();
    return s;
  }
  for (const [key,m] of [...byLabel.entries()]) {
    const normalized=manifestId(key);
    if(normalized) byLabel.set(normalized,m);
  }
  function lookupManifest(ref) {
    const id=manifestId(ref);
    if (!id) return null;
    return byLabel.get(id) ?? byLabel.get(String(ref)) ?? null;
  }
  function obj(v) {
    if (typeof v === 'string' && /^\s*[\[{]/.test(v)) {
      try { return JSON.parse(v); } catch (_) { return v; }
    }
    return v;
  }
  function sourceValue(v) {
    v=obj(v);
    if (typeof v === 'string') return v.trim() || null;
    if (v && typeof v === 'object') return sourceValue(v['@id'] ?? v.uri ?? v.url ?? v.value ?? v['rdf:resource'] ?? v.label ?? v.id);
    return null;
  }
  function sourceEntries(node, originLabel, maxDepth=5) {
    const seen=new WeakSet(), items=[];
    function visit(v,location,depth) {
      v=obj(v);
      if (!v || depth>maxDepth || typeof v !== 'object') return;
      if (seen.has(v)) return;
      seen.add(v);
      if (Array.isArray(v)) { v.forEach((part,i)=>visit(part,location+'['+i+']',depth+1)); return; }
      for (const [k,value] of Object.entries(v)) {
        // Ne pas confondre la déclaration d'un ingrédient non-parent avec celle du fichier.
        const simple = String(k).split(':').pop().toLowerCase();
        if (simple === 'digitalsourcetype' || simple === 'digital_source_type' || simple === 'digital-source-type') {
          const raw=sourceValue(value);
          if (raw) items.push({raw,source:location+'.'+k,action:null});
        } else if (!/^(ingredients?|thumbnails?|manifests?|claim|signature|thumbnail)$/i.test(k)) {
          visit(value,location+'.'+k,depth+1);
        }
      }
    }
    visit(node,originLabel,0);
    return items;
  }
  function assertionsOf(m) {
    const a=obj(m?.assertions);
    if (Array.isArray(a)) return a;
    if (a && typeof a === 'object') return Object.entries(a).map(([label,data])=>({label,data}));
    return [];
  }
  function labelOf(a) { return String(a?.label ?? a?.type ?? a?.name ?? ''); }
  function payloadOf(a) { return obj(a?.data ?? a?.value ?? a?.payload ?? a); }
  function normKind(raw) {
    const name=String(raw).split(/[\/#]/).pop().toLowerCase();
    if (['compositewithtrainedalgorithmicmedia','compositesynthetic','compositecapture'].includes(name)) return 'composite';
    if (['trainedalgorithmicmedia','trainedalgorithmicdata','syntheticmedia'].includes(name)) return 'ai';
    if (['digitalcapture','computationalcapture','negativefilm','positivefilm','print'].includes(name)) return 'capture';
    // Ne pas affirmer "capture" pour humanEdits, algorithmicallyEnhanced, empty, etc.
    return 'unknown';
  }
  function ownDeclarations(m) {
    const results=[];
    const allAssertions=assertionsOf(m);
    function add(raw,source,action) { if (sourceValue(raw)) results.push({raw:sourceValue(raw),source,action:action||null}); }
    function parseActions(p,origin) {
      p=obj(p);
      if (!p || typeof p !== 'object') return;
      const actions=Array.isArray(p) ? p : p.actions;
      const templates=Array.isArray(p.templates) ? p.templates : [];
      if (!Array.isArray(actions)) return;
      actions.forEach((event,i)=>{
        event=obj(event);
        if (!event || typeof event !== 'object') return;
        const action=String(event.action ?? event.name ?? '');
        // La déclaration de l'action prime sur le modèle ; '*' est le modèle générique v2.
        const template=templates.find(t=>t?.action===action) ?? templates.find(t=>t?.action==='*');
        const value=event.digitalSourceType ?? event.digital_source_type ?? event['digital-source-type']
          ?? template?.digitalSourceType ?? template?.digital_source_type;
        add(value,origin+'.actions['+i+']',action);
      });
    }
    for (const assertion of allAssertions) {
      const name=labelOf(assertion);
      const data=payloadOf(assertion);
      if (/^(?:c2pa\.)?actions(?:\.v\d+)?(?:__\d+)?$/i.test(name)) {
        parseActions(data,name);
      } else if (/^(?:c2pa\.)?metadata(?:\.v\d+)?(?:__\d+)?$|iptc|exif/i.test(name)) {
        for (const x of sourceEntries(data,name)) add(x.raw,x.source,null);
      }
    }
    // Compatibilité SDK : certaines versions exposent l'assertion directement.
    if (results.length===0) parseActions(m?.actions,'manifest.actions');
    // Une forme SDK peut fournir une liste de métadonnées signées hors de "assertions".
    if (results.length===0 && m?.metadata) {
      for (const x of sourceEntries(m.metadata,'manifest.metadata')) add(x.raw,x.source,null);
    }
    return results;
  }
  function chosen(entries,inherited=false) {
    if (!entries.length) return null;
    // Valeurs explicites composites > IA > capture ; inconnu si URI non reconnue.
    const kindOf=entry=>normKind(entry.raw);
    const matched = entries.find(x=>kindOf(x)==='composite') ?? entries.find(x=>kindOf(x)==='ai')
        ?? entries.find(x=>kindOf(x)==='capture') ?? entries[0];
    const kind=kindOf(matched);
    return {kind,raw:[...new Set(entries.map(x=>x.raw))].join(' ; '),
      action:matched.action,source:matched.source,hasField:true,
      declared:kind!=='unknown',inherited,note:null};
  }
  // Le SDK peut retourner un manifeste actif partiel ; le manifestStore contient
  // parfois les assertions complètes (notamment c2pa.metadata et c2pa.actions.v2).
  const activeKey=store.active_manifest ?? store.activeManifest;
  const storedActive=activeKey ? byLabel.get(String(activeKey)) : null;
  const activeCandidates=[manifest,...(storedActive && storedActive!==manifest ? [storedActive] : [])];
  const explicit=activeCandidates.flatMap(ownDeclarations);
  const direct=chosen(explicit);
  // Une photographie qui contient un ingrédient génératif inséré dans l'image
  // ne doit pas être étiquetée "simple capture" au seul motif qu'elle a
  // commencé comme une photo. Ce cas partage le pictogramme AI, mais le
  // panneau doit indiquer qu'il s'agit d'une composition / retouche générative.
  function generatedComponent(m) {
    const claims=[...(Array.isArray(m?.ingredients)?m.ingredients:[]),
      ...assertionsOf(m).filter(x=>/c2pa\.ingredient/i.test(labelOf(x))).map(payloadOf)];
    for(const candidate of claims) {
      const part=obj(candidate);
      if(!part || typeof part !== 'object')continue;
      if(!/^componentof$/i.test(String(part.relationship ?? '').replace(/[-_]/g,'')))continue;
      const raw=sourceValue(part.digitalSourceType ?? part.digital_source_type);
      let aiRaw=raw && ['ai','composite'].includes(normKind(raw)) ? raw : null;
      if(!aiRaw && part.activeManifest) {
        const ingredientManifest=lookupManifest(part.activeManifest);
        if(ingredientManifest) {
          const ingredientSource=chosen(ownDeclarations(ingredientManifest),true);
          if(ingredientSource && ['ai','composite'].includes(ingredientSource.kind)) aiRaw=ingredientSource.raw;
        }
      }
      if(aiRaw) return {kind:'composite',raw:aiRaw,action:'c2pa.placed',
        source:'c2pa.ingredient (componentOf)',hasField:true,declared:true,
        inherited:false,note:'Contenu génératif déclaré dans un ingrédient composant l’image'};
    }
    return null;
  }
  const aiPart=activeCandidates.map(generatedComponent).find(Boolean);
  if(aiPart)return aiPart;
  if (direct?.declared) return direct;

  /* Les ingrédients composant l'image ne définissent PAS l'origine globale.
     On ne suit que parentOf (ou parent_declaration explicite). */
  function parentRefs(m) {
    const refs=[];
    for (const x of [...(Array.isArray(m?.ingredients)?m.ingredients:[]),
       ...assertionsOf(m).filter(x=>/c2pa\.ingredient/i.test(labelOf(x))).map(payloadOf)]) {
      const p=obj(x);
      if (!p || typeof p!=='object') continue;
      const relation=String(p.relationship ?? p.relation ?? p['dc:relation'] ?? '').toLowerCase();
      if (!/parentof|parent_of|parent-of/.test(relation)) continue;
      const uri=sourceValue(p.digitalSourceType ?? p.digital_source_type ?? p['digital-source-type']);
      if (uri) refs.push({direct:uri});
      // CAI SDK returns active_manifest as a STRING inside manifest.ingredients.
      // Raw JUMBF c2pa.ingredient.v3 uses activeManifest: {url: "self#jumbf=/c2pa/…"}.
      for (const val of [p.activeManifest,p.active_manifest,p.manifest,p.manifestLabel,
        p.manifest_label,p.c2pa_manifest,p.c2paManifest,p.provenance,p.instanceID,p.instance_id]) {
        const ref=sourceValue(val);
        if (ref) refs.push({ref});
      }
      for (const path of [p.validationStatus?.activeManifest,p.validation_status?.active_manifest]) {
        const ref=sourceValue(path);
        if (ref) refs.push({ref});
      }
    }
    return refs;
  }
  // La recherche du parent suit la chaîne, mais l’inférence appareil est évaluée
  // après les déclarations officielles pour garder la bonne priorité.
  const ancestors=[];
  const visited=new Set(activeCandidates);
  const queue=activeCandidates.flatMap(parentRefs).map(x=>({x,depth:1}));
  while (queue.length) {
    const {x,depth}=queue.shift();
    if(depth>8) continue;
    if(x.direct) {
      const declared=chosen([{raw:x.direct,source:'parentOf ingredient.digitalSourceType',action:null}],true);
      if(declared?.declared){declared.note='Origine attestée par le signataire dans l’ingrédient parent';return declared;}
      continue;
    }
    const parent=lookupManifest(x.ref);
    if(!parent || visited.has(parent)) continue;
    visited.add(parent);
    ancestors.push(parent);
    const inherited=chosen(ownDeclarations(parent),true);
    if(inherited?.declared){inherited.note='Origine déclarée dans le manifeste parent de la chaîne C2PA';return inherited;}
    queue.push(...parentRefs(parent).map(x=>({x,depth:depth+1})));
  }
  /* Fallback prudent pour certaines photos signées dans l'appareil.
     Canon EOS R1 et Nikon Z6 III fournissent c2pa.created et une assertion
     stds.exif signée indiquant le boîtier, sans digitalSourceType.
     Il s'agit d'une INFERENCE étayée, jamais d'un digitalCapture officiel.
     Ne pas l'utiliser si un contrôle C2PA a réellement échoué. */
  function captureFromSignedCameraEvidence(m, inherited=false) {
    // Ne jamais transformer un manifeste invalide en capture validée.
    if (!m || ['bad','error','none','loading'].includes(photo?.state)) return null;
    const claims=assertionsOf(m);
    const actions=claims.filter(x=>/^(?:c2pa\.)?actions(?:\.v\d+)?(?:__\d+)?$/i.test(labelOf(x)));
    const events=[];
    for (const a of actions) {
      const p=payloadOf(a);
      const list=Array.isArray(p) ? p : p?.actions;
      if(Array.isArray(list)) events.push(...list.map(x=>obj(x)?.action).filter(Boolean));
    }
    if(!events.includes('c2pa.created') || events.some(x=>/edited|opened|placed|removed|repackaged|transcoded/i.test(x))) return null;
    const generator=String(m.claim_generator ?? m.claimGenerator ??
      m.claim_generator_info?.[0]?.name ?? m.claimGeneratorInfo?.[0]?.name ??
      m.claim_generator_info?.name ?? m.claimGeneratorInfo?.name ?? '').trim();
    const exif=claims.filter(x=>/^stds\.exif(?:__\d+)?$/i.test(labelOf(x)));
    const camera=exif.map(x=>payloadOf(x)).find(v=>v && typeof v==='object' && !Array.isArray(v) &&
      (v['tiff:Make'] || v['tiff:Model'] || v.tiff?.Make || v.tiff?.Model));
    const make=String(camera?.['tiff:Make'] ?? camera?.tiff?.Make ?? '').trim();
    const model=String(camera?.['tiff:Model'] ?? camera?.tiff?.Model ?? '').trim();
    const canonGenerator=/^Canon EOS R\d+/i.test(generator);
    const nikonGenerator=/^Z[0-9a-z_]+_Ver\./i.test(generator) || /^Nikon\s+Z[0-9a-z ]+/i.test(generator);
    const canonExif=/^Canon$/i.test(make) && /^Canon\s+EOS\s+R\d+/i.test(model);
    const nikonExif=/^NIKON(?:\s+CORPORATION)?$/i.test(make) && /^(?:NIKON\s+)?Z[\s_-]*\d[\w\s-]*/i.test(model);
    // La signature et le générateur ne prouvent pas la scène, seulement une provenance
    // cohérente avec un boîtier, et ceci ne doit PAS remplacer une déclaration explicite.
    const corroborated=(canonGenerator && canonExif) || (nikonGenerator && nikonExif);
    const generatorOnly=inherited && !camera && (canonGenerator || nikonGenerator);
    if(!corroborated && !generatorOnly) return null;
    return {kind:'capture',raw:null,action:'c2pa.created',
      source: generatorOnly?'parentOf → claim_generator (EXIF absent ou supprimé)'
        :'c2pa.actions + stds.exif + claim_generator',hasField:false,
      declared:false,inherited,inferred:true,weakInference:generatorOnly,
      cameraModel: model || (nikonGenerator?'Nikon (identifié par le générateur)':'Canon (identifié par le générateur)'),
      cameraMake:make,generator,
      note:generatorOnly?'Capture déduite du générateur du boîtier (EXIF absent ou supprimé)'
        :'Capture déduite de la création et des métadonnées C2PA du boîtier ; digitalSourceType non déclaré.'};
  }
  for (const candidate of [...activeCandidates,...ancestors]) {
    const fallback=captureFromSignedCameraEvidence(candidate,ancestors.includes(candidate));
    if(fallback) return fallback;
  }

  /* AFP / Nikon, deuxième chemin : certains SDK ne conservent pas la même
     représentation des liens "parentOf" (v3, manifeste de mise à jour et
     assertions expurgées). Dans ce cas, rechercher UNIQUEMENT le parent
     photographique unique déjà embarqué dans LE MÊME manifestStore C2PA.

     Conditions cumulatives : manifeste actif AFP, entrée/sortie sans placement
     ni modification visuelle déclarée, présence d'une relation parentOf OU
     parent Nikon/Canon unique associé à c2pa.opened, générateur d'appareil
     et action c2pa.created. Une présence de marque Nikon dans les EXIF du JPEG
     seule ne suffit jamais. Résultat = INFERENCE, jamais digitalCapture écrit. */
  const activeRoots=[...new Set(activeCandidates)];
  const eventsIn=(m)=>assertionsOf(m)
    .filter(a=>/^(?:c2pa\.)?actions(?:\.v\d+)?(?:__\d+)?$/i.test(labelOf(a)))
    .flatMap(a=>{const body=payloadOf(a);return Array.isArray(body)?body:Array.isArray(body?.actions)?body.actions:[];})
    .map(a=>String(obj(a)?.action??'').toLowerCase()).filter(Boolean);
  const rootActions=activeRoots.flatMap(eventsIn);
  const rootGenerator=activeRoots.map(m=>String(m?.claim_generator_info?.name ??
    m?.claim_generator_info?.[0]?.name ?? m?.claim_generator ?? '')).join(' ');
  const isAfpManifest=/agence france.presse|\bafp\b|iris-sr-tag/i.test(rootGenerator);
  const parentClaims=activeRoots.flatMap(m=>[
    ...(Array.isArray(m?.ingredients)?m.ingredients:[]),
    ...assertionsOf(m).filter(a=>/c2pa\.ingredient/i.test(labelOf(a))).map(payloadOf)
  ]).map(obj).filter(p=>p && typeof p==='object' &&
    /^parentof$/i.test(String(p.relationship??'').replace(/[-_\s]/g,'')));
  const noImageEdits=rootActions.length>0 && !rootActions.some(a=>
    /c2pa\.(?:placed|removed|edited|transcoded|repackaged|resized|color_adjustments)/.test(a));
  if (isAfpManifest && noImageEdits && (parentClaims.length===1 ||
      (rootActions.includes('c2pa.opened') && parentClaims.length===0))) {
    const embedded=[...new Set([...byLabel.values()])]
      .filter(m=>m && !activeRoots.includes(m) && !ancestors.includes(m));
    const supported=[];
    for (const candidate of embedded) {
      // A declaration on the parent remains stronger than an inference.
      const declared=chosen(ownDeclarations(candidate),true);
      if (declared?.declared) supported.push({...declared, note:'Origine du manifeste parent embarqué dans le fichier AFP'});
      else {
        const inferred=captureFromSignedCameraEvidence(candidate,true);
        if (inferred) supported.push(inferred);
      }
    }
    if (supported.length===1) {
      const result=supported[0];
      // If the only provenance is inferred from a camera claim, do not imply
      // that the active AFP manifest declared digitalCapture.
      result.source='AFP parentOf → manifeste appareil embarqué (résolution SDK de repli)';
      result.inherited=true;
      if (!result.declared) {result.inferred=true;result.weakInference=true;}
      return result;
    }
  }

  return direct ?? unknown;
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
  error: '#C7D0DA', // une panne de lecture/réseau n'est pas une falsification
  none: '#C7D0DA',
  neutral: '#C7D0DA',
  loading: '#C7D0DA'
});
/* Apparition en deux temps : +2 s => flash 100 % et tressautement durant 1 s,
   puis 40 %. La date de revelation reste stable si une analyse C2PA met a jour le DOM. */
function applyOriginIntro(target, until) {
  clearTimeout(target._originIntroTimer);
  target._originIntroUntil = until;
  const remaining = (until || 0) - performance.now();
  target.classList.toggle('origin-intro', remaining > 0);
  if (remaining > 0) {
    target._originIntroTimer = setTimeout(() => {
      if (target._originIntroUntil === until) target.classList.remove('origin-intro');
    }, remaining);
  }
}
function revealThumbnailOrigin(target) {
  if (!target.isConnected || !target.classList.contains('mode-origin-distinguo')) return;
  target.classList.add('origin-visible');
  applyOriginIntro(target, target._originRevealDeadline + 1000);
}
function appendOriginBadge(target, photo, state) {
  const originDetail = c2paSourceDetails(photo);
  const origin = originDetail.kind || 'unknown';
  const level = originStatusLevel(state);
  const badgeLevel = origin === 'unknown' && level !== 'bad' ? 'neutral'
    : (originDetail.inferred && level === 'ok' ? 'warn' : level);
  const color = DISTINGUO_COLORS[badgeLevel] || '#C7D0DA';
  target.style.setProperty('--origin-foreground', color);
  target.dataset.originStatus = badgeLevel;
  target.dataset.originKind = origin;
  const originDescription = originDetail.inferred ? tr('Capture déduite de la provenance C2PA du boîtier (non déclarée par digitalSourceType)') : originTitle(origin);
  // Ne pas utiliser l'attribut HTML title : il crée une seconde infobulle blanche native.
  // Les informations détaillées restent dans aria-label et dans le panneau C2PA.
  target.removeAttribute('title');
  target.setAttribute('aria-label', originDescription + ' : ' + (level === 'warn' ? tr('À vérifier') : level === 'bad' ? tr('Échec') : level === 'ok' ? tr('Validé') : tr('Indéterminé')) + (photo.cacheStatus ? ' : ' + afpCacheLabel(photo) : ''));
  target.classList.add(level, 'origin-' + origin);

  // Dessins optiquement équilibrés sur un cadre SVG 24 × 24 : appareil, AI, calques, ?.
  // Un seul trait coloré fin + très fin contour sombre pour les fonds blancs / noirs.
  let iconPaths;
  if (origin === 'capture') {
    iconPaths = '<path d="M5.4 8.1h2.4l1.6-2.2h5.2l1.6 2.2h2.4a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5.4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Z"/><circle cx="12" cy="13.35" r="3.15"/><path d="M17.9 11.2h.02"/>';
  } else if (origin === 'ai') {
    iconPaths = '<path d="M3.5 18.6 8.4 5.4l4.9 13.2 M5.2 14h6.35"/><path d="M17 5.4h4.1 M19.05 5.4v13.2 M17 18.6h4.1"/>';
  } else if (origin === 'composite') {
    // Seulement trois symboles : tout contenu d'IA générative porte le même sigle AI.
    iconPaths = '<path d="M3.5 18.6 8.4 5.4l4.9 13.2 M5.2 14h6.35"/><path d="M17 5.4h4.1 M19.05 5.4v13.2 M17 18.6h4.1"/>';
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
    if (now >= target._originRevealDeadline) revealThumbnailOrigin(target);
    else target._originRevealTimer = setTimeout(() => revealThumbnailOrigin(target),
      Math.max(0, target._originRevealDeadline - now));
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
    clearTimeout(target._originIntroTimer);
    target._originRevealDeadline = null;
    target._originIntroUntil = null;
    target.classList.remove('origin-intro', 'origin-touch-hold');
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
  crBadge.classList.remove('delayed-visible','origin-intro','origin-touch-hold');
  clearTimeout(crBadge._originIntroTimer);
  crBadge._originIntroUntil = null;
  if(mode==='delayed' || mode==='shield-delayed' || mode==='origin-distinguo') delayedTimer=setTimeout(()=>{
    if(lightbox.open && currentIdx>=0 && ['delayed','shield-delayed','origin-distinguo'].includes(presentationFor(photos[currentIdx]))) {
      delayedRevealReady=true;
      crBadge.classList.add('delayed-visible');
      if (presentationFor(photos[currentIdx]) === 'origin-distinguo') {
        applyOriginIntro(crBadge, performance.now() + 1000);
      }
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
  img.src = photo.displayUrl || photo.url;
  img.alt = photo.name.split('/').pop();
  img.addEventListener('error', () => {
    card.classList.add('photo-unavailable');
    img.alt = tr('Image inaccessible : vérifier le fichier dans PHOTOS/');
    console.warn('[C2PA AFP] Photo inaccessible ou illisible :', photo.url);
  });
  const tag = document.createElement('span');
  tag.className = `tag ${photo.state}`;
  // Masquer tous les bandeaux d'état au-dessus des imagettes, sans changer l'état C2PA.
  // Les pictogrammes, filtres et panneaux restent inchangés.
  tag.hidden = true;
  tag.style.setProperty('display', 'none', 'important');
  tag.tabIndex = -1;
  tag.title = tr(C2PA_STATUS_TIPS[photo.state] || C2PA_STATUS_TIPS.neutral);
  tag.append(Object.assign(document.createElement('span'), { className: 'dot' }),
             document.createTextNode(statusLabel(photo.state) + (photo.cacheStatus ? ' · ◷' : '')));
  if (photo.cacheStatus) tag.title += ' : ' + afpCacheLabel(photo);
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
  // Masquer tous les bandeaux d'état au-dessus des imagettes, sans changer l'état C2PA.
  // Les pictogrammes, filtres et panneaux restent inchangés.
  tag.hidden = true;
  tag.style.setProperty('display', 'none', 'important');
  tag.title = tr(C2PA_STATUS_TIPS[photo.state] || C2PA_STATUS_TIPS.neutral);
  tag.textContent = '';
  tag.append(Object.assign(document.createElement('span'), { className: 'dot' }),
             document.createTextNode(statusLabel(photo.state) + (photo.cacheStatus ? ' · ◷' : '')));
  if (photo.cacheStatus) tag.title += ' : ' + afpCacheLabel(photo);
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
  'Emplacement de la déclaration': 'Assertion C2PA ou manifeste parent à l’origine de la classification.',
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
  /* Distinguo: infobulle courte, beaucoup plus compacte que les explications C2PA. */
  .c2pa-color-help.is-distinguo-tip,
  .c2pa-color-help.is-distinguo-tip:popover-open{
    /* Largeur = texte + marges internes, sans largeur fixe ni espace vide. */
    width:max-content;min-width:0;max-width:calc(100vw - 20px);
    white-space:nowrap;overflow-wrap:normal;word-break:normal;
    padding:6px 9px;border-radius:7px;
    font:600 11px/1.3 system-ui,-apple-system,'Segoe UI',sans-serif;
    box-shadow:0 5px 16px #0007;
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
// Libellés courts pour les quatre marqueurs Distinguo : une seule bulle, à la charte AFP.
// La classification C2PA et sa justification restent accessibles dans le panneau détaillé.
const DISTINGUO_HOVER_MESSAGES = Object.freeze({
  capture: 'Photographic Capture',
  unknown: 'Image origin unknown',
  ai: 'AI generated illustration',
  composite: 'Contains AI-generated content'
});
function showColorHelp(target, options = {}) {
  if (!target) return;
  const isDistinguo = target.classList.contains('mode-origin-distinguo');
  const cls = colorKey(target) || colorKey(target.querySelector('.dot'));
  const markerMessage = isDistinguo ? (target.dataset.originKind === 'unknown' && target.dataset.originStatus === 'neutral' && target.classList.contains('none')
    ? 'Image without signature' : DISTINGUO_HOVER_MESSAGES[target.dataset.originKind]) : null;
  if (!markerMessage && (!cls || !C2PA_STATUS_TIPS[cls])) return;
  colorHelpTarget = target;
  colorHelp.classList.toggle('is-distinguo-tip', Boolean(markerMessage));
  colorHelp.textContent = markerMessage || tr(C2PA_STATUS_TIPS[cls]);
  colorHelp.hidden = false;
  // Pour les icônes, largeur naturelle du texte ; conserver les bulles explicatives originales ailleurs.
  colorHelp.style.width = markerMessage ? '' : Math.min(335, Math.max(160, window.innerWidth - 24)) + 'px';
  colorHelp.style.left = '0px';
  try { if (typeof colorHelp.showPopover === 'function' && !colorHelp.matches(':popover-open')) colorHelp.showPopover(); } catch (_) {}
  // Placement dans la fenêtre y compris sur petit écran.
  const rect = target.getBoundingClientRect();
  const vw = Math.min(window.innerWidth, window.visualViewport?.width || Infinity, document.documentElement.clientWidth || Infinity);
  const vh = Math.min(window.innerHeight, window.visualViewport?.height || Infinity);
  const width = colorHelp.getBoundingClientRect().width || 160;
  const left = Math.max(8, Math.min(vw - width - 8, markerMessage ? rect.left + rect.width / 2 - width / 2 : rect.left));
  colorHelp.style.left = left + 'px';
  const bubbleHeight = colorHelp.getBoundingClientRect().height || 45;
  const below = rect.bottom + 9;
  colorHelp.style.top = (below + bubbleHeight <= vh - 8 ? below : Math.max(8, rect.top - bubbleHeight - 9)) + 'px';
  if (options.centerInImage && isDistinguo) {
    // Appui long mobile : le texte est au centre de la photo, jamais sous le doigt.
    const photoImage = target.id === 'cr-badge' ? document.querySelector('#lb-photo')
      : target.closest('.card')?.querySelector('img');
    const bounds = photoImage?.getBoundingClientRect();
    if (bounds?.width && bounds?.height) {
      const centeredLeft = bounds.left + (bounds.width - width) / 2;
      const centeredTop = bounds.top + (bounds.height - bubbleHeight) / 2;
      colorHelp.style.left = Math.max(8, Math.min(vw - width - 8, centeredLeft)) + 'px';
      colorHelp.style.top = Math.max(8, Math.min(vh - bubbleHeight - 8, centeredTop)) + 'px';
    }
  }
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
document.addEventListener('focusin', e => {
  const target = colorTarget(e.target);
  if (!target) return;
  // Un focus cree par un tap tactile ne doit pas simuler un survol permanent.
  if (target.classList.contains('mode-origin-distinguo') && !target.matches(':focus-visible')) return;
  showColorHelp(target);
});
document.addEventListener('focusout', e => { if (colorHelpTarget?.contains(e.target)) hideColorHelp(); });
document.addEventListener('click', e => {
  const target = colorTarget(e.target);
  if (!target) { hideColorHelp(); return; }
  if (matchMedia('(hover: none)').matches && (target.classList.contains('signal') || target.classList.contains('tag'))) {
    e.stopPropagation(); e.preventDefault();
    if (colorHelpTarget === target) hideColorHelp(); else showColorHelp(target);
  }
}, true);
/* Gestes tactiles du Distinguo :
   tap bref = clic normal (panneau C2PA), appui long = bulle tant que le doigt est pose.
   L'appui long ne doit jamais declencher de clic apres le relachement. */
const ORIGIN_LONG_PRESS_MS = 480;
const ORIGIN_TOUCH_MOVE_PX = 14;
let originTouchGesture = null;
let originBlockedClickTarget = null;
let originBlockedClickUntil = 0;
function endOriginTouchGesture(event) {
  const gesture = originTouchGesture;
  if (!gesture || (event && gesture.pointerId !== event.pointerId)) return;
  clearTimeout(gesture.timer);
  originTouchGesture = null;
  if (gesture.longPress) {
    gesture.target.classList.remove('origin-touch-hold');
    hideColorHelp();
    // Le click est normalement emis APRES pointerup : on le bloque uniquement apres appui long.
    originBlockedClickTarget = gesture.target;
    originBlockedClickUntil = performance.now() + 1100;
    gesture.target.blur();
  }
}
document.addEventListener('pointerdown', event => {
  if (event.pointerType !== 'touch' || event.button !== 0) return;
  const target = colorTarget(event.target);
  if (!target?.classList.contains('mode-origin-distinguo')) return;
  // On ne traite que les marqueurs deja apparus.
  if (!(target.classList.contains('origin-visible') || target.classList.contains('delayed-visible'))) return;
  // Un nouveau contact annule une suppression de clic eventuellement restee d'un ancien appui long.
  // Le clic post-longpress, s'il existe, aura deja ete emis juste apres le precedent pointerup.
  originBlockedClickTarget = null;
  originBlockedClickUntil = 0;
  endOriginTouchGesture();
  const gesture = {pointerId:event.pointerId, target, x:event.clientX, y:event.clientY, timer:0, longPress:false};
  originTouchGesture = gesture;
  gesture.timer = setTimeout(() => {
    if (originTouchGesture !== gesture || !target.isConnected) return;
    gesture.longPress = true;
    target.classList.add('origin-touch-hold');
    showColorHelp(target, {centerInImage:true});
  }, ORIGIN_LONG_PRESS_MS);
}, true);
document.addEventListener('pointermove', event => {
  const gesture = originTouchGesture;
  if (!gesture || gesture.pointerId !== event.pointerId) return;
  const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y;
  if (dx*dx + dy*dy > ORIGIN_TOUCH_MOVE_PX*ORIGIN_TOUCH_MOVE_PX) {
    clearTimeout(gesture.timer);
    if (gesture.longPress) {
      // Si le doigt glisse loin du symbole apres l'appui long, terminer l'infobulle.
      endOriginTouchGesture(event);
    } else originTouchGesture = null;
  }
}, true);
document.addEventListener('pointerup', endOriginTouchGesture, true);
document.addEventListener('pointercancel', endOriginTouchGesture, true);
document.addEventListener('click', event => {
  if (!originBlockedClickTarget || performance.now() > originBlockedClickUntil) {
    originBlockedClickTarget = null;return;
  }
  const target = colorTarget(event.target);
  if (target === originBlockedClickTarget) {
    event.preventDefault();event.stopImmediatePropagation();
    originBlockedClickTarget = null;
  }
}, true);
// Ne pas ouvrir le menu de sauvegarde / selection natif sur un appui long du marqueur.
document.addEventListener('contextmenu', event => {
  const target = colorTarget(event.target);
  if (target?.classList.contains('mode-origin-distinguo') && matchMedia('(pointer:coarse)').matches) event.preventDefault();
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
  const detail = document.createElement('div'); detail.className = 'field-value'; detail.textContent = value == null || value === '' ? '' : readable(value);
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
/* Les codes C2PA sont interprétés par leur identifiant exact, jamais via
   'valid' ou 'revoked' contenus dans un nom (notRevoked, outsideValidity...).
   Les extensions inconnues restent neutres jusqu'à interprétation explicite. */
function validationLevel(v) {
  const code = String(typeof v === 'string' ? v : v?.code ?? v?.status ?? '').trim().toLowerCase();
  if (!code) return 'neutral';
  // Catégories explicites du SDK (en conservant l'orange pédagogique pour untrusted).
  if (v?.afpResultKind==='informational') return 'neutral';
  if (v?.afpResultKind==='success') return 'ok';
  const informational = new Set([
    'signingcredential.ocsp.skipped','assertion.datahash.additionalexclusionspresent',
    'ingredient.unknownprovenance','assertion.redacted',
    'timeofsigning.untrusted','timeofsigning.unknown'
  ]);
  if (informational.has(code)) return 'neutral';
  if (code === 'signingcredential.ocsp.notrevoked') return 'ok';
  if (/^(?:signingcredential\.(?:untrusted|unknown|ocsp\.(?:unknown|inaccessible))|algorithm\.(?:unsupported|deprecated)|manifest\.inaccessible|claim\.missing|timestamp\.untrusted)$/.test(code)) return 'warn';
  if (/^(?:claimsignature\.(?:outsidevalidity|mismatch|invalid)|signingcredential\.ocsp\.revoked)$/.test(code)) return 'bad';
  if (/\.(?:mismatch|invalid|malformed|missing|revoked|failure|error|outofrange|outsidevalidity)$/.test(code)) return 'bad';
  if (/\.(?:validated|trusted|match|insidevalidity|notrevoked|success)$/.test(code)) return 'ok';
  if (v?.afpResultKind==='failure') return 'bad';
  return 'neutral';
}
function signatureOf(a) {
  const sig = firstValue(a.signature_info, a.signatureInfo, a.signature);
  return Array.isArray(sig) ? sig[0] ?? {} : sig ?? {};
}
function validationText(v) { return typeof v === 'string' ? v : firstValue(v?.code, v?.status, JSON.stringify(v)); }

function openLightbox(idx) {
  // Quand le lecteur navigue dans la galerie, garder le panneau déjà ouvert.
  // Seule sa croix (ou la fermeture de la lightbox) doit le masquer.
  const keepCredentialsPanel = lightbox.open && !sidePanel.hidden;
  hideColorHelp();
  currentIdx = idx;
  const photo = photos[idx];
  lbTitle.textContent = photo.name.split('/').pop();
  lbPhoto.src = photo.displayUrl || photo.url;
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
  // Effacer d'abord les informations de la photo précédente : jamais de certificat
  // affiché pour la mauvaise image durant une analyse ou une navigation rapide.
  setStatusLine(photo.state === 'loading' ? 'loading' : photo.state, tr('Chargement des informations…'));
  lbSummary.replaceChildren();
  lbJson.textContent = tr('Chargement…');
  if(mode==='direct' || keepCredentialsPanel){
    // Le panneau suit la nouvelle photographie : état courant ou attente C2PA,
    // puis mise à jour automatique après analyze(photo).
    openSidePanel(photo);
    sidePanel.classList.toggle('direct-visible',mode==='direct');
    if(keepCredentialsPanel) sidePanel.scrollTop = 0;
  } else {
    sidePanel.hidden=true;
    lightbox.classList.remove('afp-panel-open');
    sidePanel.classList.remove('direct-visible');
    sidePhoto=null;
  }
  if (credentials.open) credentials.close();
  if (!lightbox.open) lightbox.showModal();
  requestAnimationFrame(syncLargeCaptionWidth);
  analyze(photo).then(() => {
    if (currentIdx >= 0 && photos[currentIdx] === photo) {
      crBadge.className = `cr ${photo.state}`;
      addBadgeContent(crBadge,presentationFor(photo),photo.state,photo);
      if(['delayed','shield-delayed','origin-distinguo'].includes(presentationFor(photo)) && delayedRevealReady) {
        crBadge.classList.add('delayed-visible');
        if (presentationFor(photo) === 'origin-distinguo' && crBadge._originIntroUntil) {
          applyOriginIntro(crBadge, crBadge._originIntroUntil);
        }
      }
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

/* La même analyse C2PA alimente le pictogramme et le résumé destiné aux lecteurs.
   Origine ≠ confiance de la signature. Pas d'affirmation "photo réelle vérifiée". */
const readerPanelStyle = document.createElement('style');
readerPanelStyle.textContent = `
  #side-status,#lb-status,#bottom-status{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip-path:inset(50%)!important;white-space:nowrap!important;border:0!important}
  #side-panel .afp-reader-origin,#credentials .afp-reader-origin,.bottom-sheet .afp-reader-origin{margin:3px 0 15px!important}
  #side-panel .afp-reader-origin h3,#credentials .afp-reader-origin h3,.bottom-sheet .afp-reader-origin h3{margin:0 0 10px!important;font-size:15px!important;letter-spacing:-.01em}
  .afp-reader-card{--reader-bg:#f5f8fc;--reader-border:#d9e4f0;--reader-main:#14283f;--reader-muted:#53657b;--reader-separator:#dbe5f0;--reader-icon-bg:#e4effe;--reader-accent:#356ad4;
    border:1px solid var(--reader-border);border-radius:14px;background:var(--reader-bg);padding:15px 15px 13px;color:var(--reader-main);line-height:1.42;min-width:0;box-sizing:border-box}
  #side-panel .afp-reader-card{--reader-bg:#1c2938;--reader-border:#3a4d64;--reader-main:#f5f8ff;--reader-muted:#bfcbda;--reader-separator:#344558;--reader-icon-bg:#243a56;--reader-accent:#9dc2ff}
  .afp-reader-head{display:flex;align-items:flex-start;gap:13px;min-width:0}
  .afp-reader-picture{display:grid;place-items:center;flex:none;width:46px;height:46px;border-radius:12px;background:var(--reader-icon-bg);color:var(--reader-accent)}
  .afp-reader-picture svg{height:27px;width:27px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}
  .afp-reader-main{min-width:0;flex:1}
  .afp-reader-main strong{display:block;color:var(--reader-main);font-size:19px;letter-spacing:-.025em;line-height:1.2;font-weight:760}
  .afp-reader-main p{font-size:12.5px;margin:6px 0 0;color:var(--reader-muted);line-height:1.5}
  .afp-reader-source{border-top:1px solid var(--reader-separator);margin-top:14px;padding-top:12px;min-width:0}
  .afp-reader-kicker{display:block;font-size:11.5px;font-weight:700;color:var(--reader-muted);margin-bottom:4px}
  .afp-reader-official{display:block;font:700 14px/1.3 system-ui,sans-serif;color:var(--reader-main);overflow-wrap:anywhere}
  .afp-reader-source small{display:block;margin-top:5px;font-size:11.5px;line-height:1.5;color:var(--reader-muted)}
  .afp-reader-trust{--trust-accent:#6380a2;--trust-border:#dbe3ec;--trust-bg:#f5f7fa;--trust-text:#1a324c;--trust-muted:#52677a;
    padding:12px 13px;border:1px solid var(--trust-border);border-left:3px solid var(--trust-accent);background:var(--trust-bg);border-radius:11px;margin:0 0 14px;color:var(--trust-text)}
  .afp-reader-trust[data-level="warn"]{--trust-accent:#d99321;--trust-border:#e5cd95;--trust-bg:#fffaf0}
  .afp-reader-trust[data-level="bad"]{--trust-accent:#d85052;--trust-border:#e6a3a7;--trust-bg:#fff5f5}
  .afp-reader-trust[data-level="ok"]{--trust-accent:#2d9c63;--trust-border:#b5dfca;--trust-bg:#f1fbf6}
  #side-panel .afp-reader-trust{--trust-border:#3e5064;--trust-bg:#202e3e;--trust-text:#f5f7fc;--trust-muted:#c3cfde}
  #side-panel .afp-reader-trust[data-level="warn"]{--trust-border:#74562a;--trust-bg:#322817}
  #side-panel .afp-reader-trust[data-level="bad"]{--trust-border:#8d414a;--trust-bg:#352127}
  #side-panel .afp-reader-trust[data-level="ok"]{--trust-border:#376e57;--trust-bg:#1d382e}
  .afp-reader-trust .afp-reader-trust-title{font-size:13px;font-weight:760;line-height:1.4;margin:0 0 5px;color:var(--trust-text)}
  .afp-reader-trust .afp-reader-trust-title:before{content:'';display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:8px;background:var(--trust-accent)}
  .afp-reader-trust p{font-size:12px;line-height:1.5;margin:0;color:var(--trust-text)}
  .afp-reader-trust .afp-reader-trust-copy p+p{margin-top:9px;}
  .afp-reader-trust .afp-reader-trust-copy strong{font-weight:750;}
  .afp-reader-trust .afp-reader-signer{margin-top:8px;padding-top:8px;border-top:1px solid var(--trust-border);font-size:12.5px;overflow-wrap:anywhere}
  .afp-reader-trust .afp-reader-signer span{color:var(--trust-muted)}
  .afp-reader-directory-status{border-top:1px solid var(--trust-border);margin-top:10px;padding-top:10px}
  .afp-reader-directory-status p{font-size:11.5px;line-height:1.5;color:var(--trust-text);margin:0 0 5px}
  .afp-reader-directory-status a{color:#77aafd;text-decoration:underline;text-underline-offset:2px;font-size:11px;display:inline-block;margin-top:2px}
  .afp-reader-directory-status small{display:block;font-size:10.5px;line-height:1.45;margin-top:5px;color:var(--trust-muted)}
  .afp-reader-fold{border:1px solid #d6e1ec;border-radius:11px;margin:0 0 10px;overflow:hidden;background:transparent;min-width:0}
  #side-panel .afp-reader-fold{border-color:#34485d}
  .afp-reader-fold > summary{list-style:none;cursor:pointer;font-size:13px;font-weight:730;line-height:1.45;padding:13px 14px;color:inherit;display:flex;align-items:center;justify-content:space-between;gap:12px}
  .afp-reader-fold > summary::-webkit-details-marker{display:none}
  .afp-reader-fold > summary:after{content:'⌄';font-size:19px;line-height:1;color:#8398b0;transition:transform .2s ease;flex:none}
  .afp-reader-fold[open] > summary:after{transform:rotate(180deg)}
  .afp-reader-fold > summary:hover{background:rgba(123,160,195,.07)}
  .afp-reader-fold > summary:focus-visible{outline:2px solid #70a8ea;outline-offset:-2px;border-radius:9px}
  .afp-reader-fold-body{padding:0 12px 12px;line-height:1.5;min-width:0}
  .afp-reader-fold-body > .credential-section{margin:0!important}
  .afp-reader-fold-body > .credential-section h3{margin:0 0 8px;font-size:12px;opacity:.8}
  .afp-reader-fold-body .credential-fields{border-radius:8px}
  .afp-reader-fold .credential-row .field-label{font-weight:650}
  #side-panel .afp-reader-fold .credential-row{grid-template-columns:21px minmax(0,40%) minmax(0,1fr)}
  #side-panel .afp-reader-fold .field-value small{line-height:1.5}
  #side-panel > .note,dialog#credentials .credential-body > .note,.bottom-sheet > .bottom-sheet-scroll > .bottom-sheet-note{display:none}
  .afp-c2pa-legend{display:grid;gap:0;min-width:0;border-radius:9px;overflow:hidden;border:1px solid rgba(140,161,184,.22)}
  .afp-c2pa-legend-item{display:flex;align-items:flex-start;gap:11px;padding:10px 9px}
  .afp-c2pa-legend-item + .afp-c2pa-legend-item{border-top:1px solid rgba(140,161,184,.18)}
  .afp-c2pa-legend-mark{width:12px;height:12px;border-radius:50%;flex:0 0 12px;margin-top:3px;border:1px solid rgba(255,255,255,.17);box-shadow:0 0 0 2px rgba(0,0,0,.07)}
  .afp-c2pa-legend-mark.ok{background:#35c979}
  .afp-c2pa-legend-mark.warn{background:#f6a928}
  .afp-c2pa-legend-mark.bad{background:#f16b6b}
  .afp-c2pa-legend-mark.neutral{background:#94a3b8}
  .afp-c2pa-legend-item strong{display:block;font-size:12px;line-height:1.45;margin:0 0 2px}
  .afp-c2pa-legend-item p{font-size:11.5px;line-height:1.5;margin:0;opacity:.85}
  .afp-c2pa-legend-date{font-size:11px;line-height:1.55;margin:10px 3px 0;opacity:.8}
  .afp-reader-about{margin:0 0 16px!important;padding:0!important;border:1px solid #34485d!important;border-radius:11px!important;background:transparent!important}
  #credentials .afp-reader-about,.bottom-sheet .afp-reader-about{border-color:#d6e1ec!important}
  .afp-reader-about > summary{font-size:13px;padding:12px 14px;cursor:pointer;font-weight:700}
  .afp-reader-about .c2pa-explainer{margin:0!important;border-radius:0 0 10px 10px}
  .afp-reader-about > .note{padding:10px 13px;line-height:1.55;margin:0!important}
  #side-panel > details:has(> pre),#credentials .credential-body > details:has(> pre),.bottom-sheet-scroll > details:has(> pre){margin-top:13px!important}
  @media(max-width:520px){.afp-reader-card{padding:13px}.afp-reader-picture{width:42px;height:42px}.afp-reader-main strong{font-size:17px}.afp-reader-fold-body{padding:0 9px 10px}#side-panel .afp-reader-fold .credential-row{grid-template-columns:20px minmax(0,1fr)}#side-panel .afp-reader-fold .credential-row > .field-label{grid-column:2}#side-panel .afp-reader-fold .credential-row > .field-value{grid-column:2}}
  /* AFP : un seul design d'accordéon dans les 3 présentations du panneau. */
  #side-panel details.afp-reader-fold,
  #credentials details.afp-reader-fold,
  .bottom-sheet details.afp-reader-fold{
    display:block!important;box-sizing:border-box!important;
    margin:0 0 9px!important;padding:0!important;
    border:1px solid #34485d!important;border-radius:9px!important;
    background:transparent!important;overflow:hidden!important;
  }
  #credentials details.afp-reader-fold,.bottom-sheet details.afp-reader-fold{
    border-color:#d6e1ec!important;
  }
  #side-panel details.afp-reader-fold > summary,
  #credentials details.afp-reader-fold > summary,
  .bottom-sheet details.afp-reader-fold > summary{
    display:flex!important;align-items:center!important;justify-content:flex-start!important;
    gap:8px!important;box-sizing:border-box!important;min-height:35px!important;
    margin:0!important;padding:7px 10px!important;
    list-style:none!important;border:0!important;border-radius:0!important;
    font:700 12px/19px system-ui,-apple-system,'Segoe UI',Arial,sans-serif!important;
    cursor:pointer!important;color:inherit!important;
  }
  details.afp-reader-fold > summary::-webkit-details-marker{display:none!important}
  details.afp-reader-fold > summary::marker{content:''!important}
  #side-panel details.afp-reader-fold > summary::before,
  #credentials details.afp-reader-fold > summary::before,
  .bottom-sheet details.afp-reader-fold > summary::before{
    content:''!important;display:block!important;flex:0 0 0!important;
    width:0!important;height:0!important;
    border-top:4px solid transparent!important;
    border-bottom:4px solid transparent!important;
    border-left:6px solid currentColor!important;
    transform:rotate(0deg);transition:transform .16s ease;
    opacity:.95;
  }
  details.afp-reader-fold[open] > summary::before{transform:rotate(90deg)!important}
  #side-panel details.afp-reader-fold > summary::after,
  #credentials details.afp-reader-fold > summary::after,
  .bottom-sheet details.afp-reader-fold > summary::after{
    content:none!important;display:none!important;
  }
  #side-panel details.afp-reader-fold[open] > summary,
  #credentials details.afp-reader-fold[open] > summary,
  .bottom-sheet details.afp-reader-fold[open] > summary{
    border-bottom:1px solid rgba(140,161,184,.19)!important;
  }
  .afp-reader-fold-body{padding:10px!important}
  .afp-reader-fold-body > .afp-reader-card{margin:0!important}
  .afp-reader-fold-body > .afp-reader-trust{margin:0!important}
  .afp-reader-fold-body > details.afp-reader-fold{margin-top:9px!important;margin-bottom:0!important}
  .afp-reader-about .afp-reader-fold-body{padding:10px 11px 12px!important}
  .afp-c2pa-about-copy{font-size:12px;line-height:1.65;color:inherit}
  .afp-c2pa-about-copy p{margin:0 0 9px!important;font-size:12px!important;line-height:1.65!important}
  .afp-c2pa-about-copy strong{font-weight:750}
  .afp-c2pa-about-copy ul{margin:4px 0 11px!important;padding-left:17px!important;font-size:12px!important;line-height:1.65!important}
  .afp-c2pa-about-copy li{margin-bottom:5px}
  .afp-reader-about .afp-c2pa-legend{margin-top:0}
  .afp-reader-raw pre{margin:0!important;padding:9px!important;max-height:280px!important;overflow:auto!important}
  .afp-reader-about .afp-reader-raw{margin-top:9px!important}
  /* Origine: les preuves et les champs source restent accessibles, mais discrets. */
  #side-panel .afp-reader-origin .afp-reader-origin-method,
  #credentials .afp-reader-origin .afp-reader-origin-method,
  .bottom-sheet .afp-reader-origin .afp-reader-origin-method {
    margin:8px 0 0!important;border-color:rgba(136,157,181,.25)!important;
  }
  #side-panel details.afp-reader-origin-method > summary,
  #credentials details.afp-reader-origin-method > summary,
  .bottom-sheet details.afp-reader-origin-method > summary{font-size:11px!important;font-weight:600!important;opacity:.82!important;min-height:31px!important;padding:6px 9px!important;}
  .afp-reader-origin-method .credential-section h3{font-size:11px!important;}
  .afp-reader-origin-method .credential-row{font-size:11px!important;}
  .afp-reader-technical-intro,.afp-reader-technical-date{
    margin:0 0 10px!important;font-size:12px!important;line-height:1.55!important;opacity:.9;
  }
  .afp-reader-technical-date{margin:12px 0 4px!important;padding:10px 11px;border:1px solid rgba(140,161,184,.22);border-radius:8px;}
  .afp-reader-technical-codes{margin-top:9px!important;}
  #side-panel details.afp-reader-technical-codes > summary,
  #credentials details.afp-reader-technical-codes > summary,
  .bottom-sheet details.afp-reader-technical-codes > summary{font-size:11.5px!important;}
  .afp-reader-fold .credential-row .field-value small{font-size:11px;line-height:1.45;opacity:.9;}
`;
document.head.append(readerPanelStyle);
function readerIcon(kind) {
  const paths={
    capture:'<path d="M5.4 8.1h2.4l1.6-2.2h5.2l1.6 2.2h2.4a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5.4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Z"/><circle cx="12" cy="13.35" r="3.15"/>',
    ai:'<path d="M3.5 18.6 8.4 5.4l4.9 13.2 M5.2 14h6.35"/><path d="M17 5.4h4.1 M19.05 5.4v13.2 M17 18.6h4.1"/>',
    composite:'<path d="M3.5 18.6 8.4 5.4l4.9 13.2 M5.2 14h6.35"/><path d="M17 5.4h4.1 M19.05 5.4v13.2 M17 18.6h4.1"/>',
    unknown:'<path d="M7.3 9a4.75 4.75 0 1 1 7.85 3.6C13.2 14 12 14.9 12 16.2"/><path d="M12 19.25v.12"/>'
  };
  const wrap=document.createElement('span');wrap.className='afp-reader-picture';wrap.setAttribute('aria-hidden','true');
  wrap.innerHTML='<svg viewBox="0 0 24 24">'+(paths[kind]||paths.unknown)+'</svg>';
  return wrap;
}
function readerFold(title, ...children) {
  const fold=document.createElement('details');fold.className='afp-reader-fold';
  const label=document.createElement('summary');label.textContent=tr(title);
  const body=document.createElement('div');body.className='afp-reader-fold-body';body.append(...children);
  fold.append(label,body);return fold;
}
function readerOpenFold(title,...children) {
  const fold=readerFold(title,...children);
  fold.open=true;
  return fold;
}

/* Quatre axes pédagogiques de vérification du manifeste actif.
   La norme C2PA prévoit davantage de phases : ces contrôles n'en remplacent
   ni les résultats complets, ni les validations des manifestes ingrédients. */
function afpFourChecks(photo){
  if(!photo)return ['integrity','signature','certificate','timestamp'].map(key=>({key,state:'neutral'}));
  const validation=photo.validation??[];
  const entries=validation.map(e=>({
    code:String(typeof e==='string'?e:e?.code??e?.status??'').toLowerCase(),
    level:validationLevel(e)
  }));
  const codeIs=(name,levels)=>entries.some(e=>e.code===name && (!levels||levels.includes(e.level)));
  const failed=regexp=>entries.some(e=>e.level==='bad'&&regexp.test(e.code));
  const passed=regexp=>entries.some(e=>e.level==='ok'&&regexp.test(e.code));
  const integrityFailed=failed(/^(?:assertion\.(?:datahash|hasheduri|bmffhash|boxhash|boxeshash)\.(?:mismatch|invalid)|ingredient\.(?:manifest|claimsignature)\.mismatch)$/);
  const signatureFailed=failed(/^claimsignature\.(?:mismatch|invalid)$/);
  const credentialFailed=failed(/^(?:signingcredential\.(?:invalid|expired|mismatch|ocsp\.revoked)|claimsignature\.outsidevalidity)$/);
  const integrityOk=passed(/^assertion\.(?:datahash|hasheduri|bmffhash|boxhash|boxeshash)\.match$/) || photo.validationState==='trusted';
  const signatureOk=codeIs('claimsignature.validated',['ok']) || photo.validationState==='trusted';
  const certificateOk=codeIs('signingcredential.trusted',['ok']) && photo.trustSource==='official';
  const certificateWarn=codeIs('signingcredential.untrusted') || codeIs('signingcredential.unknown') ||
    photo.trustSource==='legacy'||photo.trustSource==='untrusted'||
    photo.trustSource==='unavailable'||photo.trustSource==='incomplete';
  const timestampIssue=entries.some(e=>/^timestamp\.(?:untrusted|malformed|mismatch|outsidevalidity|credentialinvalid|invalid)$/.test(e.code));
  const timestampOk=codeIs('timestamp.validated',['ok'])&&codeIs('timestamp.trusted',['ok'])&&!timestampIssue;
  const timestampPartial=codeIs('timestamp.validated')||codeIs('timestamp.trusted');
  return [
    {key:'integrity',state:integrityFailed?'bad':integrityOk?'ok':'neutral'},
    {key:'signature',state:signatureFailed?'bad':signatureOk?'ok':'neutral'},
    {key:'certificate',state:credentialFailed?'bad':certificateOk?'ok':certificateWarn?'warn':'neutral'},
    {key:'timestamp',state:timestampOk?'ok':timestampIssue||timestampPartial?'warn':'neutral'}
  ];
}
function afpFourCheckCard({key,state},historical=false){
  const fr=uiLanguage!=='en';
  const names={integrity:fr?'Intégrité':'Integrity',signature:fr?'Signature':'Signature',
    certificate:fr?'Certificat':'Certificate',timestamp:fr?'Horodatage TSA':'TSA timestamp'};
  const tips={
    integrity:fr?'Vérifie que les données protégées et les empreintes correspondent au contenu signé.':'Checks that protected data and hashes match the signed content.',
    signature:fr?'Vérifie que la signature numérique correspond aux informations du manifeste.':'Checks that the digital signature matches the manifest data.',
    certificate:fr?'Vérifie si le certificat du signataire est valide et reconnu par une autorité de confiance.':'Checks whether the signer’s certificate is valid and trusted.',
    timestamp:fr?'Vérifie qu’une autorité reconnue atteste la date de signature. Ce n’est pas la date de prise de vue.':'Checks whether a trusted authority confirms signing time, not when the photo was taken.'
  };
  const values={
    ok:{integrity:fr?'Conforme':'Match',signature:fr?'Valide':'Valid',
      certificate:fr?'Reconnu':'Trusted',timestamp:fr?'Reconnu':'Trusted'},
    warn:{integrity:fr?'À vérifier':'Needs review',signature:fr?'À vérifier':'Needs review',
      certificate:fr?'À vérifier':'Needs review',timestamp:fr?'À vérifier':'Needs review'},
    bad:{integrity:fr?'Échec':'Failed',signature:fr?'Échec':'Failed',
      certificate:fr?'Échec':'Failed',timestamp:fr?'Échec':'Failed'},
    neutral:{integrity:fr?'Non confirmé':'Not confirmed',signature:fr?'Non confirmé':'Not confirmed',
      certificate:fr?'Non confirmé':'Not confirmed',timestamp:fr?'Non confirmé':'Not confirmed'}
  };
  const card=document.createElement('div');card.className='afp-reader-check-card '+state;
  card.dataset.check=key;card.dataset.checkState=state;
  const top=document.createElement('div');top.className='afp-reader-check-top';
  const glyph=document.createElement('span');glyph.className='afp-reader-check-glyph '+state;
  glyph.textContent=state==='ok'?'✓':state==='bad'?'×':state==='warn'?'!':'i';
  glyph.setAttribute('aria-hidden','true');
  const words=document.createElement('span');words.className='afp-reader-check-words';
  const name=document.createElement('strong');name.textContent=names[key];
  const value=document.createElement('span');value.className='afp-reader-check-status';value.textContent=values[state][key];
  words.append(name,value);
  const help=document.createElement('details');help.className='afp-reader-check-info';
  const toggle=document.createElement('summary');toggle.textContent='i';
  toggle.setAttribute('aria-label',(fr?'Comprendre : ':'Explain: ')+names[key]);
  const copy=document.createElement('p');
  copy.textContent=tips[key]+(historical
    ? (fr?' Aucun contrôle individuel de cette signature n’est confirmé ici.':' This signature has no separately confirmed check here.')
    : '');
  help.append(toggle,copy);top.append(glyph,words);card.append(top,help);
  return card;
}
function afpVisibleC2paColorExplanation(photo,checks){
  const fr=uiLanguage!=='en';
  const global=photo.state==='ok'?'ok':photo.state==='warn'?'warn':
    ['bad','error'].includes(photo.state)?'bad':'neutral';
  const statuses=Object.fromEntries(checks.map(c=>[c.key,c.state]));
  let reason='';
  if(global==='ok'){
    reason=statuses.timestamp==='ok'
      ?(fr?'Intégrité, signature, certificat et horodatage reconnus. Aucun échec bloquant signalé.':'Integrity, signature, certificate and timestamp checks passed. No blocking failure reported.')
      :(fr?'Les contrôles essentiels sont validés. L’horodatage facultatif n’est pas confirmé.':'The essential checks passed; optional timestamp was not confirmed.');
  }else if(global==='warn'&&statuses.timestamp==='warn'&&statuses.certificate==='ok'){
    reason=fr
      ?'La signature, l’intégrité et le certificat sont reconnus. L’autorité d’horodatage ne l’est pas : la date de signature reste à confirmer.'
      :'Signature, integrity and certificate are trusted. The timestamp authority is not: signing time remains unconfirmed.';
  }else if(global==='warn'&&statuses.certificate==='warn'){
    reason=fr
      ?'La confiance dans le certificat du signataire n’est pas établie, même si la signature et l’intégrité peuvent être conformes.'
      :'Trust in the signer’s certificate is not established even if signature and integrity checks pass.';
  }else if(global==='warn'){
    reason=fr?'Une vérification reste incomplète ou non reconnue. Voir les détails techniques.':
      'A verification is incomplete or not trusted. See technical details.';
  }else if(global==='bad'){
    const labels={integrity:fr?'intégrité':'integrity',signature:'signature',
      certificate:fr?'certificat':'certificate',timestamp:fr?'horodatage':'timestamp'};
    const failures=checks.filter(x=>x.state==='bad').map(x=>labels[x.key]);
    reason=failures.length
      ?(fr?'Échec de vérification : ':'Verification failed: ')+failures.join(', ')+'.'
      :(fr?'Un contrôle bloquant a échoué hors de ce résumé. Voir les détails techniques.':
        'A blocking check outside this summary failed. See technical details.');
  }else reason=fr?'Résultat de validation insuffisant.':'Insufficient validation results.';
  const p=document.createElement('p');p.className='afp-reader-color-explanation '+global;
  const lead=document.createElement('strong');lead.textContent=
    ({ok:fr?'Vert':'Green',warn:fr?'Orange':'Amber',bad:fr?'Rouge':'Red',neutral:fr?'Gris':'Grey'})[global]+' : ';
  p.append(lead,document.createTextNode(reason));
  return p;
}
function afpFourCheckPanel(checks,{historical=false}={}){
  const list=document.createElement('div');list.className='afp-reader-fourchecks';
  for(const check of checks)list.append(afpFourCheckCard(check,historical));
  return list;
}
/* Un manifeste historique n'est pas la signature du fichier actuel :
   ne jamais lui attribuer les coches provenant du manifeste actif. */
function afpHistoricalSignaturePanels(photo){
  const stored=photo?.store?.manifests;
  if(!stored||typeof stored!=='object')return [];
  const pairs=Array.isArray(stored)?stored.map((m,i)=>[m?.label||String(i),m]):Object.entries(stored);
  const activeKey=String(photo.store.active_manifest??photo.store.activeManifest??'');
  const activeObj=c2paActiveManifest(photo);
  const panels=[];
  for(const [id,manifest] of pairs){
    if(!manifest||typeof manifest!=='object'||id===activeKey||manifest===activeObj)continue;
    const sig=signatureOf(manifest);
    const signer=firstValue(sig?.name,sig?.issuer,sig?.signer,sig?.organization,manifest?.signer);
    // An actual signing credential must be present; a claim generator alone is not one.
    if(typeof signer!=='string'||!signer.trim())continue;
    const title=(uiLanguage==='en'?'Other signed manifest — ':'Autre manifeste signé — ')+signer;
    const intro=document.createElement('p');intro.className='afp-reader-historical-notice';
    intro.textContent=uiLanguage==='en'
      ?'This signed manifest is embedded in the asset, but this reader does not provide four independent verification outcomes for it. Grey means unconfirmed, not failed.'
      :'Ce manifeste signé est intégré au fichier, mais le lecteur ne dispose pas ici de quatre résultats indépendants permettant de le vérifier. Gris signifie non confirmé, pas échec.';
    const info=document.createElement('p');info.className='afp-reader-historical-id';
    info.textContent=(uiLanguage==='en'?'Manifest ID: ':'Identifiant du manifeste : ')+id;
    const checks=afpFourCheckPanel(afpFourChecks(null),{historical:true});
    const panel=readerFold(title,intro,checks,info);
    panel.classList.add('afp-reader-historical-signature');
    panels.push(panel);
  }
  return panels;
}
function afpColorLegend() {
  // Légende éditoriale AFP. N'affecte ni le statut C2PA, ni la couleur calculée.
  const items=[
    ['ok','Vert : Contrôle OK','Tous les contrôles obligatoires pertinents ont réussi, la confiance est établie et aucun échec bloquant n’est présent.'],
    ['warn','Orange : Contrôle incertain','La provenance existe, mais un certificat n’est pas reconnu, une vérification reste incomplète ou un élément externe nécessaire est inaccessible.'],
    ['bad','Rouge : Contrôle négatif','Un contrôle essentiel a établi une incohérence : signature, intégrité, certificat ou structure non valide.'],
    ['neutral','Gris : Information déclarée','Information déclarative sans vérification.']
  ];
  const list=document.createElement('div');list.className='afp-c2pa-legend';
  for(const [level,name,description] of items){
    const row=document.createElement('div');row.className='afp-c2pa-legend-item';
    const dot=document.createElement('span');dot.className='afp-c2pa-legend-mark '+level;dot.setAttribute('aria-hidden','true');
    const content=document.createElement('div');
    const heading=document.createElement('strong');heading.textContent=tr(name);
    const p=document.createElement('p');p.textContent=tr(description);
    content.append(heading,p);row.append(dot,content);list.append(row);
  }
  return readerFold('Comprendre les couleurs',list);
}
function shortSourceCode(raw) {
  if (!raw || typeof raw!=='string') return null;
  return [...new Set(raw.split(' ; ').map(v=>v.trim().split(/[\/#]/).pop()).filter(Boolean))].join(' · ');
}
function readerOriginExplanation(detail,pending,missing,error) {
  if(pending)return tr('Origine en cours d’analyse…');
  if(error)return tr('Impossible de lire les informations C2PA de cette image.');
  if(missing)return tr('Cette image ne contient pas de manifeste C2PA intégré détectable.');
  if(detail.inferred && detail.weakInference)return tr('La provenance C2PA indique une capture photographique, mais les métadonnées du boîtier sont incomplètes. Il s’agit d’une déduction, pas d’une déclaration officielle du type de source.');
  if(detail.inferred)return tr('Le champ C2PA dédié à l’origine de l’image n’est pas renseigné. Toutefois, d’autres métadonnées C2PA permettent d’identifier une capture provenant d’un appareil photo.');
  if(detail.hasField && detail.inherited)return tr('L’origine provient d’une étape antérieure de la provenance, et pas nécessairement de la version actuelle.');
  if(detail.hasField)return tr('Le type de source est déclaré dans les informations C2PA.');
  return tr('Aucune origine ne peut être déterminée à partir des informations disponibles.');
}
function originPanelSection(photo) {
  const detail=c2paSourceDetails(photo);
  const pending=photo.state==='loading',missing=photo.state==='none',error=photo.state==='error';
  const kind=pending||missing||error?'unknown':detail.kind;
  const labels={capture:'Capture photographique',ai:'Illustration générée par IA',composite:'Illustration générée par IA',unknown:'Origine inconnue'};
  const box=readerOpenFold('Origine de l’image');
  box.classList.add('afp-reader-origin');
  const card=document.createElement('div');card.className='afp-reader-card';
  const top=document.createElement('div');top.className='afp-reader-head';
  const main=document.createElement('div');main.className='afp-reader-main';
  const title=document.createElement('strong');title.textContent=pending?tr('Analyse en cours'):(missing?tr('Image sans signature C2PA'):tr(labels[kind]));
  const desc=document.createElement('p');desc.textContent=readerOriginExplanation(detail,pending,missing,error);
  main.append(title,desc);top.append(readerIcon(kind),main);
  const source=document.createElement('div');source.className='afp-reader-source';
  const kicker=document.createElement('span');kicker.className='afp-reader-kicker';kicker.textContent=tr('Champ officiel : digitalSourceType');
  const value=document.createElement('strong');value.className='afp-reader-official';
  const sourceNote=document.createElement('small');
  if(pending){value.textContent=tr('Analyse en cours');}
  else if(missing){value.textContent=tr('Sans manifeste C2PA intégré');}
  else if(error){value.textContent=tr('Lecture C2PA indisponible');}
  else if(detail.hasField){
    const key=shortSourceCode(detail.raw);
    value.textContent=key||tr('Valeur déclarée dans le manifeste');
    const sourceLabels={digitalcapture:'Capture numérique',computationalcapture:'Capture computationnelle',trainedalgorithmicmedia:'Génération par IA',compositewithtrainedalgorithmicmedia:'Composition avec IA générative'};
    const descriptor=sourceLabels[String(key||'').toLowerCase()];
    sourceNote.textContent=descriptor?tr(descriptor):tr('Valeur déclarée dans le manifeste');
  }else{
    value.textContent=tr('Non déclaré');
    sourceNote.textContent=tr('L’absence de ce champ ne signifie pas que la photo a été créée par IA.');
  }
  source.append(kicker,value,sourceNote);card.append(top,source);
  const originBody=box.querySelector('.afp-reader-fold-body');
  originBody.append(card);
  const method=originTechnicalSection(photo);
  method.classList.add('afp-reader-origin-method');
  originBody.append(method);
  return box;
}
function originTechnicalSection(photo) {
  const detail=c2paSourceDetails(photo),pending=photo.state==='loading';
  const basis=detail.inferred?'Déduit de la création et du boîtier identifiés par les données C2PA signées'
    :detail.hasField?(detail.inherited?'Déclaré dans une étape précédente de la provenance':'Déclaré explicitement dans le manifeste C2PA')
    :'Aucune information suffisante';
  return readerFold('Méthode d’identification (détails)',
    section('D’où vient cette conclusion ?', [
      field('Méthode de classification',tr(pending?'Analyse en cours':basis),'neutral'),
      field('Valeur exacte du champ',detail.raw??null,'neutral'),
      field('Emplacement dans le manifeste',detail.source??null,'neutral'),
      field('Action C2PA',detail.action??null,'neutral'),
      ...(detail.inferred?[field('Appareil identifié',detail.cameraModel,'neutral'),field('Générateur déclaré',detail.generator,'neutral')]:[])
    ])
  );
}
function afpC2paAboutText() {
  // Texte AFP transmis par l'utilisateur. Une version anglaise équivalente
  // est construite dynamiquement avec tr() pour respecter la langue du panneau.
  const block=document.createElement('div');block.className='afp-c2pa-about-copy';
  const sentence=(text,emphasis=null)=>{
    const p=document.createElement('p');
    if(emphasis){const strong=document.createElement('strong');strong.textContent=tr(text);p.append(strong);}
    else p.textContent=tr(text);
    block.append(p);
  };
  {
    const line=tr('Le C2PA (Coalition for Content Provenance and Authenticity) est un standard ouvert qui associe à chaque image des informations vérifiables sur son origine : son auteur, sa date de création et les modifications éventuellement apportées.');
    const named='C2PA (Coalition for Content Provenance and Authenticity)';
    const where=line.indexOf(named);
    const p=document.createElement('p');
    if(where<0)p.textContent=line;
    else{
      const strong=document.createElement('strong');strong.textContent=named;
      p.append(document.createTextNode(line.slice(0,where)),strong,document.createTextNode(line.slice(where+named.length)));
    }
    block.append(p);
  }
  sentence('C’est une démarche volontaire de transparence, qui témoigne d’une volonté de documenter la provenance d’un contenu.',true);
  const ul=document.createElement('ul');
  for(const copy of [
    'Elle permet de retracer l’origine d’une image et les conditions de sa création.',
    'Il peut indiquer si une image a été modifiée ou générée par IA, lorsque cette information est déclarée.',
    'Elle garantit que l’image et les informations signées n’ont subi aucune altération depuis la signature.',
    'La fiabilité de la scène photographiée relève du travail journalistique, au-delà des seules garanties techniques. En apposant une seconde signature numérique après ses vérifications éditoriales, une agence de presse ou un média engage sa crédibilité et renforce la confiance dans l’authenticité de l’image.'
  ]){
    const li=document.createElement('li');li.textContent=tr(copy);ul.append(li);
  }
  block.append(ul);
  return block;
}
function refreshC2paAboutPanels(){
  for(const fold of document.querySelectorAll('.afp-reader-about')){
    const label=fold.querySelector(':scope > summary');
    if(label)label.textContent=tr('Qu’est-ce que le C2PA ?');
    const body=fold.querySelector(':scope > .afp-reader-fold-body');
    if(body)body.replaceChildren(afpC2paAboutText());
  }
}
function foldReaderBoilerplate() {
  for(const holder of [document.querySelector('#side-panel'),document.querySelector('#credentials .credential-body'),document.querySelector('#bottom-sheet .bottom-sheet-scroll')]){
    if(!holder||holder.querySelector(':scope > .afp-reader-about'))continue;
    holder.querySelector(':scope > .c2pa-explainer')?.remove();
    holder.querySelector(':scope > .note, :scope > .bottom-sheet-note')?.remove();
    // Ces informations sont désormais rattachées au certificat de la photo.
    holder.querySelector(':scope > details:has(> pre)')?.remove();
    const about=readerFold('Qu’est-ce que le C2PA ?');
    about.classList.add('afp-reader-about');
    const firstContent=holder.querySelector(':scope > #side-status, :scope > #lb-status, :scope > #bottom-status');
    if(firstContent)holder.insertBefore(about,firstContent);
    else holder.prepend(about);
  }
  refreshC2paAboutPanels();
}
foldReaderBoilerplate();

/* ================== Annuaire PUBLIC C2PA (information seulement) ==================
   L'Explorer est une interface. Sa source machine est le JSON officiel.
   Ce JSON répertorie des autorités/services de confiance, PAS les certificats
   de chaque photo. Seule la validation du SDK peut conclure sur la signature.
   Pas de requalification cryptographique sur la base d'un nom de marque. */
const AFP_OFFICIAL_TRUST_JSON='https://raw.githubusercontent.com/c2pa-org/conformance-public/main/trust-list/C2PA-TRUST-LIST.json';
const AFP_CONFORMANCE_EXPLORER='https://spec.c2pa.org/conformance-explorer/';
const AFP_TRUST_DIRECTORY_CACHE='afp-c2pa-public-trust-list-summary-v1';
// Ces marques sont connues dans l'ancienne liste provisoire. Cela ne dit PAS
// que le certificat précis du fichier appartient à cette liste.
const AFP_LEGACY_SIGNER_BRANDS = new Set(['nikon','canon','sony','leica','fujifilm']);
/* ===== Explication grand public : texte à trous pour tous les signataires =====
   La marque vient du certificat/signataire, jamais de l'EXIF seul.
   Aucun statut de confiance n'est inféré du nom d'une marque. */
function afpSignerProfile(value) {
  const input=String(value??'').trim().replace(/[\u0000-\u001f]/g,'').slice(0,120);
  // Pour les constructeurs, on peut parler d'« appareils ».
  const cameraBrands=[
    ['nikon',/\bnikon\b/i,'Nikon'],
    ['canon',/\bcanon\b/i,'Canon'],
    ['sony',/\bsony\b/i,'Sony'],
    ['leica',/\bleica\b/i,'Leica'],
    ['fujifilm',/\bfuji(?:film)?\b/i,'Fujifilm'],
    ['panasonic',/\bpanasonic\b|\blumix\b/i,'Panasonic'],
    ['olympus',/\bolympus\b/i,'Olympus'],
    ['omsystem',/\bom[\s-]?system\b/i,'OM System'],
    ['ricoh',/\bricoh\b/i,'Ricoh'],
    ['pentax',/\bpentax\b/i,'Pentax'],
    ['hasselblad',/\bhasselblad\b/i,'Hasselblad'],
    ['gopro',/\bgo[\s-]?pro\b/i,'GoPro'],
    ['dji',/\bdji\b/i,'DJI'],
    ['phaseone',/\bphase[\s-]?one\b/i,'Phase One'],
    ['sigma',/\bsigma\b/i,'Sigma'],
    ['samsung',/\bsamsung\b/i,'Samsung']
  ];
  for(const [key,pattern,name] of cameraBrands){
    if(pattern.test(input))return {key,fr:name,en:name,known:true,camera:true};
  }
  const organizations=[
    ['afp',/agence france.presse|\bAFP\b/i,'l’AFP','AFP'],
    ['adobe',/\badobe\b/i,'Adobe','Adobe'],
    ['openai',/\bopenai\b/i,'OpenAI','OpenAI'],
    ['microsoft',/\bmicrosoft\b/i,'Microsoft','Microsoft'],
    ['google',/\bgoogle\b/i,'Google','Google'],
    ['apple',/\bapple\b/i,'Apple','Apple']
  ];
  for(const [key,pattern,fr,en] of organizations){
    if(pattern.test(input))return {key,fr,en,known:true,camera:false};
  }
  // Signataire inconnu du dictionnaire : afficher son nom, ne pas inventer de boîtier.
  if(input)return {key:input.toLowerCase(),fr:input,en:input,known:true,camera:false};
  return {key:'unknown',fr:'',en:'',known:false,camera:false};
}
function afpSignerTrustExplanation(signer, trustLevel, isUntrusted, trustSource=null) {
  const who=afpSignerProfile(signer);
  const fr=uiLanguage!=='en';
  // Seule la première phrase varie ; les trois autres conservent le wording demandé.
  const opening=fr
    ?(who.camera
      ?`Les appareils ${who.fr} compatibles C2PA associent à chaque photo un **certificat numérique**, véritable acte de naissance de l’image.`
      :who.known
        ?`Les photos signées par ${who.fr} avec le C2PA sont associées à un **certificat numérique**, véritable acte de naissance de l’image.`
        :'Les appareils et logiciels compatibles C2PA associent à chaque photo un **certificat numérique**, véritable acte de naissance de l’image.')
    :(who.camera
      ?`C2PA-compatible ${who.en} cameras associate a **digital certificate** with each photograph, much like a birth certificate for the image.`
      :who.known
        ?`Photos signed by ${who.en} using C2PA are associated with a **digital certificate**, much like a birth certificate for the image.`
        :'C2PA-compatible cameras and software associate a **digital certificate** with each photograph, much like a birth certificate for the image.');
  const paragraphs=fr?[
    opening,
    'Ce certificat permet d’identifier l’appareil ou l’organisme qui a signé la photo. Son authenticité est contrôlée à partir de **listes officielles de confiance, publiées en ligne par le C2PA**.',
    'Un second contrôle compare l’empreinte numérique de la photo à celle enregistrée lors de sa création. **Si l’image a été modifiée sans nouvelle certification C2PA, cette correspondance est rompue et son intégrité ne peut plus être garantie.**',
    'Lorsque ces vérifications sont concluantes, elles apportent une **preuve cryptographique rigoureuse et pratiquement irréfutable de l’intégrité des données signées**.'
  ]:[
    opening,
    'This certificate identifies the camera or organization that signed the photo. Its authenticity is checked against **official trust lists published online by C2PA**.',
    'A second check compares the photo’s digital fingerprint with the one recorded when it was created. **If the image has been changed without new C2PA certification, the fingerprints no longer match and its integrity cannot be guaranteed.**',
    'When these checks are successful, they provide **rigorous, practically irrefutable cryptographic evidence of the integrity of the signed data**.'
  ];
  // Éviter de confondre cette explication générale et le résultat de CE fichier.
  if(trustLevel==='bad'){
    paragraphs.push(fr
      ?'**Pour cette photo, au moins un contrôle a échoué : son intégrité ne peut pas être garantie.**'
      :'**For this photo, at least one check failed: its integrity cannot be guaranteed.**');
  }else if(isUntrusted || trustSource==='untrusted'){
    paragraphs.push(fr
      ?'**Pour cette photo, le certificat n’est pas reconnu par les listes consultées. Cela ne signifie pas que l’image a été modifiée.**'
      :'**For this photo, the certificate is not trusted by the lists checked. This does not mean the image was modified.**');
  }else if(trustLevel==='warn'){
    paragraphs.push(fr
      ?'**Pour cette photo, certaines vérifications restent à confirmer.**'
      :'**For this photo, some checks still need confirmation.**');
  }
  return paragraphs.join('\n\n');
}

function afpTrustSourceExplanation(trustSource) {
  const messages={
    official:'Le certificat a été validé avec la liste officielle C2PA.',
    legacy:'Le certificat a été validé avec l’ancienne liste provisoire C2PA, gelée le 1er janvier 2026. Cette validation historique est distincte de celle de la liste officielle actuelle.',
    untrusted:'Aucune des deux listes C2PA consultées ne permet de reconnaître ce certificat. Cela ne signifie pas que la photo a été falsifiée.',
    unavailable:'Impossible de consulter les listes C2PA. La confiance dans le certificat ne peut pas être confirmée.',
    incomplete:'Une seule liste C2PA a pu être consultée. La confiance dans le certificat reste à confirmer.'
  };
  return tr(messages[trustSource]||messages.incomplete);
}
function afpAppendTrustSourceNote(trust, photo) {
  const source=photo?.trustSource;
  if(!source)return;
  const holder=document.createElement('div');holder.className='afp-reader-directory-status';
  const note=document.createElement('p'); note.textContent=afpTrustSourceExplanation(source);
  const link=document.createElement('a');link.href=AFP_CONFORMANCE_EXPLORER;
  link.target='_blank';link.rel='noopener noreferrer';link.textContent=tr('Consulter les listes C2PA');
  holder.append(note,link);trust.append(holder);
}

function afpTrustExplanationNode(message){
  const wrapper=document.createElement('div');
  wrapper.className='afp-reader-trust-copy';
  for(const paragraph of String(message||'').split(/\n\s*\n/)){
    const p=document.createElement('p');
    for(const fragment of paragraph.split(/(\*\*[^*]+\*\*)/g)){
      if(fragment.startsWith('**')&&fragment.endsWith('**')&&fragment.length>4){
        const strong=document.createElement('strong');
        strong.textContent=fragment.slice(2,-2);
        p.append(strong);
      }else if(fragment) p.append(document.createTextNode(fragment));
    }
    wrapper.append(p);
  }
  return wrapper;
}

let afpDirectoryFetch=null;
function afpDirectoryNames(json){
  const list=json?.LoTE?.TrustedEntitiesList;
  if(!Array.isArray(list))throw Error('Unexpected C2PA trust-list format');
  const names=[];
  for(const item of list){
    const details=item.TrustedEntityInformation??{};
    for(const entry of (details.TEName??[]))if(typeof entry?.value==='string')names.push(entry.value);
    for(const service of (item.TrustedEntityServices??[])){
      for(const entry of (service.ServiceInformation?.ServiceName??[]))if(typeof entry?.value==='string')names.push(entry.value);
    }
  }
  return {names, issued:json?.LoTE?.ListAndSchemeInformation?.ListIssueDateTime??null};
}
function afpCachedTrustDirectory(){
  try{
    const cached=JSON.parse(localStorage.getItem(AFP_TRUST_DIRECTORY_CACHE)||'null');
    if(cached && Date.now()-cached.storedAt < 86400000 && Array.isArray(cached.data?.names))return cached.data;
  }catch(_){}
  return null;
}
function afpPublicTrustDirectory(){
  if(afpDirectoryFetch)return afpDirectoryFetch;
  const cached=afpCachedTrustDirectory();
  if(cached)return afpDirectoryFetch=Promise.resolve(cached);
  afpDirectoryFetch=(async()=>{
    const ctrl=new AbortController();const timeout=setTimeout(()=>ctrl.abort(),6500);
    try{
      const response=await fetch(AFP_OFFICIAL_TRUST_JSON,{mode:'cors',cache:'no-cache',signal:ctrl.signal});
      if(!response.ok)throw Error('Trust list HTTP '+response.status);
      const json=await response.json();const data=afpDirectoryNames(json);
      try{localStorage.setItem(AFP_TRUST_DIRECTORY_CACHE,JSON.stringify({storedAt:Date.now(),data}));}catch(_){}
      return data;
    }finally{clearTimeout(timeout);}
  })().catch(err=>{
    afpDirectoryFetch=null; // retry next panel opening after a network failure
    throw err;
  });
  return afpDirectoryFetch;
}
function afpAttachTrustDirectoryStatus(trust,signerName){
  const profile=afpSignerProfile(signerName);
  if(!profile.known)return;
  const holder=document.createElement('div');
  holder.className='afp-reader-directory-status';
  holder.dataset.directorySigner=profile.key;
  holder.setAttribute('role','note');
  const explanation=document.createElement('p');
  explanation.textContent=tr('Liste officielle C2PA : consultation en cours…');
  const link=document.createElement('a');link.href=AFP_CONFORMANCE_EXPLORER;link.target='_blank';link.rel='noopener noreferrer';
  link.textContent=tr('Consulter les listes C2PA');
  const limit=document.createElement('small');limit.textContent=tr('Ce contrôle informatif ne remplace pas la vérification cryptographique de la chaîne de certificats.');
  holder.append(explanation,link,limit);trust.append(holder);
  function updateEveryVisibleCopy(message){
    for(const item of document.querySelectorAll('.afp-reader-directory-status')){
      if(item.dataset.directorySigner===profile.key){
        const paragraph=item.querySelector('p');if(paragraph)paragraph.textContent=message;
      }
    }
  }
  afpPublicTrustDirectory().then(data=>{
    // Recherche d'une entrée DIRECTE au nom de l'entité. Ce n'est PAS la validation
    // du certificat du fichier (un certificat peut chaîner vers une autre autorité).
    const candidate=profile.key==='afp'?/agence france.presse|\bAFP\b/i:
      new RegExp('\\b'+String(profile.key).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\b','i');
    const nameListed=data.names.some(name=>candidate.test(name));
    let issue='';
    if(data.issued){const d=new Date(data.issued);if(!Number.isNaN(d.getTime()))issue=' ('+d.toLocaleDateString(uiLanguage==='fr'?'fr-FR':'en-GB')+')';}
    const label=uiLanguage==='fr'?'Liste officielle C2PA':'Official C2PA list';
    const organization=uiLanguage==='fr'?profile.fr:profile.en;
    updateEveryVisibleCopy(`${label} : ${uiLanguage==='fr'
      ?(nameListed?`une entrée mentionne ${organization}`:`aucune entrée directe au nom de ${organization}`)
      :(nameListed?`an entry mentions ${organization}`:`no direct entry for ${organization}`)}${issue}.`);
  }).catch(()=>updateEveryVisibleCopy(tr('Liste officielle C2PA : consultation impossible (connexion indisponible).')));
}

/* Le détail technique est une seule surface à plat, sans sous-panneaux de statut. */
function afpTrustListFields(photo) {
  const map={trusted:'Reconnu',untrusted:'Non reconnu',failed:'Validation C2PA en échec',
    unavailable:'Liste inaccessible',not_checked:'Non consulté'};
  const official=photo.trustChecks?.official?.status ?? 'not_checked';
  const legacy=photo.trustChecks?.legacy?.status ?? 'not_checked';
  const level=code=>code==='trusted'?'ok':code==='failed'?'bad':code==='untrusted'?'warn':'neutral';
  const detail=source=>{
    const check=photo.trustChecks?.[source];
    if(!check)return '';
    const codes=(check.codes||[]).filter(code=>
      /(?:\.invalid|\.mismatch|\.untrusted|\.revoked|\.expired|\.unsupported|\.outsidevalidity)$/.test(code));
    return codes.length?'Codes SDK : '+codes.join(', '):(check.reason||'');
  };
  return [
    field('Contrôle de confiance officiel',tr(map[official]||'Résultat non disponible'),level(official),detail('official')),
    field('Contrôle de confiance historique',tr(map[legacy]||'Résultat non disponible'),level(legacy),detail('legacy'))
  ];
}

/* Filigrane : déclaration signée dans c2pa.actions / c2pa.actions.v2.
   Ne jamais interpréter l'absence de déclaration comme une analyse des pixels. */
function afpWatermarkDeclaration(photo){
  const manifest=c2paActiveManifest(photo);
  if(!manifest)return {available:false,declared:false,brand:'',technology:'',source:'',description:'',technologySource:''};
  const key=photo?.store?.active_manifest??photo?.store?.activeManifest;
  const stored=key&&photo?.store?.manifests&&!Array.isArray(photo.store.manifests)
    ? photo.store.manifests[key]:null;
  const manifests=[manifest,...(stored&&stored!==manifest?[stored]:[])];
  function decode(value){
    if(typeof value==='string'&&/^\s*[\[{]/.test(value)){
      try{return JSON.parse(value);}catch(_){return null;}
    }
    return value;
  }
  const entries=[];
  for(const current of manifests){
    const assertions=decode(current?.assertions);
    const list=Array.isArray(assertions)?assertions:
      assertions&&typeof assertions==='object'?Object.entries(assertions).map(([label,data])=>({label,data})):[];
    const candidates=list.filter(assertion=>/^(?:c2pa\.)?actions(?:\.v\d+)?(?:__\d+)?$/i.test(
      String(assertion?.label??assertion?.type??assertion?.name??'')));
    const sources=[...candidates.map(a=>decode(a?.data??a?.value??a?.payload??a)),decode(current?.actions)];
    for(const source of sources){
      const actions=Array.isArray(source)?source:source?.actions;
      if(!Array.isArray(actions))continue;
      for(const e of actions){
        const action=decode(e);
        if(!action||typeof action!=='object')continue;
        const code=String(action.action??action.name??'');
        const description=String(action.description??action.details??'');
        const isWatermark=/^c2pa\.watermarked(?:\.[\w-]+)?$/i.test(code) ||
          /(?:synth\s*id|watermark|filigran)/i.test(description);
        if(isWatermark)entries.push({code,description});
      }
    }
  }
  if(!entries.length)return {available:true,declared:false,brand:'',technology:'',source:'',description:'',technologySource:''};
  const signal=entries.find(e=>/synth\s*id/i.test(e.description))??entries[0];
  const signature=signatureOf(manifest);
  // Le SDK renseigne généralement 'issuer', et non 'name', pour le signataire.
  const actor=String(firstValue(signature?.name,signature?.issuer,signature?.signer,
    signature?.organization,manifest?.signer,manifest?.claim_generator,
    manifest?.claimGenerator,sourceLabel(photo))??'');
  const brand=/openai/i.test(actor)?'OpenAI':/google/i.test(actor)?'Google':'';
  const synthDeclared=entries.some(e=>/synth\s*id/i.test(e.description));
  // OpenAI documents SynthID on supported images, but its C2PA action does
  // not name the technology. This is not a pixel-level watermark detection.
  const technology=synthDeclared?'SynthID':brand==='OpenAI'?'SynthID (selon OpenAI)':'';
  const technologySource=synthDeclared?'Mentionné dans le manifeste C2PA':
    brand==='OpenAI'?'Documentation OpenAI ; non précisé dans le manifeste':'';
  return {available:true,declared:true,brand,technology,technologySource,
    source:signal.code,description:signal.description};
}
function afpWatermarkFields(photo){
  const wm=afpWatermarkDeclaration(photo);
  return [
    field('Filigrane invisible',wm.declared?'Filigrane déclaré':wm.available?'Filigrane absent':null,
      'neutral',wm.declared
        ? 'Déclaration C2PA signée ; le filigrane n’est pas détecté dans les pixels par cette galerie.'
        : wm.available?'Aucune déclaration de filigrane dans ce manifeste. Cela ne prouve pas son absence dans les pixels.':''),
    field('Marque',wm.brand||null,'neutral'),
    field('Technologie',wm.technology||null,'neutral',wm.technology?wm.technologySource:''),
    field('Action C2PA',wm.source||null,'neutral'),
    field('Description déclarée',wm.description||null,'neutral')
  ];
}
function afpManifestHistory(photo){
  const manifests=photo.store?.manifests;
  const pairs=Array.isArray(manifests)?manifests.map((m,i)=>[m?.label||String(i),m]):
    manifests&&typeof manifests==='object'?Object.entries(manifests):[];
  if(!pairs.length)return null;
  const active=String(photo.store?.active_manifest||photo.store?.activeManifest||'');
  const rows=pairs.map(([id,m])=>{
    const isActive=id===active;
    const generator=firstValue(m?.claim_generator,m?.claimGenerator,m?.claim_generator_info?.[0]?.name,m?.claimGeneratorInfo?.[0]?.name);
    return field(isActive?'Manifeste actif (version diffusée)':'Manifeste antérieur',
      generator?readable(generator):String(id).slice(0,72),'neutral');
  });
  return section('Historique de provenance',rows);
}
function afpRawManifestFold(photo){
  const pre=document.createElement('pre');pre.textContent=photo.store?JSON.stringify(photo.store,null,2):tr('Informations non disponibles');
  const fold=readerFold('Données techniques du manifeste (JSON)',pre);
  fold.classList.add('afp-reader-raw');
  return fold;
}

/* ---------- Panneau Content Credentials (bouton logo AFP) ---------- */
function fillDetails(photo) {
  const origin=originPanelSection(photo);
  if(photo.state==='loading'){
    setStatusLine('loading',tr('Vérification C2PA en cours…'));
    lbSummary.replaceChildren(origin,readerOpenFold(uiLanguage==='en'?'C2PA verification':'Vérification C2PA',document.createTextNode(tr('Vérification du certificat en cours…'))),afpColorLegend());lbJson.textContent=tr('Chargement…');return;
  }
  if(photo.state==='none'||photo.state==='error'){
    setStatusLine(photo.state==='none'?'none':'error',photo.state==='none'?'Aucun manifeste C2PA intégré détecté.':
      (uiLanguage==='en'?'C2PA analysis unavailable: ':'Analyse C2PA indisponible : ')+String(photo.error||''));
    const support=[];
    if(photo.exif?.artist)support.push(field('Auteur déclaré',photo.exif.artist,'neutral'));
    if(photo.exifDate)support.push(field('Date enregistrée par l’appareil',photo.exifDate,'neutral'));
    lbSummary.replaceChildren(origin,...(photo.cacheStatus?[afpShowCacheBanner(photo)]:[]),readerOpenFold(uiLanguage==='en'?'C2PA verification':'Vérification C2PA',document.createTextNode(tr(photo.state==='none'?'Aucun certificat C2PA détecté dans ce fichier.':'Lecture du certificat C2PA indisponible.'))),...(support.length?[readerFold('Informations sur la photo',section('Informations de production',support))]:[]),afpColorLegend());
    lbJson.textContent=photo.state==='none'?tr('Aucun manifeste trouvé.'):String(photo.error||'');return;
  }
  const entries=photo.validation??[];
  const levels=entries.map(validationLevel);
  const codes=entries.map(v=>String(typeof v==='string'?v:v?.code??v?.status??'').toLowerCase());
  const hasUntrustedSigner=codes.some(c=>/signingcredential\.(?:untrusted|unknown)|signer\.untrusted/.test(c));
  const verifiedTrustSource=['official','legacy'].includes(photo.trustSource) &&
    (photo.validationState==='trusted' || codes.includes('signingcredential.trusted'));
  const failingEntries=entries.filter(e=>validationLevel(e)==='bad');
  const failingCodes=failingEntries.map(e=>String(typeof e==='string'?e:e?.code??e?.status??'').toLowerCase());
  const hasIntegrityFailure=failingCodes.some(c=>/assertion\.datahash\.mismatch|assertion\.bmffhash\.mismatch|assertion\.hasheduri\.mismatch|assertion\.boxhash\.mismatch|hash\.mismatch/.test(c));
  const hasSignatureFailure=failingCodes.some(c=>/claimsignature\.mismatch|claimsignature\.invalid|signature\.invalid/.test(c));
  const a=photo.active??{};
  const sig=signatureOf(a);
  const signer=firstValue(sig.name,sig.issuer,sig.organization,a.signer);
  const generator=firstValue(a.claim_generator,a.claimGenerator,a.claim_generator_info?.[0]?.name,a.claimGeneratorInfo?.[0]?.name);
  const manifest=firstValue(photo.store?.active_manifest,photo.store?.activeManifest);
  const assertions=Array.isArray(a.assertions)?a.assertions:[];
  const metadata=assertions.filter(x=>/metadata|creativework|stds\.schema-org/i.test(String(x?.label??x?.type??'')))
    .map(x=>x?.data??x).filter(x=>x&&typeof x==='object');
  const authorValue=firstValue(a.author,a.creator,...metadata.map(m=>m.author??m.creator));
  function authorName(v){
    if(Array.isArray(v))return v.map(authorName).filter(Boolean).join(', ')||null;
    if(typeof v==='string')return v;
    if(v&&typeof v==='object')return firstValue(v.name,v['@id']);
    return null;
  }
  const c2paAuthor=authorName(authorValue);
  const author=firstValue(c2paAuthor,photo.exif?.artist,photo.exif?.copyright);
  const authorSource=c2paAuthor?'C2PA':photo.exif?.artist?'EXIF Artist':photo.exif?.copyright?tr('EXIF Copyright (crédit déclaré)'):null;

  // The lead status is the GLOBAL photo result, not only certificate trust.
  // A trusted signer can coexist with an untrusted TSA (orange overall).
  const hasTsaWarning=codes.includes('timestamp.untrusted') ||
    codes.includes('timeofsigning.untrusted');
  const hasExpiredCredential=failingCodes.includes('signingcredential.expired');
  let trustLevel='neutral',trustTitle,trustText;
  if(levels.includes('bad')){
    const failingCodes=entries.filter(e=>validationLevel(e)==='bad').map(validationText);
    trustLevel='bad';trustTitle='Une vérification de provenance a échoué.';
    trustText=afpSignerTrustExplanation(signer,'bad',false,photo.trustSource);
    // Give the exact failed SDK checks instead of attributing a failure to a trust list.
    if(failingCodes.length) trustText += '\n\nCodes C2PA en échec : '+failingCodes.join(', ');
    if(hasExpiredCredential) {
      trustTitle=uiLanguage==='en'?'Signing certificate expired — validation failed':'Certificat de signature expiré — validation en échec';
      trustText += uiLanguage==='en'
        ? '\n\nThe SDK reports an expired signing certificate. The available timestamp is not trusted, so the certificate cannot be validated retrospectively. This is not proof that the image pixels were changed.'
        : '\n\nLe SDK signale un certificat de signature expiré. L’horodatage disponible n’étant pas reconnu, la validité du certificat à la date de signature ne peut pas être établie. Cela ne prouve pas que les pixels ont été modifiés.';
    }
    setStatusLine('error','Manifeste présent, mais une ou plusieurs vérifications ont échoué.','bad');
  }else if(verifiedTrustSource){
    // Match the main panel accent to the same global state as the image badge.
    // The independent certificate row below remains green when it is trusted.
    trustLevel=photo.state==='warn'?'warn':photo.trustSource==='official'?'ok':'warn';
    trustTitle=hasTsaWarning
      ? (uiLanguage==='en'?'Signature trusted — timestamp requires review':'Signature reconnue — horodatage à vérifier')
      :photo.trustSource==='official'?'Certificat reconnu (liste officielle C2PA)':'Certificat reconnu (ancienne liste C2PA)';
    trustText=afpSignerTrustExplanation(signer,'ok',false,photo.trustSource);
    if(hasTsaWarning) trustText += uiLanguage==='en'
      ? '\n\nThe signature certificate is trusted, but the timestamp authority is not. This is why the overall image badge is amber, while the certificate check is green.'
      : '\n\nLe certificat de signature est reconnu, mais l’autorité d’horodatage ne l’est pas. La pastille de l’image est donc orange, tandis que le contrôle du certificat reste vert.';
    setStatusLine(trustLevel==='ok'?'ok':'warn',
      hasTsaWarning
        ? (uiLanguage==='en'?'Signature trusted; timestamp authority not trusted.':'Signature reconnue ; autorité d’horodatage non reconnue.')
        : trustLevel==='ok'?'Contrôles C2PA retournés sans problème signalé. Cela ne prouve pas la véracité de la scène.':'Manifeste présent, mais la confiance du signataire nécessite une vérification.');
  }else if(photo.trustSource==='untrusted' || hasUntrustedSigner){
    trustLevel='warn';trustTitle=photo.trustSource==='untrusted'?'Certificat non reconnu par les deux listes':'Certificat numérique à vérifier';
    trustText=afpSignerTrustExplanation(signer,'warn',true,photo.trustSource);
    setStatusLine('warn','Manifeste présent, mais la confiance du signataire nécessite une vérification.');
  }else{
    trustLevel='warn';trustTitle=photo.trustSource==='unavailable'?'Contrôle des listes de confiance indisponible':
      photo.trustSource==='incomplete'?'Contrôle des listes de confiance incomplet':'Vérification à confirmer';
    trustText=afpSignerTrustExplanation(signer,'warn',false,photo.trustSource);
    setStatusLine('warn','Manifeste présent, mais la validation complète ne peut pas être confirmée.');
  }
  const trust=document.createElement('section');trust.className='afp-reader-trust';trust.dataset.level=trustLevel;
  trust.setAttribute('aria-label',tr('Qui a signé ces informations ?'));
  const trustH=document.createElement('h3');trustH.className='afp-reader-trust-title';trustH.textContent=tr(trustTitle);
  const trustP=readerFold('Comprendre le certificat',afpTrustExplanationNode(trustText));
  trustP.classList.add('afp-reader-trust-more');
  const signerP=document.createElement('div');signerP.className='afp-reader-signer';
  const by=document.createElement('span');by.textContent=tr('Signé par')+' : ';
  const signerName=document.createElement('strong');signerName.textContent=signer?readable(signer):tr('Signataire non identifié');
  const fourChecks=afpFourChecks(photo);
  const quick=afpFourCheckPanel(fourChecks);
  const colorExplanation=afpVisibleC2paColorExplanation(photo,fourChecks);
  const extraFailure=entries.filter(entry=>validationLevel(entry)==='bad'&&
    !/^(?:assertion\.(?:datahash|hasheduri|bmffhash|boxhash|boxeshash)\.|claimsignature\.|signingcredential\.)/i.test(String(entry?.code??entry?.status??'')));
  if(extraFailure.length){
    const p=document.createElement('p');p.className='afp-reader-other-failure';
    p.textContent=uiLanguage==='en'
      ?'Other C2PA check(s) failed — see technical verification details.'
      :'Autre contrôle C2PA en échec — voir les détails techniques.';
    quick.append(p);
  }
  signerP.append(by,signerName);trust.append(trustH,signerP,quick,colorExplanation,trustP);
  afpAppendTrustSourceNote(trust,photo);
  // Pas de recherche par simple nom de fabricant : un nom dans la liste ne valide pas la chaîne.

  const photoInfo=[];
  if(author)photoInfo.push(field('Auteur déclaré',`${author}${authorSource?' : '+authorSource:''}`,'neutral'));
  if(photo.exifDate)photoInfo.push(field('Date enregistrée par l’appareil',photo.exifDate,'neutral'));
  const detail=c2paSourceDetails(photo);
  if(detail.cameraModel)photoInfo.push(field('Appareil identifié',detail.cameraModel,'neutral'));
  const photoFold=photoInfo.length?readerFold('Informations sur la photo',section('Informations de production',photoInfo)):null;

  const validationList=document.createElement('div');validationList.className='validation-list';
  if(entries.length){
    // Regrouper l'affichage par code ET gravité sans perdre les résultats bruts.
    const grouped=new Map();
    for(const entry of entries){
      const level=validationLevel(entry),name=String(validationText(entry));
      const id=level+'|'+name;
      if(!grouped.has(id))grouped.set(id,{level,name,count:0});
      grouped.get(id).count++;
    }
    for(const {level,name,count} of grouped.values()){
      const item=document.createElement('div');item.className='validation-item';
      const marker=document.createElement('span');marker.className='signal '+level;
      marker.textContent=level==='ok'?'✓':level==='warn'?'!':level==='bad'?'×':'i';
      const code=document.createElement('span');
      code.textContent=name+(count>1?' × '+count:'');
      if(count>1)code.title=count+' contrôles distincts (détails conservés dans le JSON)';
      const badge=document.createElement('span');badge.className='validation-pill '+level;
      badge.textContent=tr(level==='ok'?'Validé':level==='warn'?'À vérifier':level==='bad'?'Échec':'Indéterminé');
      item.append(marker,code,badge);validationList.append(item);
    }
  }else{
    const empty=document.createElement('p');empty.textContent=tr('Aucun résultat détaillé retourné.');empty.style.padding='12px';validationList.append(empty);
  }
  // N'attribuer du vert qu'à un contrôle effectivement communiqué comme réussi.
  // La simple absence de code d'échec ne suffit pas à déclarer une validation.
  const hasCode=(pattern)=>codes.some(code=>pattern.test(code));
  const integrityOk=hasCode(/^(?:assertion\.(?:datahash|bmffhash|boxhash|hasheduri)\.match)$/) || photo.validationState==='trusted';
  const signatureOk=hasCode(/^claimsignature\.validated$/) || photo.validationState==='trusted';
  const certificateOk=hasCode(/^signingcredential\.trusted$/);
  const certificateBad=failingCodes.some(c=>/^(?:signingcredential\.(?:ocsp\.revoked|invalid|expired|mismatch)|claimsignature\.outsidevalidity)$/.test(c));
  const integrityStatus=hasIntegrityFailure?'bad':integrityOk?'ok':'neutral';
  const signatureStatus=hasSignatureFailure?'bad':signatureOk?'ok':'neutral';
  const certificateStatus=certificateBad?'bad':photo.trustSource==='legacy'?'warn':verifiedTrustSource?'ok':trustLevel==='warn'?'warn':'neutral';
  const tsaValidated=hasCode(/^timestamp\.validated$/);
  const tsaTrusted=hasCode(/^timestamp\.trusted$/);
  const tsaIssue=hasCode(/^timestamp\.(?:mismatch|invalid|untrusted|outsidevalidity)$/);
  const tsaStatus=tsaIssue?'warn':(tsaValidated&&tsaTrusted)?'ok':tsaValidated?'warn':'neutral';
  const pIntro=document.createElement('p');pIntro.className='afp-reader-technical-intro';
  pIntro.textContent=tr('Ces vérifications portent sur les informations C2PA et leur signature, pas sur la réalité de la scène photographiée.');
  const pTsa=document.createElement('p');pTsa.className='afp-reader-technical-date';
  const tsaTitle=document.createElement('strong');tsaTitle.textContent=tr('Horodatage TSA et date de prise de vue')+' : ';
  pTsa.append(tsaTitle,document.createTextNode(tr('Une heure TSA validée certifie la date de signature. Elle ne remplace pas la date de prise de vue enregistrée par l’appareil (EXIF).')));
const rawIntro=document.createElement('p');rawIntro.className='afp-reader-technical-intro';
rawIntro.textContent=tr('Cette partie présente les résultats renvoyés par le vérificateur. Une information absente ne signifie pas automatiquement un échec.');
const rawFields=[
  field('Signataire déclaré',signer,'neutral',tr('Signataire déclaré dans le certificat. Ce nom seul ne confirme pas son identité.')),
  field('Générateur',generator,'neutral',tr('Appareil ou logiciel ayant créé le manifeste C2PA.')),
  field('Identifiant du manifeste',manifest,'neutral')
];
const technical=readerFold('Détails de vérification (technique)',
  pIntro,
  section('Contrôles de sécurité',[
    field('Intégrité du fichier',tr(hasIntegrityFailure?'Différence détectée':integrityOk?'Données signées conformes':'Résultat explicite non communiqué'),integrityStatus,tr('Compare le fichier aux empreintes protégées par les Content Credentials.')),
    field('Signature cryptographique',tr(hasSignatureFailure?'Signature incorrecte':signatureOk?'Signature vérifiée':'Résultat explicite non communiqué'),signatureStatus,tr('Vérifie que la signature cryptographique correspond aux données du manifeste.')),
    field('Confiance dans le certificat',tr(certificateBad?'Certificat ou validation en échec':verifiedTrustSource?
      (photo.trustSource==='official'?'Certificat reconnu (liste officielle C2PA)':'Certificat reconnu (ancienne liste C2PA)'):
      photo.trustSource==='untrusted'?'Certificat non reconnu par les deux listes':
      photo.trustSource==='unavailable'?'Contrôle des listes de confiance indisponible':
      photo.trustSource==='incomplete'?'Contrôle des listes de confiance incomplet':
      'Vérification à confirmer'),certificateStatus,tr('Vérifie si la chaîne du certificat mène à une autorité de confiance reconnue.')),
    field('Horodatage TSA',tr(tsaStatus==='ok'?'Horodatage certifié et reconnu':tsaIssue?'Horodatage à vérifier':tsaValidated?'Horodatage valide, confiance à confirmer':'Aucun contrôle TSA confirmé'),tsaStatus)
  ]),
  section('Listes de confiance C2PA',afpTrustListFields(photo)),
  pTsa,
  ...(afpManifestHistory(photo)?[afpManifestHistory(photo)]:[]),
  section('Informations du manifeste',rawFields),
  section('Filigrane invisible (déclaration C2PA)',afpWatermarkFields(photo)),
  rawIntro,
  section('Résultats de validation C2PA',[validationList])
);
technical.classList.add('afp-reader-technical-flat');
const trustLabel=(uiLanguage==='en'?'C2PA verification — ':'Vérification C2PA — ')+
  (signer?String(signer):tr('Signataire non identifié'));
const trustFold=readerOpenFold(trustLabel,trust,afpRawManifestFold(photo));
trustFold.classList.add('afp-reader-active-verification');
const otherSignatures=afpHistoricalSignaturePanels(photo);
lbSummary.replaceChildren(origin,...(photo.cacheStatus?[afpShowCacheBanner(photo)]:[]),
  trustFold,...otherSignatures,...(photoFold?[photoFold]:[]),technical,afpColorLegend());
  lbJson.textContent=JSON.stringify(photo.store,null,2);
}

/* Mise en page du visualiseur avec panneau ouvert : photo entière, jamais masquée. */
const afpPanelFitStyle = document.createElement('style');
afpPanelFitStyle.id = 'afp-panel-fit-photo-style';
afpPanelFitStyle.textContent = `
  #lightbox .lb-stage {
    transition: right .24s ease, padding .24s ease;
  }
  @media (min-width: 901px) {
    #lightbox.afp-panel-open {
      --afp-panel-width: min(510px, 100vw);
    }
    #lightbox.afp-panel-open .lb-stage {
      /* On réserve exactement la largeur du panneau à droite de la photo. */
      left: 0!important;
      right: var(--afp-panel-width)!important;
      width: auto!important;
      box-sizing: border-box!important;
      padding: 64px clamp(22px, 3.6vw, 72px)!important;
      display: flex!important;
      align-items: center!important;
      justify-content: center!important;
      transition: right .24s ease, padding .24s ease!important;
    }
    #lightbox.afp-panel-open .lb-photo-column {
      flex: 0 1 auto!important;
      min-width: 0!important;
      max-width: 100%!important;
      max-height: 100%!important;
    }
    #lightbox.afp-panel-open .lb-photo-column .lb-frame {
      min-width: 0!important;
      max-width: 100%!important;
      max-height: calc(100dvh - 185px)!important;
    }
    #lightbox.afp-panel-open .lb-photo-column .lb-frame > #lb-photo {
      /* Une réduction proportionnelle, jamais un recadrage. */
      display: block!important;
      width: auto!important;
      height: auto!important;
      max-width: 100%!important;
      max-height: calc(100dvh - 185px)!important;
      object-fit: contain!important;
    }
    #lightbox.afp-panel-open .nav.next {
      right: calc(var(--afp-panel-width) + 12px)!important;
    }
  }
  @media (max-width: 900px) {
    /* Pas de place pour deux colonnes : garder l'affichage mobile existant. */
    #lightbox.afp-panel-open:not(.direct-layout) .lb-stage {
      right: 0!important;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    #lightbox.afp-panel-open .lb-stage {transition: none!important;}
  }
`;
document.head.appendChild(afpPanelFitStyle);

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
  const sideJson=document.querySelector('#side-json');if(sideJson)sideJson.textContent=lbJson.textContent;
  if (!bottomSheet.hidden && bottomPhoto === photo) refreshBottomSheet(photo);
}
function openSidePanel(photo) {
  sidePhoto = photo;
  sidePanel.hidden = false;
  lightbox.classList.add('afp-panel-open');
  refreshSidePanel(photo);
  // Si l'analyse est encore en cours, le panneau sera rafraîchi à sa fin.
}
document.querySelector('#side-close').addEventListener('click', () => { sidePanel.hidden = true; sidePhoto = null; sidePanel.classList.remove('direct-visible'); lightbox.classList.remove('direct-layout', 'afp-panel-open'); });

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
lightbox.addEventListener('close', () => { currentIdx = -1; lightbox.classList.remove('afp-panel-open'); sidePanel.hidden = true; sidePhoto = null; if (credentials.open) credentials.close(); });
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
  const bottomJson=document.querySelector('#bottom-json');if(bottomJson)bottomJson.textContent=lbJson.textContent;
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

/* AFP : architecture trois niveaux : origine/certificat, photo, vérification complète. */
const afpReaderV4Style=document.createElement('style');
afpReaderV4Style.textContent=`
  #side-panel .afp-reader-trust-more, #credentials .afp-reader-trust-more,
  .bottom-sheet .afp-reader-trust-more{margin:10px 0 0!important;border-color:rgba(138,163,193,.28)!important}
  #side-panel .afp-reader-trust-more > summary, #credentials .afp-reader-trust-more > summary,
  .bottom-sheet .afp-reader-trust-more > summary{font-size:11px!important;font-weight:600!important;opacity:.85!important;min-height:31px!important}
  .afp-reader-trust .afp-reader-signer{margin-top:5px!important;padding-top:7px!important}
  .afp-reader-quickchecks{display:flex;gap:6px;flex-wrap:wrap;margin:9px 0 3px}
  .afp-reader-mini-check{display:inline-flex;align-items:center;gap:5px;
    font-size:11px;line-height:1.4;padding:5px 7px;border:1px solid rgba(147,162,183,.26);
    border-radius:7px;color:var(--trust-text);background:rgba(17,28,42,.1)}
  .afp-reader-mini-check b{display:inline-grid;place-items:center;font-size:11px;
    width:14px;height:14px;border-radius:50%;background:#8293aa;color:white}
  .afp-reader-mini-check.ok b{background:#278c60}
  .afp-reader-mini-check.bad b{background:#ce4b55}

  .afp-reader-technical-flat > .afp-reader-fold-body > .credential-section{
    margin:10px 0 15px!important;
  }
  .afp-reader-technical-flat > .afp-reader-fold-body > .credential-section h3{
    font-size:12px!important;font-weight:750!important;letter-spacing:.01em;margin:0 0 7px!important;
  }
  .afp-reader-technical-flat .validation-list{max-height:none!important;overflow:visible!important}
  .afp-reader-technical-flat .validation-item{gap:7px!important;padding:9px 8px!important;flex-wrap:wrap!important}
  .afp-reader-technical-flat .validation-item span:nth-child(2){font-size:11.5px!important}
  .afp-reader-technical-flat .validation-pill{font-size:10px!important}
  .afp-reader-raw > .afp-reader-fold-body pre{max-height:400px!important;white-space:pre-wrap!important;
    overflow-wrap:anywhere!important;font:11px/1.5 ui-monospace,SFMono-Regular,monospace!important}
  .afp-reader-fold.afp-reader-legend{margin-top:15px!important}
  .afp-reader-about{margin-bottom:14px!important}
  .afp-reader-trust-more .afp-reader-fold-body{padding:9px 10px!important}
`;
afpReaderV4Style.textContent += "\n/* Résumé C2PA : quatre axes autonomes, avec explications natives\n   accessibles au clavier et conservées lors du clonage des panneaux. */\n.afp-reader-fourchecks{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:11px 0}\n.afp-reader-check-card{min-width:0;padding:9px;border:1px solid rgba(147,162,183,.3);\n  border-radius:9px;background:rgba(17,28,42,.12);color:var(--trust-text)}\n.afp-reader-check-top{display:flex;align-items:center;gap:7px;min-width:0}\n.afp-reader-check-glyph{display:grid;place-items:center;flex:0 0 17px;width:17px;height:17px;\n  font-size:11px;font-weight:750;line-height:1;border-radius:50%;background:#8293aa;color:white}\n.afp-reader-check-glyph.ok{background:#278c60}\n.afp-reader-check-glyph.warn{background:#ce921d;color:#231b0c}\n.afp-reader-check-glyph.bad{background:#ce4b55}\n.afp-reader-check-words{min-width:0;display:flex;flex:1;flex-direction:column;gap:2px}\n.afp-reader-check-words strong{font-size:11px;line-height:1.3;overflow-wrap:anywhere}\n.afp-reader-check-status{font-size:10.5px;opacity:.86}\n.afp-reader-check-info{position:relative;flex:0 0 auto;margin:0!important;padding:0!important;border:0!important}\n.afp-reader-check-info > summary{list-style:none;display:grid;place-items:center;width:19px;height:19px;\n  font-size:12px!important;font-weight:750!important;line-height:1!important;cursor:pointer;border-radius:50%;\n  color:var(--trust-text);background:rgba(130,150,175,.22);border:1px solid rgba(170,187,207,.42)}\n.afp-reader-check-info > summary::-webkit-details-marker{display:none}\n.afp-reader-check-info > summary:focus-visible{outline:2px solid #7bb2ff;outline-offset:2px}\n.afp-reader-check-info > p{position:absolute;top:24px;right:0;z-index:25;min-width:195px;\n  max-width:min(255px,80vw);margin:0!important;padding:9px 10px;border:1px solid #546982;\n  border-radius:9px;background:#182435;color:#f2f5fa;font-size:11px;line-height:1.48;\n  font-weight:400;box-shadow:0 10px 25px #0008}\n.afp-reader-historical-notice{font-size:12px;line-height:1.5;margin:8px 0 10px;color:#acb9c9}\n.afp-reader-historical-id{font-size:10px;overflow-wrap:anywhere;opacity:.7}\n.afp-reader-historical-signature .afp-reader-fourchecks{margin:10px 0}\n.afp-reader-other-failure{grid-column:1 / -1;padding:9px;border:1px solid #d97676;border-radius:7px;\n  color:#ffb3b3;font-size:11px}\n@media(max-width:360px){.afp-reader-fourchecks{grid-template-columns:1fr}}\n";
afpReaderV4Style.textContent += ".afp-reader-color-explanation{margin:10px 0!important;padding:9px 11px;border-radius:9px;border:1px solid rgba(164,178,195,.28);font-size:11.5px;line-height:1.55;background:rgba(17,28,42,.11);color:var(--trust-text)}\n.afp-reader-color-explanation strong{font-weight:800}\n.afp-reader-color-explanation.ok strong{color:#81e1aa}\n.afp-reader-color-explanation.warn strong{color:#f3c766}\n.afp-reader-color-explanation.bad strong{color:#ff9f9f}";
afpReaderV4Style.textContent += "\n.afp-reader-check-card{position:relative}\n.afp-reader-check-words{padding-right:21px}\n.afp-reader-check-card .afp-reader-check-info{position:static!important;margin:0!important;padding:0!important}\n.afp-reader-check-card .afp-reader-check-info > summary{position:absolute!important;right:9px;top:10px;z-index:2}\n.afp-reader-check-card .afp-reader-check-info > p{position:static!important;min-width:0!important;max-width:none!important;margin:10px 0 0!important;padding:8px 9px!important;\n  box-shadow:none!important;border-radius:6px!important;font-size:11px!important;line-height:1.45!important}\n";
document.head.append(afpReaderV4Style);
