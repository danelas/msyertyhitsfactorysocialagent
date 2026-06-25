# Mystery Hits Factory — Stream Clipper

Drops in a Whatnot **Pokemon TCG** stream recording, picks the best moments (chase pulls, viewer interactions, big reactions), renders captioned clips per platform, posts them to TikTok / Instagram / Facebook.

There are two flows:

- **Local clip flow** — you drop a Whatnot stream into `input/`, the agent finds the best moments and posts clips. Manual, on-demand.
- **Daily generator flow** — when no fresh stream exists, an AI picks a content theme (live promo / hobby tip / brand intro / value-add) and produces a 12-second captioned video. Runs unattended on a daily cron via GitHub Actions.

## How the clip flow works

```
input/stream.mp4
    │
    ▼
[ ffmpeg: audio loudness peaks ]
    │
    ▼
[ Whisper: word-level transcript ]
    │
    ▼
[ Claude: pick top 3 moments — pack pulls, viewer interactions, reactions ]
    │
    ▼
[ Remotion: render 9 clips (3 moments × 3 platforms, each with its own end card) ]
    │
    ▼
[ Upload-Post: schedule to TikTok / IG / FB with platform-specific captions ]
```

## One-time setup

### 1. Install ffmpeg

The clipper shells out to `ffmpeg` and `ffprobe` for audio analysis and compression. Both must be on your PATH.

**Windows:**
```
winget install Gyan.FFmpeg
```
Then close & reopen your terminal so PATH refreshes. Verify:
```
ffmpeg -version
```

### 2. Install npm deps

```
cd clipper && npm install
cd ../remotion && npm install
cd ../remotion && npx remotion browser ensure
```

### 3. Configure `.env`

Copy `.env.example` to `.env` in the repo root and fill in:

- `OPENAI_API_KEY` — for Whisper transcription
- `ANTHROPIC_API_KEY` — for moment ranking
- `UPLOAD_POST_API_KEY` and `UPLOAD_POST_USER` — your Upload-Post profile that has Mystery Hits Factory's TikTok / IG / FB connected (likely a different profile from Gold Touch List)
- `WHATNOT_HANDLE`, `TIKTOK_HANDLE`, `INSTAGRAM_HANDLE`, `FACEBOOK_PAGE` — already prefilled with `mysteryhitsfactory` / `mystery.hits.factory`

## Running

Drop a stream recording into `input/`:
```
input/
  my-stream.mp4
```

Then from `clipper/`:
```
cd clipper
npm run clip
```

The newest video in `input/` gets processed. To target a specific file:
```
npm run clip -- --input=path/to/file.mp4
```

To do a full render but skip posting:
```
npm run clip:dry
```

## Output

```
output/
  my-stream/
    clip-01-tiktok.mp4
    clip-01-instagram.mp4
    clip-01-facebook.mp4
    clip-02-tiktok.mp4
    ...
clipper/work/
  my-stream/
    audio.mp3            # compressed audio sent to Whisper
    transcript.json      # full Whisper output
    moments.json         # what Claude picked
```

## Daily generator flow

For the days you don't drop a stream, the daily generator keeps your feeds active and pulls live content from mysteryhitsfactory.com.

```
[ Scrape mysteryhitsfactory.com → active drops, featured products, sealed singles, themed packs, giveaway state ]
    │
    ▼
[ Pick theme — site-driven if available, else evergreen rotation ]
    │   live-drop-urgency / tier-spotlight / new-arrival / giveaway-hype
    │   (fallback) live-promo / hobby-tip / intro / value-add
    ▼
[ Claude writes hook + body + cta + caption — referencing the SPECIFIC drop / product / price / end-time from the site ]
    │
    ▼
[ Background: site product image → user stock/ photo → AI abstract bg (in that priority) ]
    │
    ▼
[ Remotion: 12s captioned 9:16 video — hook → body → cta ]
    │
    ▼
[ Upload-Post: same video to TikTok / IG / FB; caption includes the specific product URL ]
```

### Site-driven themes

When the scraper finds something live on mysteryhitsfactory.com, the planner picks the matching theme:

| Site signal | Theme | Example hook |
|---|---|---|
| Active live drop with end-time | `live-drop-urgency` | "VAULT #14 ENDS TONIGHT" |
| Themed pack / featured bundle | `new-arrival` | "MEW PACK JUST DROPPED" |
| Sealed singles in stock (named set) | `new-arrival` | "CROWN ZENITH SINGLES IN" |
| SpinFREE / giveaway active | `giveaway-hype` | "FREE SPIN — TODAY ONLY" |
| Nothing time-sensitive | `tier-spotlight` | "WHAT'S IN A VAULT PACK?" |

If the scraper fails or returns nothing usable, the daily generator falls back to evergreen themes (live-promo, hobby-tip, intro, value-add) so it still ships content.

The feed is **product-led**: product-anchored themes (`live-drop-urgency`, `new-arrival`, `tier-spotlight`) dominate the rotation, every theme that can anchors on a real product so the post carries an actual product image + shoppable URL, and other days fall back to *any* site product image before stock/AI. CTAs and captions are tuned to push the sale ("GRAB A PACK", "SHOP THE DROP") rather than soft branding.

### Engagement themes

