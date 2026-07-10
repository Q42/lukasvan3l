# parro

Gezinsdashboard voor **Parro** (schoolcommunicatie-app van ParnasSys/Topicus):
agenda met acties ("wat moeten we meenemen/voorbereiden", kind van de week),
wekelijkse samenvattingen en belangrijke meldingen. Voor Lukas + vrouw;
Nederlands, houden zo. Kinderen: Floris en Yune.

## Architectuur

```
Parro API ──(gwillem/parro CLI, onofficieel)──▶ lokale SQLite op Lukas' machine
                                                       │ agent/sync.mjs (cron)
                                                       ▼
GitHub Pages (index.html) ── supabase-js ──▶ Supabase (Auth + Postgres + RLS)
  Alpine.js via CDN, geen buildstap                    ▲
                                        agent/enrich.mjs + week.mjs
                                        (Claude API, service-role key)
```

- **Frontend** (`index.html`): statische single-file app, zelfde patroon als
  `boodschappen/` — Alpine.js + Supabase JS via CDN, Google-login via
  Supabase Auth, allowlist (`allowed_emails`) + RLS. Vier tabs: Agenda
  (met afvinkbare acties en kind-van-de-week-banner), Weekoverzicht,
  Meldingen en Foto's (galerij met lightbox + download; de bestanden komen
  via tijdelijke signed URLs uit een private storage-bucket).
- **`config.js`**: publieke Supabase-URL + publishable key. Standaard
  hetzelfde gezinsproject als boodschappen (gedeelde login/allowlist).
- **`supabase/`**: `schema.sql` (parro_*-tabellen + RLS; het
  allowlist/leden-deel is identiek aan boodschappen en idempotent) en
  setup-README.
- **`agent/`**: lokale cron-scripts op Lukas' machine. `sync.mjs` leest de
  SQLite van de [gwillem/parro](https://github.com/gwillem/parro) CLI,
  `fotos.mjs` uploadt de door die CLI gedownloade bijlagen (uit
  `~/.cache/parro/`) naar de storage-bucket, `enrich.mjs` laat Claude
  (structured output) agenda-items/acties/vlaggen extraheren, `week.mjs`
  schrijft weeksamenvattingen. Zie `agent/README.md`.

## Datamodel

- `parro_items` — ruwe berichten (mededeling/agenda/chat) met
  `verwerkt`/`belangrijk`/`actie_nodig`-vlaggen.
- `parro_agenda` — verrijkt: datum, kind, `kind_van_de_week`.
- `parro_acties` — afvinkbare acties per agenda-item (leden mogen updaten,
  de rest is read-only; schrijven doet de agent via service-role).
- `parro_weekoverzicht` — markdown-samenvatting per week (pk = maandag).
- `parro_fotos` — foto's/video's uit berichten: metadata + het pad in de
  private storage-bucket `parro-fotos`. De bestanden zelf staan in Storage,
  niet in git; de frontend maakt er per sessie signed URLs voor aan.

## Werkregels

- **Blijf in deze map.** Niets buiten `parro/` aanraken, behalve de tegel in
  de root-`index.html`.
- Frontend blijft **self-contained, zonder buildstap**.
- Nooit de **service-role key**, Parro-tokens of `.env` in git; de
  publishable key in `config.js` mag wél publiek. Geen persoonlijke
  Parro-inhoud (berichten, namen van school/leraren) hardcoden — alles komt
  uit de database; kindernamen in prompts komen uit `PARRO_KINDEREN` in
  `.env`.
- De Parro-koppeling is **onofficieel** (reverse-engineered API) en kan
  breken; hou `sync.mjs` los van de rest zodat alleen dat stuk aangepast
  hoeft te worden.
