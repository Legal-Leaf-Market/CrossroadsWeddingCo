# Business cards

Print-ready cards for the team. Front is Crossroads Wedding Co., back is Mosaic
Green Worldwide. Everything here is generated: edit the roster or the layout in
`scripts/generate-business-cards.mjs`, then run `pnpm cards` and commit the
output.

## What is in this folder

| File | What it is |
| --- | --- |
| `<name>-front.png`, `<name>-back.png` | 1125 x 675 px at 300 DPI. That is the 3.5 x 2 in card plus the standard 0.125 in bleed on every side, so the image is 3.75 x 2.25 in. |
| `<name>-front.pdf`, `<name>-back.pdf` | One face per file at 3.75 x 2.25 in, vector text, fonts embedded. Use these when the site asks for a separate file per side, which most do. |
| `<name>.pdf` | Both faces in one two-page PDF, for a site that takes one file per card. |
| `all-cards.pdf` | Every card, front then back, in one file (ten pages). |

## Print specs to enter on the ordering site

| Setting | Value |
| --- | --- |
| Card size | 3.5 x 2 in (US standard) |
| Bleed | 0.125 in on every side, already included in the files |
| File size | 3.75 x 2.25 in (1125 x 675 px) |
| Safe zone | 0.125 in inside the trim. All text and the QR code sit inside it |
| Resolution | 300 DPI |
| Colour | RGB. The site converts to CMYK; expect the green to print a shade duller than the screen |
| Sides | Two, different design on each |
| Orientation | Landscape |
| Finish | Matte (owner's pick). Gloss fights the cream paper look and makes the QR code harder to scan under lights |

## Uploading

1. Pick the "upload your own design" or "complete design" path, standard
   3.5 x 2 in, two sided.
2. Upload `<name>-front.pdf` as the front and `<name>-back.pdf` as the back.
   Use the PNGs only where a site refuses PDF.
3. When the site asks whether the file already includes bleed, say yes. If it
   shows a trim guide, line it up so an even 0.125 in of colour sits outside
   the guide on every side.
4. Check the proof at full size: the dashed frame should look evenly inset on
   all four sides, and no text should touch the safe-zone line.
5. Each person is a separate product on most sites. Sites that print a
   different front on every card in one pack (Moo does this) can take all
   five fronts in one order with the shared back.

The design has a frame close to the edge. Cutting varies by about 1/32 in on
any card, and a frame makes that visible in a way a borderless card would
hide. The frame is set 0.16 in inside the trim to give it room; if the first
proof shows it lopsided, that is the cutter, not the file.

## Before ordering

- Confirm `justice@crossroadsweddingco.com` exists as a Google Workspace user
  or alias before it goes on paper.
- Scan every QR code with a phone. Each one opens
  `crossroadsweddingco.com/book?with=<name>`, that person's own call-booking
  page (`lib/schedulers.ts`). The link is on our domain, so what it shows can
  change any time without reprinting; the slug itself must never change.
  Justice is not in the schedulers list yet, so his code lands on the plain
  booking page until he is added there and to `lib/team.ts`.

## Logos

The compass rose and the Mosaic Green globe are drawn in SVG inside the
script. To use the original artwork instead, drop the files here and rerun the
script, no code change needed:

- `logos/crossroads.svg` (or `.png`)
- `logos/mosaic-green.svg` (or `.png`)

Square artwork works best; both slots are square and scale to fit.
