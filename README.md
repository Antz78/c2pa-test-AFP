# Galerie photo · Content Credentials (C2PA)

Galerie **100 % statique** : fonctionne sur GitHub Pages, sans serveur Python ni backend.
Glissez des photos dans le dossier `PHOTOS/` du repo, poussez — la galerie se met à jour.

## Contenu

| Fichier | Rôle |
|---|---|
| `index.html` | Interface : grille de vignettes, filtres, recherche, lightbox, zone de glisser-déposer |
| `app.js` | Logique : lecture C2PA de chaque photo (SDK 0.15.4), glisser-déposer, index `photos.json` |
| `photos.json` | Index des photos — **généré automatiquement** par le workflow GitHub Action |
| `.github/workflows/gallery.yml` | Régénère `photos.json` et publie sur GitHub Pages à chaque push |
| `scripts/gen_photos_json.py` | Script de génération de l'index (aucune dépendance) |
| `PHOTOS/` | Votre dossier de photos (JPEG, PNG, WebP, TIFF) |

## Mode 1 — GitHub Pages (automatique)

1. Créez un repo public et poussez tout ce dossier dedans.
2. Réglages du repo → **Pages** → Source : **GitHub Actions**.
3. Poussez vos photos dans `PHOTOS/` :

```bash
git add PHOTOS/
git commit -m "Ajout de photos"
git push
```

À chaque push, le workflow régénère `photos.json` et redéploie la galerie.
Vos photos apparaissent automatiquement, avec leur manifeste C2PA analysé dans
le navigateur de chaque visiteur (fichier original, non ré-encodé).

## Mode 2 — Local / sans push : glisser-déposer

Ouvrez simplement `index.html` (ou la page GitHub Pages vide) et **glissez votre
dossier `PHOTOS/` ou des photos directement sur la page**. Tout se passe en local
dans le navigateur : les photos ne sont envoyées nulle part. Parfait pour vérifier
des certificats sans publier les images.

## Fonctionnalités

- Grille dynamique type masonry, chargement différé (lazy).
- Badge par photo : ✓ Signée · ⚠ Validée avec problèmes · Sans CR · Erreur.
- Filtres et recherche par nom de fichier.
- Lightbox plein écran : photo agrandie, flèches de navigation fixes (indépendantes
  de l'image), et **badge logo AFP** en bas à droite de la photo (50 % de
  transparence, 100 % au survol) qui ouvre le panneau Content Credentials
  (titre, générateur, signataire, date, résultats de validation + manifeste
  JSON complet).
- Navigation clavier : ← → pour changer de photo, Échap pour fermer.
- Analyse parallèle limitée à 3 photos simultanées.

## Notes

- Le manifeste C2PA est lu dans le fichier original via WebAssembly
  (SDK `@contentauth/c2pa-web` 0.15.4 depuis jsDelivr — connexion requise).
- La présence d'un manifeste ne garantit pas que le signataire soit reconnu
  comme fiable : vérifiez les résultats de validation affichés.
