# slovenie

A one-off static page: a travel itinerary for a two-week summer camping trip
through Slovenia (August 2026), in Dutch.

## Trip context (who's going & what they like)

This page is tailored to **our family trip**, so keep content relevant to:

- **Who:** Lukas + Hester, with the kids **Floris (9)** and **Yune (7)**.
- **Bikes:** we bring **2 mountainbikes** (one for Lukas, one shared by Hester
  or Floris). We like **gravel riding**, **not** steep/technical climbs — favour
  mellow valley/riverside gravel.
- **Slackline:** we bring a slackline, so campsites with trees / a bit of
  meadow are a plus.
- **Water play:** Floris and Yune love **playing by/in water** (shallow
  streams, rivers) — highlight kid-friendly water spots.

When adding or editing content, lean into these preferences (gentle gravel,
slackline-friendly camps, water play for the kids) and keep the kids' names
(Floris & Yune) consistent.

## Contents

- `index.html` — the entire page. Single, self-contained HTML file with inline
  CSS and JavaScript. No build step, no dependencies to install; just open it
  in a browser.

## How it works

- **Layout/styling** is plain inline CSS. Fonts come from Google Fonts.
- **Interactive map**: [Leaflet](https://leafletjs.com/) (loaded from the
  unpkg CDN) with OpenStreetMap tiles. Markers for the 3 basecamps and the day
  trips, plus a route line. No API key required.
- **Photos** are fetched at runtime in the visitor's browser. Each `<img>` has
  a `data-wiki` attribute (one or more `|`-separated Wikipedia article titles)
  and a `data-search` attribute (a Wikimedia Commons image-search query). The
  loader tries each Wikipedia article's lead image first (`prop=pageimages`),
  then falls back to a Commons photo search, then to the styled gradient +
  emoji placeholder. So to fix a blank card, tweak its `data-wiki` candidates
  or `data-search` query.

## Booking & navigation

- Each basecamp card has a **booking box** (`.booking-box`) with a status badge
  (`.bk-ok` geboekt / `.bk-todo` nog te boeken) plus dates, address, payment
  and check-in info. Source data comes from the reservation e-mails.
  - **Kaki Plac** (kamp 2): Liminjan 8, 6320 Portorož · 7–12 aug · ref
    WTB1A9A3EC · €440 cash bij vertrek · tel +386 41 359 801.
  - **Kamp na Otoku** (kamp 3): Na Pečeh 7, 3333 Ljubno ob Savinji (island in
    the Savinja) · 12–17 aug · aanbetaling gedaan, rest + toeristenbelasting
    contant · tel +386 41 390 515.
  - **Camp Šorli** (kamp 1, Soča): nog te boeken.
- Every camp and day-trip has **action buttons** (`.actions` / `.btn`): a
  `🧭 Navigatie` link (`google.com/maps/dir/?api=1&destination=…`, opens
  turn-by-turn from the phone's location), a `📍 Maps` search link, and a
  `📞 Bel camping` `tel:` link on the camps. Drive time is shown both on the
  photo `.drive-badge` and in the nav button label.
- The page is **mobile-first responsive** (media query at `max-width: 760px`):
  cards/day-rows collapse to a single column and the route bar scrolls
  horizontally — it's meant to be opened on a phone during the trip.

## Notes

- All external resources (Leaflet, OSM tiles, Wikipedia images, Google Fonts)
  load from the **visitor's** browser, so they won't render in a sandboxed
  environment without internet — that's expected; the fallbacks kick in.
- Map coordinates are approximate (overview only).
- Content is Dutch; keep it that way.

## Scope

This is a standalone one-off. Don't pull in or reference anything from other
directories in this repo.
