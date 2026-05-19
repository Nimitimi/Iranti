"""
scrape_ysma.py
==============
Scrapes artwork data from the Yemisi Shyllon Museum of Art's
Google Arts & Culture collection page.

SETUP (run once):
    pip install playwright
    playwright install chromium

USAGE:
    python scrape_ysma.py

OUTPUT:
    data/artworks.csv  — ready to import into Supabase

HOW IT WORKS:
    1. Opens the YSMA collection page, scrolls to load all artwork cards
    2. Collects all artwork URLs from the grid (up to MAX_ARTWORKS)
    3. Visits each URL, waits for JS to render, extracts all fields
    4. Writes one CSV row per artwork as it goes (crash-safe)

The scraper is intentionally slow (2s delay between pages) to be
respectful to Google's servers. 150 artworks ≈ 10–15 minutes.
"""

import csv
import time
import re
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, Page

# ─── CONFIG ──────────────────────────────────────────────────────────────────

COLLECTION_URL = "https://artsandculture.google.com/explore/collections/yemisi-shyllon-museum-of-art?c=assets"
MAX_ARTWORKS   = 150          # How many artworks to collect
DELAY_SECONDS  = 2.0          # Pause between artwork pages (be respectful)
OUTPUT_DIR     = Path("data")
OUTPUT_FILE    = OUTPUT_DIR / "artworks.csv"

CSV_COLUMNS = [
    "title",
    "artist",
    "year",
    "medium",
    "description",
    "artist_bio",
    "location",
    "period",
    "provenance",
    "source_url",             # Keep this for debugging — not used in Supabase schema
]

# ─── STEP 1: COLLECT ARTWORK URLs FROM COLLECTION PAGE ───────────────────────

def collect_artwork_urls(page: Page) -> list[str]:
    """
    Navigate the YSMA collection grid and harvest all artwork URLs.
    Google Arts & Culture lazy-loads cards as you scroll, so we
    scroll repeatedly until no new URLs appear.
    """
    print(f"Opening collection page...")
    page.goto(COLLECTION_URL, wait_until="domcontentloaded", timeout=30000)
    time.sleep(5)
    

    seen_urls: set[str] = set()
    scroll_attempts = 0
    max_scroll_attempts = 40  # Safety cap

    while len(seen_urls) < MAX_ARTWORKS and scroll_attempts < max_scroll_attempts:
        # Find all artwork links currently in the DOM
        # Google A&C artwork links follow the pattern /asset/slug/id
        links = page.query_selector_all("a[href*='/asset/']")
        
        new_count = 0
        for link in links:
            href = link.get_attribute("href")
            if href and "/asset/" in href:
                # Build full URL if relative
                if href.startswith("/"):
                    href = "https://artsandculture.google.com" + href
                # Strip query params
                href = href.split("?")[0]
                if href not in seen_urls:
                    seen_urls.add(href)
                    new_count += 1

        print(f"  Scroll {scroll_attempts + 1}: {len(seen_urls)} unique artwork URLs found")

        if new_count == 0:
            # No new URLs appeared — we've loaded everything available
            break

        if len(seen_urls) >= MAX_ARTWORKS:
            break

        # Scroll to bottom to trigger lazy loading
        page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        time.sleep(2)
        scroll_attempts += 1

    urls = list(seen_urls)[:MAX_ARTWORKS]
    print(f"\nCollected {len(urls)} artwork URLs.\n")
    return urls


# ─── STEP 2: EXTRACT DATA FROM A SINGLE ARTWORK PAGE ─────────────────────────

def extract_detail_value(page: Page, label: str) -> str:
    """
    Extract a value from the Details section by its label text.
    
    The Details section renders as label-value pairs. From inspection,
    Google uses bold spans for labels. We find the label text, then
    get its sibling/parent text.
    
    Examples of labels: "Title", "Creator", "Date Created", "Medium",
    "Location Created", "Type", "Rights", "Physical Dimensions"
    """
    try:
        # Strategy: get all text from the page, parse the Details block
        # This is more robust than trying to match specific HTML elements
        # because Google obfuscates their class names
        full_text = page.inner_text("body")
        
        # Find the Details section
        details_match = re.search(r"Details\s*\n(.*?)(?:\n\n|\Z)", full_text, re.DOTALL)
        if not details_match:
            return ""
        
        details_block = details_match.group(1)
        
        # Look for "Label: Value" pattern
        pattern = rf"{re.escape(label)}:\s*(.+?)(?:\n|$)"
        match = re.search(pattern, details_block)
        if match:
            return match.group(1).strip()
        
        return ""
    except Exception:
        return ""


