"""
patch_images.py
===============
Reads your existing artworks.csv, visits each source_url,
extracts the artwork image URL, and writes a new CSV with
the image_url column added.

USAGE:
    python patch_images.py

INPUT:  data/artworks.csv      (your existing scraped data)
OUTPUT: data/artworks_v2.csv   (same data + image_url column)

Takes ~5 minutes for 150 artworks.
"""

import csv
import time
import re
from pathlib import Path
from playwright.sync_api import sync_playwright, Page

INPUT_FILE  = Path("data/artworks.csv")
OUTPUT_FILE = Path("data/artworks_v2.csv")
DELAY       = 2.0  # seconds between requests


def get_image_url(page: Page, source_url: str) -> str:
    """
    Visit one artwork page and extract the main image URL.
    Google serves artwork images from lh3.googleusercontent.com.
    We grab the largest one and request it at s1200 resolution.
    """
    try:
        page.goto(source_url, wait_until="domcontentloaded", timeout=30000)
        time.sleep(3)

        # Try multiple selectors — Google's class names change,
        # but the image source domain is always googleusercontent.com
        img = None

        # Strategy 1: largest img with googleusercontent src
        imgs = page.query_selector_all("img[src*='googleusercontent']")
        if imgs:
            # Pick the one most likely to be the artwork (not a thumbnail)
            # Heuristic: longest src URL tends to be the main image
            candidates = []
            for i in imgs:
                src = i.get_attribute("src") or ""
                if src:
                    candidates.append(src)
            if candidates:
                # Sort by length descending — main image URL tends to be longest
                candidates.sort(key=len, reverse=True)
                img_src = candidates[0]
                # Bump resolution to s1200
                img_src = re.sub(r'=s\d+.*$', '=s1200', img_src)
                img_src = re.sub(r'=w\d+-h\d+.*$', '=s1200', img_src)
                return img_src

        # Strategy 2: look for og:image meta tag (often has the artwork image)
        og_image = page.get_attribute('meta[property="og:image"]', "content")
        if og_image:
            og_image = re.sub(r'=s\d+.*$', '=s1200', og_image)
            return og_image

        return ""

    except Exception as e:
        print(f"    Warning: {e}")
        return ""


def patch():
    if not INPUT_FILE.exists():
        print(f"ERROR: {INPUT_FILE} not found.")
        return

    # Read all existing rows
    with open(INPUT_FILE, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows = list(reader)
        existing_cols = reader.fieldnames or []

    total = len(rows)
    print(f"Loaded {total} rows from {INPUT_FILE}")

    # Check if image_url already exists (resume support)
    already_patched = [r for r in rows if r.get("image_url", "").strip()]
    if already_patched:
        print(f"  {len(already_patched)} rows already have image_url — skipping those")

    # Build new column list
    new_cols = existing_cols.copy()
    if "image_url" not in new_cols:
        # Insert before source_url if it exists, otherwise append
        if "source_url" in new_cols:
            idx = new_cols.index("source_url")
            new_cols.insert(idx, "image_url")
        else:
            new_cols.append("image_url")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
            viewport={"width": 1280, "height": 900},
        )
        page = context.new_page()

        # Write output file as we go (crash-safe)
        with open(OUTPUT_FILE, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=new_cols)
            writer.writeheader()

            for i, row in enumerate(rows, 1):
                source_url = row.get("source_url", "").strip()

                # Skip if already has image_url
                if row.get("image_url", "").strip():
                    writer.writerow(row)
                    print(f"[{i}/{total}] Already has image — skipping")
                    continue

                if not source_url:
                    row["image_url"] = ""
                    writer.writerow(row)
                    print(f"[{i}/{total}] No source_url — skipping")
                    continue

                print(f"[{i}/{total}] {row.get('title', '?')[:45]}")

                image_url = get_image_url(page, source_url)
                row["image_url"] = image_url

                writer.writerow(row)
                f.flush()

                status = "✓" if image_url else "✗ (empty)"
                print(f"         {status} {image_url[:80] if image_url else ''}")

                time.sleep(DELAY)

        browser.close()

    # Quick summary
    with open(OUTPUT_FILE, newline="", encoding="utf-8") as f:
        result_rows = list(csv.DictReader(f))

    filled = sum(1 for r in result_rows if r.get("image_url", "").strip())
    print(f"\n{'='*60}")
    print(f"Done. {filled}/{total} rows have image URLs.")
    print(f"Output saved to: {OUTPUT_FILE}")
    print(f"\nIf filled count looks good, rename it:")
    print(f"  rename data\\artworks_v2.csv artworks.csv")
    print(f"{'='*60}")


if __name__ == "__main__":
    patch()
