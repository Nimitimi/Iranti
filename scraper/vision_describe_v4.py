"""
vision_describe_v4.py
=====================
Uses Playwright to download artwork images (bypasses CDN restrictions),
then sends each image to Gemini Vision for a visual description.

SETUP:
    pip install google-generativeai pillow playwright
    python -m playwright install chromium

USAGE:
    python vision_describe_v4.py

INPUT:  data/artworks.csv
OUTPUT: data/artworks_final.csv
"""

import csv
import time
import os
import random
import io
from pathlib import Path

from PIL import Image
import google.generativeai as genai
from playwright.sync_api import sync_playwright

# ── Config ────────────────────────────────────────────────────────────────────

INPUT_FILE  = Path("data/artworks.csv")
OUTPUT_FILE = Path("data/artworks_final.csv")

DELAY_MIN   = 5.0
DELAY_MAX   = 8.0
MAX_RETRIES = 3
RETRY_WAIT  = 20.0

VISION_PROMPT = """You are an expert art analyst describing a Nigerian artwork 
for a museum chatbot called Iranti. Describe what you literally see in this image.

Focus on:
- Subject matter: what figures, objects, or scenes are depicted
- Composition: how elements are arranged, foreground/background
- Colour palette: dominant colours and their mood
- Medium and texture: visible brushwork, material qualities
- Style: realistic, abstract, expressionist, traditional, etc.
- Any cultural symbols, patterns, or iconography visible

Write 3-4 sentences. Be specific and visual. Do not speculate about 
meaning — only describe what is visible. Do not repeat the title or 
artist name."""


# ── Image download via Playwright ─────────────────────────────────────────────

def download_image_playwright(browser, image_url: str) -> Image.Image | None:
    """
    Use a real browser session to download the image.
    This bypasses CDN restrictions that block Python's requests library.
    """
    try:
        context = browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            )
        )
        page = context.new_page()

        # Navigate to the image URL directly
        response = page.goto(image_url, wait_until="networkidle", timeout=20000)

        if response and response.ok:
            # Get the raw image bytes from the response
            image_bytes = response.body()
            image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
            context.close()
            return image
        else:
            print(f"    HTTP {response.status if response else 'no response'}")
            context.close()
            return None

    except Exception as e:
        print(f"    Playwright download failed: {str(e)[:80]}")
        try:
            context.close()
        except Exception:
            pass
        return None


# ── Gemini Vision call ────────────────────────────────────────────────────────

def describe_artwork(model, browser, image_url: str) -> str:
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            image = download_image_playwright(browser, image_url)
            if image is None:
                raise Exception("Image download returned None")

            response = model.generate_content(
                [VISION_PROMPT, image],
                generation_config={
                    "max_output_tokens": 300,
                    "temperature": 0.3,
                }
            )
            return response.text.strip()

        except Exception as e:
            error = str(e)[:100]
            print(f"    Attempt {attempt} failed: {error}")
            if attempt < MAX_RETRIES:
                wait = RETRY_WAIT * attempt
                print(f"    Waiting {wait}s...")
                time.sleep(wait)

    return ""


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    # ── API key ───────────────────────────────────────────────────────────
    api_key = os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        print("Enter your Gemini API key:")
        api_key = input("API key: ").strip()

    if not api_key:
        print("ERROR: No API key provided.")
        return

    genai.configure(api_key=api_key)
    model = genai.GenerativeModel("gemini-2.0-flash")
    print("Gemini configured.\n")

    # ── Load CSV ──────────────────────────────────────────────────────────
    if not INPUT_FILE.exists():
        print(f"ERROR: {INPUT_FILE} not found.")
        return

    with open(INPUT_FILE, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows = list(reader)
        existing_cols = list(reader.fieldnames or [])

    total        = len(rows)
    already_done = sum(1 for r in rows if r.get("visual_description", "").strip())

    print(f"{'='*60}")
    print(f"Iranti Vision Descriptor v4")
    print(f"{'='*60}")
    print(f"Total:     {total}")
    print(f"Done:      {already_done}")
    print(f"To do:     {total - already_done}")
    print(f"{'='*60}\n")

    # ── Build output columns ──────────────────────────────────────────────
    new_cols = list(existing_cols)
    if "visual_description" not in new_cols:
        if "description" in new_cols:
            idx = new_cols.index("description") + 1
            new_cols.insert(idx, "visual_description")
        else:
            new_cols.append("visual_description")

    # ── Process ───────────────────────────────────────────────────────────
    success = 0
    failed  = 0

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)

        with open(OUTPUT_FILE, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=new_cols)
            writer.writeheader()

            for i, row in enumerate(rows, 1):
                title     = row.get("title", "Untitled")[:45]
                image_url = row.get("image_url", "").strip()

                # Skip already described
                if row.get("visual_description", "").strip():
                    writer.writerow(row)
                    print(f"[{i}/{total}] {title:<45} — skipping")
                    continue

                print(f"[{i}/{total}] {title:<45}", end=" ", flush=True)

                if not image_url:
                    row["visual_description"] = ""
                    writer.writerow(row)
                    print("✗ (no image URL)")
                    failed += 1
                    continue

                visual = describe_artwork(model, browser, image_url)
                row["visual_description"] = visual
                writer.writerow(row)
                f.flush()

                if visual:
                    success += 1
                    print(f"✓")
                    print(f"         {visual[:100]}...")
                else:
                    failed += 1
                    print(f"✗ (empty)")

                time.sleep(random.uniform(DELAY_MIN, DELAY_MAX))

        browser.close()

    # ── Summary ───────────────────────────────────────────────────────────
    print(f"\n{'='*60}")
    print(f"Done. ✓ {success + already_done}/{total}  ✗ {failed}")
    print(f"Output: {OUTPUT_FILE}")
    print(f"{'='*60}")

    if failed == 0:
        print(f"\nAll done! Rename to finalize:")
        print(f"  rename data\\artworks_final.csv artworks.csv")
        print(f"\nNext: Supabase setup.")
    else:
        print(f"\nRun again to retry the {failed} failures.")


if __name__ == "__main__":
    main()
