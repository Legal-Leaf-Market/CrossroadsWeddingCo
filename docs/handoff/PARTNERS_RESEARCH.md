# Brief for ChatGPT: research and improve the partner pages

## Context
Crossroads Wedding and Event Co. (Columbus, Indiana) is a wedding and event DJ, MC, acoustic and
bar service. Its site has a **Partners** section for local businesses that cover what Crossroads
does not: sweets, balloons, flowers. Two partner pages are live:

- https://crossroadsweddingco.shop/partners/cookie-paradise
- https://crossroadsweddingco.shop/partners/rabbits-balloons

Every line on those pages comes from `lib/partners.ts` in the repo. Your job is to research both
businesses and hand back better, verified material in the format at the end, plus outreach drafts
for the facts only the owners can give.

## Rules (these are not style preferences; break one and the work gets thrown out)
1. **Never invent a fact about a real business.** No guessed prices, minimums, service areas,
   years in business, awards, owner backstories or capacities. If you cannot find it in a public
   source the business controls, it goes in "Ask the owner", not on the page.
2. **Every fact carries its source URL and the date you read it.** Prefer the business's own
   website, then its own social profiles (Facebook, Instagram), then official listings (Google
   Business Profile, Indiana Secretary of State, Columbus Area Chamber). A third-party blog is
   not a source for a fact about them.
3. **No reviews, ratings or testimonials** quoted or summarized on the page, even glowing public
   ones. You may read them to suggest questions; do not hand them back as copy.
4. **No photos** unless the owner sends them with permission. A photo on their own website or
   Instagram is not permission. Suggest which photos to ask for instead.
5. **No em dashes** anywhere you write (owner's standing rule). Use a period, comma, colon or
   parentheses. Ranges are written "10 AM to 6 PM", "$3 to $35".
6. **Their words, not ours.** Describe what they say they do, plainly. No "best in town", "premier",
   "stunning", no exclamation marks.
7. Separate **facts** (sourced) from **suggestions** (ideas for the page Crossroads would have to
   confirm with the owner).

## What is already verified (do not re-research, but flag it if you find it changed)

### Cookie Paradise
- Website: https://cookieparadise.co (a Shopify store). Read 2026-11-13.
- Address: trailer in the Holiday Center parking lot, 3950 25th St, Columbus, IN 47203
  (their contact page). An older Chamber listing said 3346 Cox Ln; their own page wins.
- Hours (their contact page): Tuesday to Friday 10 AM to 6 PM, Saturday 10 AM to 8 PM, closed
  Sunday and Monday. Google's listing showed shorter hours (Tuesday to Friday 11 AM to 5:30 PM);
  find out which is current.
- Weddings & Private Parties page: dessert tables, individually packaged favors on request, ask
  whether the yellow cookie trailer can come to your venue, a quote form.
  https://cookieparadise.co/pages/weddings-private-parties
- Corporate catering page: https://cookieparadise.co/pages/corporate-catering
- Since 2026-11-25 the page is an orderable store (`app/partners/cookie-paradise`): the menu is
  read from their store feed every 15 minutes with product photos, and the cart checks out on
  their own Shopify checkout. Photo permission from the owner is still worth getting in writing.
  As of 2026-11-18 it included Thanksgiving Cookie Boxes ($25 for 8, $35 for 12), S'mores ($5),
  Pumpkin Spice, Pretzel Perfect, Coconut Dream ($4 each), Birthday Cake and Peanut Butter
  Chocolate Chip ($3.50), Chocolate Chip ($3).
- The owner asked to cross promote their wedding page (through Jacob Kennedy, 2026-11-13).

### Rabbit's Balloons
- Owner: Rachael Starr. Everything we have came from her directly (2026-11-15) for a draft
  website Heart of Columbus built for her review. **She has no public website, phone, address or
  prices yet.** She owns a domain; we do not know which.
- Services: organic balloon arches, asymmetric arches, columns, garlands (priced by the foot),
  bouquets and clusters, for weddings, showers, corporate events and private celebrations.
- Materials and practice: all natural latex from Sempertex, minimal plastics, reuse, low-waste
  breakdown. Her own caveat: natural latex is not the same as compostable.
- Process: tell her the vibe, design and quote before ordering, setup on time, breakdown.
- Sister business: Turtle's Flowers (https://www.turtlesflowers.com/), run by her sister.
- The page's balloon arch picture is our illustration, captioned as not her work.

## Your tasks

### A. Cookie Paradise (public research)
1. Confirm the current address and hours on their own site and their Google listing; report any
   disagreement with both URLs.
2. Read their Weddings & Private Parties and Corporate Catering pages in full. Report, with the
   exact wording: any minimum order, lead time, deposit, delivery or setup fee, dietary options
   (gluten free, nut free, vegan), packaging options for favors, and how the trailer is booked
   for events. Only what is written there.
3. Find their official social profiles (links only) and whether they post a seasonal menu or
   event calendar.
4. Note whether their Shopify store offers local pickup, delivery or shipping (from the store's
   own policy pages), with the URL.

### B. Rabbit's Balloons (public research, expect very little)
1. Search for any public presence: a website on a domain she owns, a Facebook or Instagram page,
   a Google Business Profile, an Indiana business registration. Report each with its URL, or say
   plainly that none was found.
2. Check Sempertex's own site for what it says about its natural latex (biodegradability claims,
   certifications) so the page never says more than the manufacturer does. Quote Sempertex, with
   the URL.
3. Do **not** describe her work, prices or portfolio from anyone else's posts.

### C. Ask the owner (drafts for Jacob to send)
Write two short, friendly emails, one per owner, from Jacob at Crossroads. Each asks for exactly
what the page is missing and says how it will be used:
- **Cookie Paradise:** permission to show 3 to 6 product or trailer photos (and the credit line
  they want), the event minimums and lead time if they want them shown, whether the trailer
  travels for weddings and how far, and a one-sentence description in their own words.
- **Rabbit's Balloons:** her public website or social link and the contact method she wants
  shown, 4 to 8 install photos with permission and a credit line, a starting price or price
  range if she wants one shown, her service area and setup lead time, whether she is insured
  for venue work, and whether we may quote the "Why Rabbit?" story she told for her draft site.

### D. Page improvements (suggestions, clearly labeled)
Suggest up to five improvements for each page, ranked, each tagged as **needs owner** or **can
ship from public facts**. Examples of the kind wanted: a "pairs well with" note that a couple can
act on (dessert table placement in the run of show), a seasonal callout tied to their own menu,
a sample timeline line showing where the install or dessert table sits in a reception.

## Hand it back in this format
One fenced block per partner, in this exact shape, so it can be pasted into `lib/partners.ts`
after review. Put only sourced facts in it; everything else goes under "Ask the owner" or
"Suggestions" below the block.

```
PARTNER: cookie-paradise
FACTS:
- <one fact in plain words> | SOURCE: <url> | READ: <YYYY-MM-DD>
- ...
CHANGED SINCE 2026-11-13:
- <what changed, old vs new> | SOURCE: <url> | READ: <date>
NOT FOUND:
- <what you looked for and where>
ASK THE OWNER:
- <question>
SUGGESTIONS:
- [can ship from public facts | needs owner] <suggestion>
```

Then the two outreach emails (task C), each under its own heading.
