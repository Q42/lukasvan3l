# slovenie

A one-off static page: a travel itinerary for a two-week summer camping trip
through Slovenia (August 2026), in Dutch.

## Contents

- `index.html` — the entire page. Single, self-contained HTML file with inline
  CSS and JavaScript. No build step, no dependencies to install; just open it
  in a browser.

## How it works

- **Layout/styling** is plain inline CSS. Fonts come from Google Fonts.
- **Interactive map**: [Leaflet](https://leafletjs.com/) (loaded from the
  unpkg CDN) with OpenStreetMap tiles. Markers for the 3 basecamps and the day
  trips, plus a route line. No API key required.
- **Photos** are fetched at runtime in the visitor's browser from the
  Wikipedia API (`en.wikipedia.org/w/api.php`, `prop=pageimages`) per location,
  keyed by the `data-wiki` attribute on each `<img>`. If a photo is missing or
  the network is blocked, it falls back to the styled gradient + emoji
  placeholder.

## Notes

- All external resources (Leaflet, OSM tiles, Wikipedia images, Google Fonts)
  load from the **visitor's** browser, so they won't render in a sandboxed
  environment without internet — that's expected; the fallbacks kick in.
- Map coordinates are approximate (overview only).
- Content is Dutch; keep it that way.

## Scope

This is a standalone one-off. Don't pull in or reference anything from other
directories in this repo.
