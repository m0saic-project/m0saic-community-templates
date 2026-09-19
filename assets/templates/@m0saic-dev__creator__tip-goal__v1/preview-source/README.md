# tip-goal preview — how it was rendered (2026-09-15)

`streamer.png` is a Gemini-generated stick-figure streamer (gemini-2.5-flash-image,
16:9, cropped to drop a white band at the top and to ground the desk at the bottom edge, scaled to 1920×1080). The tip bar is
pinned top-left with the template's exact-pixel `geometry` override — the way a real
stream overlay sits — instead of the centered `placement` presets.

From the monorepo root, with `sourceId` in props.json pointed at the absolute path
of streamer.png:

```
node packages/cli/dist/index.js make @m0saic-dev/creator/tip-goal/v1 \
  --community-repo packages/community-templates \
  --inputs <abs>/streamer.png --props @<abs>/props.json \
  -w 1920 -h 1080 --durationMs 8000 -o preview.mp4
ffmpeg -ss 7.9 -i preview.mp4 -frames:v 1 poster.png   # preview.png = poster.png
```
