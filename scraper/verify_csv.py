"""
verify_csv.py
=============
Run this after scrape_ysma.py to check data quality before
importing into Supabase.

USAGE:
    python verify_csv.py

CHECKS:
    - Total row count
    - How many rows have each field populated
    - Flags rows with suspiciously short descriptions (< 50 chars)
    - Prints 3 sample rows for manual review
"""

import csv
from pathlib import Path

CSV_FILE = Path("data/artworks.csv")

def verify():
    if not CSV_FILE.exists():
        print(f"ERROR: {CSV_FILE} not found. Run scrape_ysma.py first.")
        return

    rows = []
    with open(CSV_FILE, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    total = len(rows)
    print(f"\n{'='*60}")
    print(f"ARTWORKS CSV VERIFICATION REPORT")
    print(f"{'='*60}")
    print(f"Total rows: {total}")
    print()

    # Field coverage
    fields = ["title", "artist", "year", "medium", "description",
              "artist_bio", "location", "period", "provenance"]
    
    print("FIELD COVERAGE:")
    for field in fields:
        filled = sum(1 for r in rows if r.get(field, "").strip())
        pct = (filled / total * 100) if total else 0
        bar = "█" * int(pct / 5) + "░" * (20 - int(pct / 5))
        print(f"  {field:<15} {bar} {filled}/{total} ({pct:.0f}%)")

    # Warn on short descriptions
    print()
    print("QUALITY WARNINGS:")
    short_desc = [r for r in rows if 0 < len(r.get("description", "")) < 50]
    empty_desc  = [r for r in rows if not r.get("description", "").strip()]
    short_bio   = [r for r in rows if 0 < len(r.get("artist_bio", "")) < 50]
    empty_bio   = [r for r in rows if not r.get("artist_bio", "").strip()]

    if short_desc:
        print(f"  ⚠  {len(short_desc)} rows have very short descriptions (< 50 chars)")
    if empty_desc:
        print(f"  ⚠  {len(empty_desc)} rows have empty descriptions — RAG quality risk")
    if short_bio:
        print(f"  ⚠  {len(short_bio)} rows have very short artist bios")
    if empty_bio:
        print(f"  ⚠  {len(empty_bio)} rows have empty artist bios — acceptable for some works")
    
    if not (short_desc or empty_desc or short_bio):
        print("  ✓  No quality issues detected")

    # Sample rows
    print()
    print("SAMPLE ROWS (3 random):")
    import random
    samples = random.sample(rows, min(3, total))
    for i, row in enumerate(samples, 1):
        print(f"\n  [{i}] {row.get('title', '(no title)')}")
        print(f"      Artist:  {row.get('artist', '')}")
        print(f"      Year:    {row.get('year', '')}")
        print(f"      Medium:  {row.get('medium', '')}")
        print(f"      Bio:     {row.get('artist_bio', '')[:100]}...")
        print(f"      Desc:    {row.get('description', '')[:100]}...")

    print(f"\n{'='*60}")
    print("If coverage looks good (>80% for title/artist/description),")
    print("import artworks.csv into Supabase via Table Editor.")
    print(f"{'='*60}\n")

if __name__ == "__main__":
    verify()
