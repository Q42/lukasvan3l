# Ontwerp: boodschappen-app op Supabase (multi-device)

> Status: **ontwerp ter review** — nog geen app-code gewijzigd. Dit beschrijft
> hoe we de huidige localStorage-app ombouwen naar een multi-device app met een
> gedeelde database, en waar de prijs-agent op aansluit.

## Keuzes (afgestemd)

- **Frontend:** blijft een statische site op GitHub Pages (`boodschappen/`).
- **Database + auth:** **Supabase** (Postgres + Auth + Realtime + Row-Level Security).
- **Toegang:** **allowlist** — alleen jij + gezin. Niet "iedereen met Google".
- **Prijzen ophalen:** lokale cron op je eigen machine (AH via API, VHTG via
  Store-API, Varuvo via browsersessie), schrijft rechtstreeks naar Supabase.

## Architectuur

```
GitHub Pages  (statische app, boodschappen/index.html)
   │  @supabase/supabase-js (CDN)
   │   • login: Google OAuth via Supabase Auth
   │   • data: SQL-queries + realtime subscriptions
   ▼
Supabase project
   • Auth        → wie ben je (Google), allowlist-check
   • Postgres    → products / prices / list_items  (+ RLS)
   • Realtime    → live sync naar alle devices
   ▲
   │  service-role key (geheim!) — negeert RLS
Lokale prijs-agent (cron op jouw machine)
   • haalt prijzen op bij Varuvo / AH / VHTG
   • upsert naar products + prices
```

Rolverdeling: **prijzen zijn gedeeld** (één Varuvo-account = één prijzenset),
**winkelmandjes zijn privé per gebruiker**. De agent is de enige die prijzen
schrijft; de app leest ze alleen.

## Auth + allowlist

- Supabase Auth met **Google** als provider. Inloggen in de app met
  `supabase.auth.signInWithOAuth({ provider: 'google' })`.
- **Allowlist** werkt in twee lagen:
  1. Een tabel `allowed_emails` die jij vooraf vult met de gezins-e-mails.
  2. Een trigger op `auth.users`: logt iemand voor het eerst in, dan wordt hij
     alleen lid (`members`) als z'n e-mail in `allowed_emails` staat.
  3. **Alle** datatabellen zijn met RLS afgeschermd op lidmaatschap. Logt een
     willekeurige Google-gebruiker in, dan wordt hij géén lid → RLS geeft niks
     terug → de app toont "geen toegang". De persoonlijke Varuvo-prijzen zijn zo
     nooit zichtbaar voor buitenstaanders.
- Nieuw gezinslid toevoegen = één regel in `allowed_emails` (en de eerste keer
  inloggen). Geen code-wijziging.

## Datamodel (Postgres)

```sql
-- wie is vooraf toegelaten (jij vult dit)
create table allowed_emails (
  email text primary key
);

-- daadwerkelijke leden (automatisch gevuld bij eerste login als e-mail toegelaten is)
create table members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email   text,
  naam    text,
  added_at timestamptz default now()
);

-- gedeelde productcatalogus
create table products (
  id         text primary key,        -- slug, bv 'havermout'
  naam       text not null,
  created_at timestamptz default now()
);

-- actuele prijs per product per winkel (door de agent geschreven)
create table prices (
  product_id  text references products(id) on delete cascade,
  shop        text check (shop in ('varuvo','ah','vhtg')),
  prijs       numeric,
  inhoud      int  default 1,          -- stuks per verpakking/doos → stuksprijs
  url         text,
  omschrijving text,
  external_id text,                    -- bv AH webshopId (voor mandje vullen)
  updated_at  timestamptz default now(),
  primary key (product_id, shop)
);

-- winkelmandje per gebruiker
create table list_items (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade default auth.uid(),
  product_id text references products(id) on delete cascade,
  aantal     int     default 1,
  afgevinkt  boolean default false,
  shop_keuze text,                     -- handmatige override van de goedkoopste
  created_at timestamptz default now()
);
```

De "goedkoopste winkel op stuksprijs" (`prijs / inhoud`) rekenen we net als nu
in de frontend uit — geen serverlogica nodig.

## Row-Level Security (de kern van de beveiliging)

```sql
-- helper: is de huidige gebruiker een toegelaten lid?
create function is_member() returns boolean language sql security definer as $$
  select exists (select 1 from members where user_id = auth.uid())
$$;

alter table products   enable row level security;
alter table prices     enable row level security;
alter table list_items enable row level security;
alter table members    enable row level security;

-- catalogus + prijzen: leden mogen LEZEN; niemand schrijft vanaf de client
create policy "leden lezen products" on products for select using (is_member());
create policy "leden lezen prices"   on prices   for select using (is_member());
-- (geen insert/update/delete-policy → clients kunnen niet schrijven;
--  de agent gebruikt de service-role key en omzeilt RLS legitiem)

-- winkelmandje: alleen je eigen regels, en alleen als je lid bent
create policy "eigen mandje" on list_items for all
  using (user_id = auth.uid() and is_member())
  with check (user_id = auth.uid() and is_member());

-- leden mogen hun eigen lidmaatschap zien
create policy "eigen lid" on members for select using (user_id = auth.uid());
```

