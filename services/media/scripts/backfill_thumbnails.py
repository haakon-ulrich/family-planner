"""Backfill missing artist thumbnail_url fields in data/artists.json.

Run from services/media/:
    uv run python scripts/backfill_thumbnails.py

Skips artists that already have a thumbnail_url set.
"""

import json
import sys
from pathlib import Path

# Allow imports from services/media/ root.
sys.path.insert(0, str(Path(__file__).parent.parent))

from services.catalog_service import _best_thumbnail, _get_yt

DATA_PATH = Path(__file__).parent.parent / "data" / "artists.json"


def main() -> None:
    artists: list[dict[str, str]] = json.loads(DATA_PATH.read_text())
    yt = _get_yt()
    changed = 0

    for artist in artists:
        if artist.get("thumbnail_url"):
            print(f"  skip  {artist['name']} (already set)")
            continue
        print(f"  fetch {artist['name']}…", end=" ", flush=True)
        info = yt.get_artist(artist["id"])
        artist["thumbnail_url"] = _best_thumbnail(info.get("thumbnails") or [])
        print(artist["thumbnail_url"][:70] + "…")
        changed += 1

    if changed:
        DATA_PATH.write_text(json.dumps(artists, indent=2, ensure_ascii=False) + "\n")
        print(f"\nUpdated {changed} artist(s) — {DATA_PATH}")
    else:
        print("\nNothing to update.")


if __name__ == "__main__":
    main()
