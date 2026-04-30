# Mystery Hits Factory — Stream Clipper

Drops in a Whatnot stream recording, picks the best moments, renders captioned clips per platform, posts them to TikTok / Instagram / Facebook.

## How it works

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

## Tuning

If a clip comes out wrong, the fix is usually one of:

- **Wrong moment picked** → edit the `SYSTEM_PROMPT` in `clipper/src/detect/rank.ts`
- **Hook text feels off** → edit how `hookPhrase` is generated (also in `rank.ts`)
- **End card / caption tone wrong on one platform** → edit `clipper/src/config.ts`
- **Captions too small / wrong position** → edit `remotion/src/StreamClip.tsx`
- **Want more or fewer clips per stream** → `SETTINGS.momentsPerStream` in `clipper/src/config.ts`

## Limits

- Whisper API has a 25MB file cap. The clipper compresses audio to 24kbps mono — that holds up to ~2 hours of stream. Longer streams will need chunked transcription (not in v1).
- Currently English transcription only.
- No music, no auto-music. (Per design.)
