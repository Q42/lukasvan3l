-- Migratie v1 → v2: van één prijs per winkel naar meerdere SKU-kandidaten
-- ("offers") per zoekterm, keuze per lijst-item, en besteld-geschiedenis.
--
-- Draai dit in de Supabase SQL-editor als je het oude schema.sql al hebt gedraaid.
-- (Voor een vers project kun je meteen het bijgewerkte schema.sql gebruiken.)

-- ── offers: alle matchende producten per zoekterm, van alle winkels ─────────
create table if not exists offers (
  id          uuid primary key default gen_random_uuid(),
  product_id  text references products(id) on delete cascade,  -- de zoekterm/behoefte
  shop        text check (shop in ('varuvo','ah','vhtg')),
  external_id text,                 -- SKU-id bij de winkel (bv AH webshopId)
  titel       text,                 -- concrete productnaam bij de winkel
  prijs       numeric,
  hoeveelheid numeric,              -- verpakkingsgrootte, bv 500
  eenheid     text,                 -- 'g' | 'ml' | 'stuk'
  url         text,
  updated_at  timestamptz default now(),
  unique (product_id, shop, external_id)
);

-- ── lijst-item krijgt een gekozen SKU ──────────────────────────────────────
alter table list_items add column if not exists chosen_offer_id uuid references offers(id) on delete set null;

-- ── besteld-geschiedenis per gebruiker (voor "eerder besteld bovenaan") ─────
create table if not exists purchases (
  user_id    uuid references auth.users(id) on delete cascade default auth.uid(),
  offer_id   uuid references offers(id) on delete cascade,
  product_id text,                  -- gedenormaliseerd, voor sorteren per zoekterm
  ordered_at timestamptz default now(),
  primary key (user_id, offer_id)
);

-- ── het oude prijzen-model vervalt (data was automatisch opgehaald, herbouwbaar)
drop table if exists prices;

-- ── grants op de nieuwe tabellen (fix-grants dekte alleen prices) ───────────
grant all on table public.offers    to anon, authenticated, service_role;
grant all on table public.purchases to anon, authenticated, service_role;

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table offers    enable row level security;
alter table purchases enable row level security;

drop policy if exists "leden offers" on offers;
create policy "leden offers" on offers for all
  using (is_member()) with check (is_member());

drop policy if exists "eigen aankopen" on purchases;
create policy "eigen aankopen" on purchases for all
  using (user_id = auth.uid() and is_member())
  with check (user_id = auth.uid() and is_member());

-- ── realtime ─────────────────────────────────────────────────────────────────
alter publication supabase_realtime add table offers;
alter publication supabase_realtime add table purchases;
