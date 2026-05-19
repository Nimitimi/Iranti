"""
patch_images_v2.py
==================
Improved version with:
- Retry logic (3 attempts per page with backoff)
- Longer delays to avoid rate limiting
- Better image extraction (actual artwork image, not generic thumbnail)
- Skips rows that already have image_url (safe to re-run)

USAGE:
    python patch_images_v2.py

INPUT:  data/artworks_v2.csv   (output from previous patch attempt)
OUTPUT: data/artworks_v3.csv   (same data + image_url filled in)
"""

import csv
import time
import re
import random
from pathlib import Path
from playwright.sync_api import sync_playwright, Page

# ── Config ────────────────────────────────────────────────────────────────────

INPUT_FILE  = Path("data/artworks_v2.csv")
OUTPUT_FILE = Path("data/artworks_v3.csv")

DELAY_MIN   = 4.0   # minimum seconds between requests
DELAY_MAX   = 7.0   # maximum seconds (randomised to look less like a bot)
MAX_RETRIES = 3     # attempts per page before giving up
RETRY_WAIT  = 15.0  # seconds to wait after a failed attempt

# ── Image extraction ──────────────────────────────────────────────────────────

def get_image_url(page: Page, source_url: str) -> str:
    """
    Extract the actual artwork image URL from the page.
    
    We avoid og:image because it returns the museum's generic
    thumbnail for many artworks. Instead we look for the main
    large image rendered in the page body.
    """
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            page.goto(source_url, wait_until="domcontentloaded", timeout=30000)
            
            # Wait for the image to actually appear in the DOM
            # Give JS time to render the artwork image
            time.sleep(4)

            # ── Strategy 1: find the largest googleusercontent image ──────
            # The artwork image is always the biggest one on the page.
            # We read the naturalWidth attribute to find it.
            imgs = page.query_selector_all("img[src*='googleusercontent']")
            
            best_src = ""
            best_width = 0

            for img in imgs:
                try:
                    src = img.get_attribute("src") or ""
                    if not src:
                        continue
                    
                    # Get rendered dimensions to find the main artwork image
                    # (not icons or thumbnails)
                    width = page.evaluate("el => el.naturalWidth", img)
                    
                    if width and width > best_width:
                        best_width = width
                        best_src = src
                except Exception:
                    continue

            if best_src and best_width > 200:
                # Bump to high resolution
                best_src = re.sub(r'=s\d+.*$', '=s1200', best_src)
                best_src = re.sub(r'=w\d+-h\d+.*$', '=s1200', best_src)
                return best_src

            # ── Strategy 2: look for srcset attribute ─────────────────────
            # Some images have srcset with higher resolution versions
            for img in imgs:
                try:
                    srcset = img.get_attribute("srcset") or ""
                    if srcset:
                        # Get the last (highest res) entry from srcset
                        parts = [p.strip().split(" ")[0] for p in srcset.split(",")]
                        if parts:
                            src = parts[-1]
                            src = re.sub(r'=s\d+.*$', '=s1200', src)
                            return src
                except Exception:
                    continue

            # ── Strategy 3: og:image as last resort ───────────────────────
            # Only use this if nothing else worked AND it's not the generic
            # museum thumbnail URL we saw in the failed run
            og = page.get_attribute('meta[property="og:image"]', "content") or ""
            GENERIC_THUMBNAIL = "AL18g_QoDt1HSI6O_2agdHcg3xe8gRZx50tOzOj81Do"
            if og and GENERIC_THUMBNAIL not in og:
                og = re.sub(r'=s\d+.*$', '=s1200', og)
                return og

            # Nothing found on this attempt
            print(f"    Attempt {attempt}: no image found")

        except Exception as e:
            error_msg = str(e)[:80]
            print(f"    Attempt {attempt} failed: {error_msg}")
            
            if attempt < MAX_RETRIES:
                wait = RETRY_WAIT * attempt  # backoff: 15s, 30s, 45s
                print(f"    Waiting {wait}s before retry...")
                time.sleep(wait)

    return ""  # All attempts exhausted


# ── Main ──────────────────────────────────────────────────────────────────────

def patch():
    if not INPUT_FILE.exists():
        print(f"ERROR: {INPUT_FILE} not found.")
        print(f"Make sure artworks_v2.csv is in the data/ folder.")
        return

    with open(INPUT_FILE, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows = list(reader)
        existing_cols = list(reader.fieldnames or [])

    total = len(rows)
    already_done = sum(1 for r in rows if r.get("image_url", "").strip())
    to_patch     = total - already_done

    print(f"\n{'='*60}")
    print(f"YSMA Image Patch v2")
    print(f"{'='*60}")
    print(f"Total rows:      {total}")
    print(f"Already patched: {already_done}")
    print(f"To patch:        {to_patch}")
    print(f"Delay between requests: {DELAY_MIN}–{DELAY_MAX}s (randomised)")
    print(f"{'='*60}\n")

    if to_patch == 0:
        print("All rows already have image URLs. Nothing to do.")
        return

    # Ensure image_url column exists
    new_cols = list(existing_cols)
    if "image_url" not in new_cols:
        if "source_url" in new_cols:
            new_cols.insert(new_cols.index("source_url"), "image_url")
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
            # Pretend to be a real browser
            extra_http_headers={
                "Accept-Language": "en-US,en;q=0.9",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            }
        )
        page = context.new_page()

        success_count = 0
        fail_count    = 0

        with open(OUTPUT_FILE, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=new_cols)
            writer.writeheader()

            for i, row in enumerate(rows, 1):
                # Skip rows that already have an image
                existing_img = row.get("image_url", "").strip()
                if existing_img:
                    # Make sure the existing URL isn't the generic thumbnail
                    GENERIC = "AL18g_QoDt1HSI6O_2agdHcg3xe8gRZx50tOzOj81Do"
                    if GENERIC not in existing_img:
                        writer.writerow(row)
                        print(f"[{i}/{total}] {row.get('title','?')[:40]:<40} — already done, skipping")
                        continue
                    else:
                        print(f"[{i}/{total}] {row.get('title','?')[:40]:<40} — generic thumbnail, re-fetching")

                source_url = row.get("source_url", "").strip()
                if not source_url:
                    row["image_url"] = ""
                    writer.writerow(row)
                    print(f"[{i}/{total}] {row.get('title','?')[:40]:<40} — no source URL")
                    continue

                title_display = row.get("title", "?")[:40]
                print(f"[{i}/{total}] {title_display:<40}", end=" ", flush=True)

                image_url = get_image_url(page, source_url)
                row["image_url"] = image_url
                writer.writerow(row)
                f.flush()

                if image_url:
                    success_count += 1
                    print(f"✓")
                    print(f"         {image_url[:90]}")
                else:
                    fail_count += 1
                    print(f"✗ (empty)")

                # Random delay — harder to detect as a bot
                delay = random.uniform(DELAY_MIN, DELAY_MAX)
                time.sleep(delay)

        browser.close()

    # ── Summary ───────────────────────────────────────────────────────────────
    print(f"\n{'='*60}")
    print(f"Done.")
    print(f"  ✓ Success:  {success_count + already_done}/{total}")
    print(f"  ✗ Failed:   {fail_count}")
    print(f"  Output:     {OUTPUT_FILE}")
    print(f"{'='*60}")
    print(f"\nIf results look good, rename the file:")
    print(f"  rename data\\artworks_v3.csv artworks.csv")

    if fail_count > 0:
        print(f"\n{fail_count} rows still missing images.")
        print(f"Run the script again — it will skip completed rows and retry only the gaps.")


if __name__ == "__main__":
    patch()
