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

## Notes

- All external resources (Leaflet, OSM tiles, Wikipedia images, Google Fonts)
  load from the **visitor's** browser, so they won't render in a sandboxed
  environment without internet — that's expected; the fallbacks kick in.
- Map coordinates are approximate (overview only).
- Content is Dutch; keep it that way.

## Scope

This is a standalone one-off. Don't pull in or reference anything from other
directories in this repo.