To keep the feed from reading as one long ad, **two engagement angles land every cycle** alongside the product themes. Some are grounded in live web research (via Claude's web-search tool); the rest are interactive formats that drive comments, tags, and shares:

| Theme | Research? | What it does |
|---|---|---|
| `market-watch` | ✅ | Real, current price move / value trend (specific card + numbers) framed as proof the chase is live — grab a pack to ride it. |
| `set-buzz` | ✅ | Hype on a specific just-dropped set or chase card collectors care about now; asks a question to drive comments. |
| `fun-fact` | ✅ | A surprising, verifiable Pokemon TCG fact (misprints, record sales, rarity oddities, WOTC lore) — pure scroll-stopper, tag-a-friend bait. |
| `poll-debate` | — | This-or-that / would-you-rather / hot-take that fans argue about ("Charizard or Blastoise?"). The hook IS the question. |
| `nostalgia` | — | Relatable throwback (ripping packs as a kid, chasing the holo Charizard) — makes returning collectors feel seen. |
| `quiz` | — | Interactive challenge ("Can you name this set?") that makes viewers comment their answer. |

Research themes pull a fresh nugget at run time; if research fails the post still ships without the live hook. The interactive themes use the normal background priority for visual variety. Test any with `npm run daily:dry -- --theme=fun-fact`.

> The old `hit-spotlight` ("someone pulled this from our pack") theme has been removed.

### Background image priority

For each daily run the generator picks a background in this order:

1. **Site product image** — the post's anchor product when it has an image, otherwise *any* site product with an image (so even evergreen days lead with a real product photo). First-sale-clean since you sell the products on the site.
2. **Your stock photos** — anything in `stock/` at the repo root.
3. **AI abstract background** — DALL-E 3 fallback, locked to studio backgrounds with no Pokemon-evocative imagery.

Run locally:
```
cd clipper
npm run daily:dry   # generate + render, no post
npm run daily       # full run with posts
```

### Background photos — `stock/`

The daily generator prefers your own uploaded photos as backgrounds. **Drop any photos you want to use into `stock/`** at the repo root:

```
stock/
  sealed-elite-trainer-box.jpg
  graded-slabs-shelf.jpg
  studio-shot-cards-fanned.jpg
  ...
```

Use real photos of product or cards you actually own — they're 100% IP-clean (you own the physical thing) and convert harder than any AI graphic.

- Supported: `.jpg`, `.jpeg`, `.png`, `.webp`
- Vertical 9:16 photos look best; non-9:16 photos will be center-cropped
- The generator picks one at random per run, so the more you upload the more variety you'll get
- Photos in `stock/` are committed to git so the cloud cron can use them — keep file sizes reasonable (under ~3MB each is fine)
- If `stock/` is empty, the generator falls back to an AI-generated abstract studio background (no Pokemon-evocative imagery — locked at the prompt level)

### Scheduled deployment (GitHub Actions)

The `.github/workflows/mhf-daily.yml` workflow runs the daily generator every day at 17:00 UTC (1 PM ET).

To activate it:

1. Create a GitHub repo (private is fine) and push:
   ```
   gh repo create mystery-hits-factory --private --source=. --push
   ```
   (or `git remote add origin ...; git push -u origin main`)

2. Add 4 repository secrets at `Settings → Secrets and variables → Actions`:
   - `ANTHROPIC_API_KEY`
   - `OPENAI_API_KEY`
   - `UPLOAD_POST_API_KEY`
   - `UPLOAD_POST_USER` — the Upload-Post profile that has Mystery Hits Factory's TikTok / IG / FB connected

3. The schedule fires automatically. To test before waiting for tomorrow, go to `Actions → MHF Daily Post → Run workflow`, optionally with `dry_run: true`.

## Tuning

If a clip comes out wrong, the fix is usually one of:

- **Wrong moment picked** → edit `SYSTEM_PROMPT` in `clipper/src/detect/rank.ts`
- **Hook text feels off** → edit how `hookPhrase` is generated (also in `rank.ts`)
- **End card / caption tone wrong on one platform** → edit `clipper/src/config.ts`
- **Captions too small / wrong position** → edit `remotion/src/StreamClip.tsx`
- **Want more or fewer clips per stream** → `SETTINGS.momentsPerStream` in `clipper/src/config.ts`
- **Daily promo content feels generic / off-voice** → edit `SYSTEM_PROMPT` in `clipper/src/generate/plan.ts`
- **Daily theme rotation wrong (too much promo / not enough)** → edit `buildThemeRotation` in `clipper/src/generate/plan.ts` (product / engagement / evergreen groups)
- **Research themes off-topic or want different angles** → edit `FOCUS_PROMPT` in `clipper/src/generate/research.ts` (`market` vs `fun-fact` focus); theme copy lives in `THEME_DESCRIPTIONS` in `plan.ts`
- **Add / remove an engagement theme or change the mix** → edit the `engagement` group in `buildThemeRotation` and add a `THEME_DESCRIPTIONS` entry (+ a `ContentTheme` union member) in `plan.ts`
- **CTAs / captions not pushing the sale hard enough** → tighten the "CTA + caption rules" block in `SYSTEM_PROMPT` in `clipper/src/generate/plan.ts`
- **Daily video styling** → edit `remotion/src/PromoCard.tsx`
- **AI image looks wrong** → tighten the imagePrompt rules in `SYSTEM_PROMPT` in `plan.ts`
- **Scraper missing products / picking wrong anchor** → edit `SCRAPER_SYSTEM_PROMPT` or `pickAnchorProduct` in `clipper/src/site/scrape.ts`
- **Wrong product URL in caption** → check `plan.url` (set from `anchorProduct.url` in `generate/index.ts`)
- **Site product image not loading / wrong format** → check `clipper/src/site/fetch-image.ts` (currently accepts JPG/PNG/WebP)

## Limits

- Whisper API has a 25MB file cap. The clipper compresses audio to 24kbps mono — that holds up to ~2 hours of stream. Longer streams will need chunked transcription (not in v1).
- Currently English transcription only.
- No music, no auto-music. (Per design.)