def extract_prose_blocks(page: Page) -> tuple[str, str]:
    """
    Extract the two prose blocks that appear before the Details section.
    
    From the screenshots:
    - LEFT COLUMN  = artist_bio (biographical text about the artist)
    - RIGHT COLUMN = description (what the artwork depicts)
    
    These appear as two adjacent text blocks. The artist bio typically
    starts with the artist's name. The description starts with the
    artwork title or describes the scene.
    
    Strategy: get all body text, find the section between the title/year
    line and the "Details" heading, split into two blocks.
    """
    artist_bio  = ""
    description = ""

    try:
        full_text = page.inner_text("body")
        lines = full_text.split("\n")
        lines = [l.strip() for l in lines if l.strip()]

        # Find where the prose section starts (after title/artist/year header)
        # and ends (at "Details" heading)
        prose_start = None
        prose_end   = None

        for i, line in enumerate(lines):
            if line == "Details":
                prose_end = i
                break
        
        # The prose starts after the navigation/header area
        # Look for where substantial paragraphs begin
        # Heuristic: first line with > 80 chars after the image area
        for i, line in enumerate(lines):
            if len(line) > 80 and prose_end and i < prose_end:
                prose_start = i
                break

        if prose_start is None or prose_end is None:
            return "", ""

        prose_lines = lines[prose_start:prose_end]
        
        # Join all prose text
        all_prose = " ".join(prose_lines)
        
        # The page has two columns. Google renders them sequentially in the DOM.
        # The artist bio comes first (left column), description second (right column).
        # 
        # We can split them by looking for the artwork title appearing in the prose
        # (the description typically opens with the artwork title or describes it directly).
        # 
        # A reliable split point: the description usually begins with the artwork title.
        title = extract_detail_value(page, "Title")
        artist = extract_detail_value(page, "Creator")
        
        if title and title in all_prose:
            split_idx = all_prose.index(title)
            # Everything before the title mention = bio
            # Everything from the title mention onward = description
            artist_bio  = all_prose[:split_idx].strip()
            description = all_prose[split_idx:].strip()
        elif artist and artist in all_prose:
            # Fallback: split on artist name
            split_idx = all_prose.index(artist)
            artist_bio  = all_prose[split_idx:all_prose.index(title) if title in all_prose else len(all_prose)].strip()
            description = ""
        else:
            # Can't reliably split — put everything in description
            description = all_prose

    except Exception as e:
        print(f"    Warning: prose extraction failed: {e}")

    return artist_bio, description


def scrape_artwork(page: Page, url: str) -> dict:
    """
    Visit one artwork page and extract all 9 fields.
    Returns a dict matching CSV_COLUMNS.
    """
    try:
        page.goto(url, wait_until="domcontentloaded", timeout=30000)
        time.sleep(3) 
        
        # Wait for the Details section to confirm the page has rendered
        page.wait_for_selector("text=Details", timeout=15000)
        
        # Extract structured Details fields
        title       = extract_detail_value(page, "Title")
        artist      = extract_detail_value(page, "Creator")
        year        = extract_detail_value(page, "Date Created")
        medium      = extract_detail_value(page, "Medium")
        location    = extract_detail_value(page, "Location Created")
        provenance  = extract_detail_value(page, "Rights")
        period      = extract_detail_value(page, "Type")
        
        # Extract prose blocks
        artist_bio, description = extract_prose_blocks(page)
        
        return {
            "title":       title,
            "artist":      artist,
            "year":        year,
            "medium":      medium,
            "description": description,
            "artist_bio":  artist_bio,
            "location":    location,
            "period":      period,
            "provenance":  provenance,
            "source_url":  url,
        }

    except Exception as e:
        print(f"    ERROR scraping {url}: {e}")
        return {col: "" for col in CSV_COLUMNS} | {"source_url": url}


# ─── STEP 3: MAIN ORCHESTRATOR ────────────────────────────────────────────────

def main():
    OUTPUT_DIR.mkdir(exist_ok=True)

    # Check if we have a partial run to resume from
    existing_urls: set[str] = set()
    if OUTPUT_FILE.exists():
        with open(OUTPUT_FILE, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                if row.get("source_url"):
                    existing_urls.add(row["source_url"])
        print(f"Resuming: {len(existing_urls)} artworks already scraped, skipping these.\n")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        
        # Use a real-looking user agent to avoid bot detection
        context = browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
            viewport={"width": 1280, "height": 900},
        )
        page = context.new_page()

        # ── Phase 1: Collect URLs ──────────────────────────────────────────
        print("=" * 60)
        print("PHASE 1: Collecting artwork URLs")
        print("=" * 60)
        all_urls = collect_artwork_urls(page)
        
        # Filter out already-scraped URLs (resume support)
        urls_to_scrape = [u for u in all_urls if u not in existing_urls]
        print(f"URLs to scrape this run: {len(urls_to_scrape)}\n")

        # ── Phase 2: Scrape each artwork ───────────────────────────────────
        print("=" * 60)
        print("PHASE 2: Scraping artwork pages")
        print("=" * 60)

        # Open CSV in append mode (supports resuming)
        file_exists = OUTPUT_FILE.exists()
        with open(OUTPUT_FILE, "a", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=CSV_COLUMNS)
            
            # Write header only if file is new
            if not file_exists:
                writer.writeheader()

            for i, url in enumerate(urls_to_scrape, 1):
                print(f"[{i}/{len(urls_to_scrape)}] {url.split('/')[-2][:40]}...")
                
                data = scrape_artwork(page, url)
                writer.writerow(data)
                f.flush()  # Write to disk immediately (crash-safe)
                
                # Print a preview of what we got
                print(f"  title:      {data['title'] or '(empty)'}")
                print(f"  artist:     {data['artist'] or '(empty)'}")
                print(f"  year:       {data['year'] or '(empty)'}")
                print(f"  medium:     {data['medium'] or '(empty)'}")
                print(f"  bio:        {(data['artist_bio'] or '')[:60]}...")
                print(f"  desc:       {(data['description'] or '')[:60]}...")
                print()
                
                time.sleep(DELAY_SECONDS)

        browser.close()

    print("=" * 60)
    print(f"Done. CSV saved to: {OUTPUT_FILE}")
    print(f"Total rows: {len(existing_urls) + len(urls_to_scrape)}")
    print("=" * 60)
    print("\nNext step: import artworks.csv into Supabase via the Table Editor.")


if __name__ == "__main__":
    main()
