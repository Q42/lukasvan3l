# boodschappen

Een boodschappen-app die per product de **goedkoopste van drie winkels** kiest:
**Varuvo**, **Albert Heijn** en **Van Haver tot Gort**. Bij het bestellen maakt
de app een bestellijst per winkel (welk product waar het goedkoopst is).

Voor Lukas + gezin. Nederlands, houden zo.

## Architectuur (multi-device via Supabase)

```
GitHub Pages (statische app)  ── @supabase/supabase-js ──▶  Supabase
  index.html + config.js                                     (Auth + Postgres
  Alpine.js + Supabase JS (beide via CDN)                      + Realtime + RLS)
                                                                    ▲
                                              service-role key      │
                                    lokale prijs-agent (agent/) ─────┘
```

- **Frontend** (`index.html`): statische single-file app, **geen buildstap**.
  Reactiviteit met **Alpine.js** (CDN), data via **Supabase JS** (CDN). Google-
  login via Supabase Auth. Live sync over alle apparaten via Supabase Realtime.
- **`config.js`**: publieke Supabase project-URL + anon key. Mag publiek in de
  repo (beveiliging zit in Auth + RLS). Nog niet ingevuld = de app toont een
  setup-melding.
- **`supabase/`**: `schema.sql` (tabellen, RLS, allowlist-trigger, realtime) en
  `README.md` (eenmalige setup-checklist: project, Google OAuth, sleutels).
- **`agent/`**: lokaal Node/Playwright-scriptje dat op **Lukas' machine** draait,
  met zíjn credentials prijzen ophaalt en naar Supabase schrijft (service-role
  key). Zie `agent/README.md`.

## Datamodel (Postgres)

- `allowed_emails` — allowlist (jij vult). `members` — auto-gevuld bij eerste
  login als de e-mail toegelaten is (trigger).
- `products` — gedeelde catalogus van **zoektermen/behoeften** `{id (slug), naam}`,
  bv 'havermout'.
- `offers` — **alle matchende SKU's** per zoekterm, van alle winkels:
  `{product_id, shop, external_id, titel, prijs, hoeveelheid, eenheid (g|ml|stuk),
  url, updated_at}`. Eén zoekterm heeft dus meerdere offers per winkel.
- `list_items` — winkelmandje per gebruiker `{user_id, product_id,
  chosen_offer_id, aantal, afgevinkt}`. `chosen_offer_id` = de handmatig gekozen
  SKU (null = default: eerder-besteld, anders goedkoopst op basisprijs).
- `purchases` — besteld-geschiedenis per gebruiker `{user_id, offer_id,
  product_id, ordered_at}`. Gevuld door de knop "Bestelling afgerond".

**Toegang**: alle tabellen staan onder RLS die op `is_member()` checkt.
Buitenstaanders die met Google inloggen worden geen lid en zien niets. Leden
delen `products`/`offers`; `list_items` en `purchases` zijn privé per gebruiker.

## Prijsvergelijking: basisprijs

Offers hebben `hoeveelheid` + `eenheid`. De app rekent de **basisprijs** uit:
gram → per kg, ml → per l, stuk → per stuk (`prijs / hoeveelheid` genormaliseerd).
Zo staat een AH-pak eerlijk naast een Varuvo-doos. In het bestel-scherm kies je
per zoekterm welke SKU je wilt; **eerder bestelde SKU's staan bovenaan**, daarna
gesorteerd op basisprijs.

## Werkregels

- **Blijf in deze map.** Niets buiten `boodschappen/` aanraken, behalve de tegel
  in de root-`index.html`.
- Frontend blijft **self-contained, zonder buildstap** (Alpine + Supabase via
  CDN). Geen bundler/Node-toolchain voor de app; dat past bij de repo-stijl.
- Zet nooit de **service-role key**, echte credentials, `state/` of `.env` in git
  — zie `agent/.gitignore`. De **anon key** in `config.js` mag wél publiek.
- Persoonlijke Varuvo-prijzen zijn zichtbaar voor alle leden (één account levert
  de prijzen); dat is een bewuste aanname voor een gezinsapp.

## Setup / migraties

`supabase/schema.sql` is het volledige schema voor een vers project.
`supabase/migration-offers.sql` migreert een bestaand v1-project (één prijs per
winkel) naar het offers-model. Zie `supabase/README.md`.

## Historie

Begon als een localStorage-only single-file app met handmatige `prijzen.json`
import/export. Omgebouwd naar Supabase (Alpine + Postgres) voor multi-device +
live sync; ontwerp in `ONTWERP-supabase.md`. Daarna uitgebreid van één prijs per
winkel naar meerdere SKU-opties per zoekterm met keuze per lijst-item, basisprijs
en besteld-historie.
