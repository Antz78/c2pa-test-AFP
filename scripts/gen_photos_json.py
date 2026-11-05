#!/usr/bin/env python3
"""Génère photos.json (index de PHOTOS/) pour GitHub Pages.
Exécuté automatiquement par .github/workflows/gallery.yml à chaque push.
Aucune dépendance, uniquement la bibliothèque standard."""
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PHOTOS = os.path.join(ROOT, "PHOTOS")
OUT = os.path.join(ROOT, "photos.json")
IMAGE_RE = re.compile(r"\.(jpe?g|png|webp|tiff?)$", re.IGNORECASE)

names = sorted(
    n for n in os.listdir(PHOTOS)
    if os.path.isfile(os.path.join(PHOTOS, n)) and IMAGE_RE.search(n)
) if os.path.isdir(PHOTOS) else []

with open(OUT, "w", encoding="utf-8") as f:
    json.dump({"photos": [f"./PHOTOS/{n}" for n in names]}, f, indent=2, ensure_ascii=False)
    f.write("\n")
print(f"photos.json : {len(names)} photo(s)")
