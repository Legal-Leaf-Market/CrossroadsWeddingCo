# Bartending reel voiceover script

Timed to `bartending-reel.mp4` (25 seconds, 7 sections, new section every
3.5s). Read easy; each line has about three seconds of air. Once recorded,
the slide durations get recut to the read's pause map exactly like the main
reel (ffmpeg silencedetect, then update
`scripts/generate-reel-bartending.mjs`). The copy stays serve-only on
purpose: we never supply or sell alcohol.

| Time | Slide | Line |
| --- | --- | --- |
| 0:00 | Hero | Your bar, run by licensed bartenders. Starting at five hundred. |
| 0:03.5 | Indiana | Here's how Indiana works: you provide the alcohol, and we pour it. Store prices, no markup. |
| 0:07 | Licensed | Our bartenders hold Indiana permits, with about twenty years behind the bar. |
| 0:10.5 | Included | We set up before guests arrive, serve all night, check IDs, and break it down after. |
| 0:14 | Price | Five hundred is the minimum, not the price. Your guest count sets the real number, one straight quote. |
| 0:17.5 | Standalone | Already have a DJ? Bring us anyway. The bar books on its own. |
| 0:21 | CTA | One short call, one straight number. Crossroads Wedding Co. |

Plain block:

Your bar, run by licensed bartenders. Starting at five hundred.
Here's how Indiana works: you provide the alcohol, and we pour it. Store prices, no markup.
Our bartenders hold Indiana permits, with about twenty years behind the bar.
We set up before guests arrive, serve all night, check IDs, and break it down after.
Five hundred is the minimum, not the price. Your guest count sets the real number, one straight quote.
Already have a DJ? Bring us anyway. The bar books on its own.
One short call, one straight number. Crossroads Wedding Co.
