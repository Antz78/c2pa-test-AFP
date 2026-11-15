# Audit technique de la galerie AFP C2PA

Date : 15 novembre 2026. Périmètre : lecteur JavaScript statique et validation dans le navigateur.
Norme de référence : [C2PA 2.5](https://spec.c2pa.org/specifications/specifications/2.5/specs/C2PA_Specification.html), notamment la section 14.
Moteur cryptographique : `@contentauth/c2pa-web@0.17.0` (SDK WebAssembly officiel).

## Ce que le lecteur vérifie

1. Le SDK lit les octets de l'image et ses manifestes C2PA. Il valide les signatures cryptographiques, les assertions, les empreintes et les liens avec les données du fichier selon les contrôles applicables.
2. Le contexte de validation utilise les racines de la liste officielle C2PA. Une liste historique est évaluée séparément, sans se substituer silencieusement à la liste officielle. Les résultats de chaque consultation restent distincts.
3. Les ancres TSA proviennent de la liste C2PA dédiée aux autorités d'horodatage. Un horodatage valide, mais d'autorité non reconnue, est affiché en orange et ne devient pas un échec d'intégrité.
4. Les entrées `validation_results.activeManifest` et `ingredientDeltas` sont distinctes. Les échecs actuels d'ingrédients peuvent bloquer le statut global ; les entrées informatives ne le rendent pas artificiellement orange.
5. Pour une signature antérieure Nikon, les quatre indicateurs reposent sur les résultats historiques `ingredient.validation_results.activeManifest` **enregistrés lors de l'incorporation par le signataire suivant**. Ils ne sont pas présentés comme un audit cryptographique indépendant exécuté aujourd'hui. Lorsque le SDK retourne `ingredient.claimSignature.validated` dans `ingredientDeltas`, la validation actuelle du **lien** de signature est indiquée séparément.
6. Les affirmations d'origine (`digitalSourceType`) sont distinctes de la confiance dans la signature ; aucune signature C2PA ne prouve que la scène photographiée est vraie.

## Couleurs de l'interface

- **Vert** : résultat positif explicitement renvoyé par le SDK, et confiance applicable établie.
- **Orange** : provenance présente, mais certificat, TSA ou identité CAWG non reconnu, validation incomplète ou élément inaccessible. « Non reconnu » n'est pas synonyme de « cryptographiquement faux ».
- **Rouge** : échec applicable de signature, de données signées, de structure ou d'un autre contrôle C2PA bloquant réellement retourné par le SDK. Exemple : `claim.missing`.
- **Gris** : déclaration présente, contrôle non exécuté ou résultat non confirmé. Les codes informatifs ne deviennent pas arbitrairement verts.

Le statut général peut être rouge pour un contrôle hors des quatre cartes résumées. Le détail conserve alors le code précis d'échec.

## Données photographiques affichées

Le lecteur affiche les champs suivants, **avec intitulés conservés et valeurs vides si absentes** : auteur, lieu, date de prise de vue, source, crédit, appareil, GPS, légende.

Sources : déclarations structurées du manifeste actif C2PA, EXIF, IPTC-IIM et XMP du fichier, avec mention de leur origine. Le copyright n'est **jamais** utilisé comme auteur par défaut. Pour une version AFP avec EXIF Nikon expurgé, les données IPTC du JPEG final peuvent fournir auteur, ville, pays, date, source et crédit. Les métadonnées de la version Nikon antérieure ne sont pas automatiquement attribuées à la version AFP finale.

Une information de prise de vue EXIF ou IPTC n'est **pas** la date de signature TSA. L'IPTC Date Created est explicitement identifié comme tel. Les métadonnées non signées sont des déclarations non vérifiées. Si la validation C2PA est en échec, une mise en garde précède les attributions.

## Traçabilité et limites actuelles

- Les empreintes SHA-256 des fichiers PEM de confiance consultés (officiels, historiques, TSA) et leur date de récupération sont conservées en contexte technique et avec les résultats de cache.
- La consultation réseau **OCSP est désactivée** (`ocspFetch:false`), afin de ne pas introduire de dépendance réseau bloquante dans ce lecteur web. Le statut de révocation en ligne n'est donc pas confirmé par un accès OCSP live ; le rapport le signale explicitement.
- La présence déclarée d'un filigrane (SynthID / `c2pa.watermarked.unbound`) **n'est pas une détection dans les pixels**.
- Les manifestes externes, formats non couverts par les fichiers de test, tous les profils C2PA futurs, la conformité CAWG étendue et les chaînes atypiques demandent des tests supplémentaires.
- Un résultat mémorisé dans le navigateur n'est pas présenté comme une nouvelle vérification.
- Le présent audit est un audit du lecteur et de sa restitution. **Il n'est pas une certification officielle de conformité C2PA ni une validation éditoriale AFP des scènes.**

## Suite de régression

La workflow GitHub Actions `.github/workflows/c2pa-engine-test.yml` utilise Playwright Chromium et la version figée du SDK.

Cas actuellement testés :
- Google Pixel, Google Media Processing Services, OpenAI SSL.com/Trufo.
- Nikon original et deux versions AFP (expurgation EXIF, expurgation de vignette).
- Fichier signé original, JPEG altéré dans ses données de scan, PNG non signé.
- Attribution du certificat AFP, états des quatre cartes et affichage du manifeste historique Nikon.
- Métadonnées IPTC (auteur, lieu, date, source, crédit), champs absents laissés vides.
- Codes de validation C2PA (dont `claim.missing`, `signingCredential.untrusted`, `cawg.x509.credential.untrusted`, `timeStamp.untrusted`).
- Empreintes des listes de confiance dans les détails du rapport.

## Contrôles complémentaires possibles

Pour aller au-delà de ce niveau, comparer systématiquement les verdicts à la bibliothèque native `c2pa-rs` et à d'autres lecteurs indépendants, élargir le corpus de fichiers modifiés, malformés et à manifestes distants, puis étudier un service de vérification OCSP côté serveur avec gestion du réseau, des erreurs et de la confidentialité.