## Multi-device / realtime

- Supabase Realtime aanzetten op `prices` en `list_items`.
- De app abonneert zich (`.channel(...).on('postgres_changes', ...)`):
  - vink je op je telefoon iets af → laptop springt mee;
  - schrijft de cron 's ochtends nieuwe prijzen → open app-vensters updaten
    vanzelf.
- Binnen de gratis limieten (200 gelijktijdige realtime-connecties, 2M
  berichten/mnd) zit je met een gezin ruimschoots goed.

## De prijs-agent (cron)

- Blijft grotendeels zoals nu (`boodschappen/agent/`), met één wijziging: in
  plaats van een `prijzen.json` te schrijven, doet-ie een **upsert** naar
  Supabase via `@supabase/supabase-js` met de **service-role key** (die omzeilt
  RLS — mag, want het is jouw server-side proces).
- Stappen per run: producten uit `products` lezen → per winkel prijs ophalen →
  `upsert` in `products` (nieuwe) en `prices`.
- **Varuvo blijft lokaal** (anti-bot + dagelijkse login), dus de agent draait
  sowieso op jouw machine. Prima plek voor de cron.
- Bijvangst: die dagelijkse schrijfactie **houdt het Supabase-project wakker**
  (zie kosten-gotcha hieronder).
- AH-mandje vullen (`fill-cart-ah.mjs`) blijft werken; leest voortaan uit
  Supabase welke producten AH-goedkoopst zijn.

## Frontend-wijzigingen

- `@supabase/supabase-js` van CDN laden.
- Login-knop (Google) + uitgelogde staat ("log in om je lijst te zien").
- Opslaglaag van localStorage → Supabase queries + realtime. De UI en logica
  (goedkoopste winkel, bestellijst per winkel, besparing) blijven.
- De handmatige `prijzen.json` import/export **vervalt** — data is nu live.
  (Een export-knop als back-up kan blijven; handig.)
- **Redirect-URL's** registreren: de GitHub-Pages-URL moet in Supabase Auth
  (Redirect URLs) én in de Google Cloud OAuth-client staan. Lokaal testen via
  `http://localhost` idem.

## Wat publiek mag en wat geheim moet

- **Publiek (mag in de repo/gebundeld in de statische app):** Supabase project-URL
  en de **anon key**. Dat is by design veilig — de beveiliging zit in Auth + RLS,
  niet in het verbergen van die sleutel (net als de Firebase apiKey).
- **Geheim (NOOIT in git):** de **service-role key** van de agent. Gaat in de
  bestaande gitignore-hoek (`agent/.env`, naast de winkel-credentials).

## Kosten

**€0** op de Supabase-gratis-tier — ruim voldoende voor een gezin:
500 MB database, 50.000 maandelijkse actieve gebruikers, 5 GB egress, 200
realtime-connecties, 2M realtime-berichten/mnd.

**Eén gotcha:** gratis projecten **pauzeren na 7 dagen zonder database-activiteit**
(daarna ~30s "opstarten" bij de volgende query). Voor deze app is dat in de
praktijk geen probleem: **de dagelijkse prijs-cron telt als activiteit en houdt
het project vanzelf wakker.** Ga je 2+ weken op vakantie zónder dat de cron
draait, dan pauzeert het en unpauze je het met één klik in het dashboard.

Bronnen: [Supabase pricing/limieten](https://supabase.com/pricing) ·
[Firestore-vergelijk (verworpen alternatief)](https://firebase.google.com/docs/firestore/quotas).

## Openstaande punten / risico's

1. **Varuvo blijft het zwakke punt** — persoonlijke prijzen, anti-bot,
   ± dagelijkse login. Dat verandert niet door Supabase. Overweeg nog steeds de
   Varuvo-klantenservice te vragen om een prijslijst-export.
2. **Prijzen zijn nu "van Lukas"** — één Varuvo-account levert de prijzen voor
   iedereen in het gezin. Prima aanname voor een gezinsapp; expliciet benoemd.
3. **Google OAuth-setup** is eenmalig wat klikwerk (Google Cloud project +
   OAuth consent screen + client-id/secret in Supabase). Ik lever een
   stap-voor-stap checklist.
4. **RLS-fouten zijn stil** — verkeerd beleid = of niks zichtbaar, of te veel.
   We testen expliciet met een niet-toegelaten testaccount dat die 0 rijen ziet.

## Voorgestelde fasering (als je groen licht geeft)

1. **Supabase-project + schema + RLS** aanmaken (SQL migratiebestand in
   `agent/` of een `supabase/`-mapje, plus setup-checklist).
2. **Frontend**: auth + Supabase-opslaglaag inbouwen; localStorage vervangen.
   Achter een aparte pagina/branch zodat de huidige app blijft werken tot het af is.
3. **Agent**: `prijzen.json` → Supabase-upsert.
4. **Testen** met een tweede (niet-toegelaten) account op de RLS-grens, en op
   twee devices tegelijk voor de realtime-sync.

---

_Volgende stap: jouw akkoord op dit ontwerp (of aanpassingen), daarna begin ik
met fase 1._
