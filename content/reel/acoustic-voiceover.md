# Acoustic reel voiceover script

Timed to `acoustic-reel.mp4` (21.5 seconds, 6 sections, new section every
3.5s). Read easy; each line has about three seconds of air. Once recorded,
the slide durations get recut to the read's pause map exactly like the main
reel (ffmpeg silencedetect, then update `scripts/generate-reel-acoustic.mjs`).

| Time | Slide | Line |
| --- | --- | --- |
| 0:00 | Hero | Live music at your wedding. Five hundred dollars, flat. |
| 0:03.5 | What it is | One performer, guitar and voice, played live for your ceremony or cocktail hour. |
| 0:07 | Your songs | Give us enough notice and we'll learn up to three songs, just for you. |
| 0:10.5 | Standalone | Already have a DJ? Perfect. The set books entirely on its own. |
| 0:14 | Price | Five hundred, flat. Want the whole day handled? Our DJ and MC package is a thousand. |
| 0:17.5 | CTA | Tell us your date and your songs. Crossroads Wedding Co. |

Plain block:

Live music at your wedding. Five hundred dollars, flat.
One performer, guitar and voice, played live for your ceremony or cocktail hour.
Give us enough notice and we'll learn up to three songs, just for you.
Already have a DJ? Perfect. The set books entirely on its own.
Five hundred, flat. Want the whole day handled? Our DJ and MC package is a thousand.
Tell us your date and your songs. Crossroads Wedding Co.
