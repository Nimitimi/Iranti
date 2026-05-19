"""
vision_describe.py
==================
Sends each artwork image to Gemini Vision and generates a
detailed visual description. Adds a visual_description column
to your CSV XxPnnRxZXNa9sL3b.

SETUP:
    pip install google-generativeai

USAGE:
    1. Set your Gemini API key when prompted (or set env variable)
    2. Run: python vision_describe.py 

INPUT:  data/artworks.csv
OUTPUT: data/artworks_final.csv  (ready to ingest into Supabase)

Takes ~15-20 minutes for 150 artworks.
Free tier is sufficient — script stays within rate limits.
"""

import csv
import time
import os
import random
from pathlib import Path
import google.generativeai as genai
import urllib.request

# ── Config ────────────────────────────────────────────────────────────────────

INPUT_FILE  = Path("data/artworks.csv")
OUTPUT_FILE = Path("data/artworks_final.csv")

DELAY_MIN   = 3.0   # seconds between requests (free tier: 60 req/min)
DELAY_MAX   = 5.0
MAX_RETRIES = 3
RETRY_WAIT  = 20.0

# ── The prompt Gemini receives for each artwork ───────────────────────────────
# This is carefully written to extract what Iranti needs:
# formal visual qualities, composition, colour, subject matter.
# We keep it focused — we already have description and artist_bio
# from the scraper, so this should add what only vision can provide.

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


# ── Gemini Vision call ────────────────────────────────────────────────────────

def describe_artwork(model, image_url: str, title: str) -> str:
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            response = model.generate_content(
                [
                    VISION_PROMPT,
                    {
                        "parts": [
                            {
                                "file_data": {
                                    "mime_type": "image/jpeg",
                                    "file_uri": image_url
                                }
                            }
                        ]
                    }
                ],
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
    # ── API key setup ─────────────────────────────────────────────────────
    api_key = os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        print("Enter your Gemini API key (from aistudio.google.com):")
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

    total = len(rows)
    already_done = sum(1 for r in rows if r.get("visual_description", "").strip())

    print(f"{'='*60}")
    print(f"Iranti Vision Descriptor")
    print(f"{'='*60}")
    print(f"Total artworks:  {total}")
    print(f"Already done:    {already_done}")
    print(f"To process:      {total - already_done}")
    print(f"{'='*60}\n")

    # ── Build output columns ──────────────────────────────────────────────
    new_cols = list(existing_cols)
    if "visual_description" not in new_cols:
        # Insert after description column if it exists
        if "description" in new_cols:
            idx = new_cols.index("description") + 1
            new_cols.insert(idx, "visual_description")
        else:
            new_cols.append("visual_description")

    # ── Process each artwork ──────────────────────────────────────────────
    success = 0
    failed  = 0

    with open(OUTPUT_FILE, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=new_cols)
        writer.writeheader()

        for i, row in enumerate(rows, 1):
            title     = row.get("title", "Untitled")[:45]
            image_url = row.get("image_url", "").strip()

            # Skip if already described
            if row.get("visual_description", "").strip():
                writer.writerow(row)
                print(f"[{i}/{total}] {title:<45} — skipping (done)")
                continue

            print(f"[{i}/{total}] {title:<45}", end=" ", flush=True)

            if not image_url:
                row["visual_description"] = ""
                writer.writerow(row)
                print("✗ (no image URL)")
                failed += 1
                continue

            description = describe_artwork(model, image_url, title)
            row["visual_description"] = description
            writer.writerow(row)
            f.flush()

            if description:
                success += 1
                print(f"✓")
                print(f"         {description[:100]}...")
            else:
                failed += 1
                print(f"✗ (empty)")

            # Random delay to stay within free tier rate limits
            time.sleep(random.uniform(DELAY_MIN, DELAY_MAX))

    # ── Summary ───────────────────────────────────────────────────────────
    print(f"\n{'='*60}")
    print(f"Done.")
    print(f"  ✓ Described:  {success + already_done}/{total}")
    print(f"  ✗ Failed:     {failed}")
    print(f"  Output:       {OUTPUT_FILE}")
    print(f"{'='*60}")

    if failed > 0:
        print(f"\n{failed} artworks missing descriptions.")
        print(f"Run again — completed rows will be skipped.")
    else:
        print(f"\nAll done! Rename to finalize:")
        print(f"  rename data\\artworks_final.csv artworks.csv")
        print(f"\nNext step: set up Supabase and run the ingest script.")


if __name__ == "__main__":
    main()
