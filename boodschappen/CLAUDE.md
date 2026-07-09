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
- `products` — gedeelde catalogus `{id (slug), naam}`.
- `prices` — per `(product_id, shop)`: `prijs, inhoud, url, omschrijving,
  external_id (bv AH webshopId), updated_at`.
- `list_items` — winkelmandje per gebruiker `{user_id, product_id, aantal,
  afgevinkt, shop_keuze}`.

**Toegang**: alle tabellen staan onder RLS die op `is_member()` checkt.
Buitenstaanders die met Google inloggen worden geen lid en zien niets. Leden
delen `products`/`prices`; `list_items` is privé per gebruiker.

## Prijsvergelijking: stuksprijs

Varuvo verkoopt vaak per **doos**. `prices.inhoud` = stuks per verpakking. De app
vergelijkt op **stuksprijs** (`prijs / inhoud`), zodat 1 pak bij AH eerlijk tegen
een doos bij Varuvo afgezet wordt.

## Werkregels

- **Blijf in deze map.** Niets buiten `boodschappen/` aanraken, behalve de tegel
  in de root-`index.html`.
- Frontend blijft **self-contained, zonder buildstap** (Alpine + Supabase via
  CDN). Geen bundler/Node-toolchain voor de app; dat past bij de repo-stijl.
- Zet nooit de **service-role key**, echte credentials, `state/` of `.env` in git
  — zie `agent/.gitignore`. De **anon key** in `config.js` mag wél publiek.
- Persoonlijke Varuvo-prijzen zijn zichtbaar voor alle leden (één account levert
  de prijzen); dat is een bewuste aanname voor een gezinsapp.

## Historie

Begon als een localStorage-only single-file app met handmatige `prijzen.json`
import/export. Omgebouwd naar Supabase voor multi-device + live sync; het ontwerp
staat in `ONTWERP-supabase.md`.
