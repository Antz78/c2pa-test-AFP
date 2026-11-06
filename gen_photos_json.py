#!/usr/bin/env python3
"""Indexe les images de PHOTOS/, y compris les PNG et les sous-dossiers.

Usage dans .github/workflows/gallery.yml (inchangé) :
    python scripts/gen_photos_json.py

Les segments des URL sont encodés : espaces, accents, #, ? et % sont pris en charge.
"""
from pathlib import Path
from urllib.parse import quote
import json

ROOT = Path(__file__).resolve().parent.parent
PHOTOS = ROOT / "PHOTOS"
OUT = ROOT / "photos.json"
EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".tif", ".tiff"}

paths = sorted(
    (path.relative_to(ROOT) for path in PHOTOS.rglob("*")
     if path.is_file() and path.suffix.lower() in EXTENSIONS),
    key=lambda p: str(p).casefold(),
) if PHOTOS.is_dir() else []

# quote chaque fragment, mais pas les séparateurs des répertoires.
urls = ["./" + "/".join(quote(segment, safe="") for segment in path.parts)
        for path in paths]
OUT.write_text(json.dumps({"photos": urls}, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
print(f"photos.json : {len(paths)} photo(s), dont {sum(p.suffix.lower() == '.png' for p in paths)} PNG")
