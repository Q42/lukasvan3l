-- Boodschappen-app — Supabase schema + Row-Level Security
-- Draai dit in de Supabase SQL-editor (zie supabase/README.md voor de volgorde).
--
-- Model: producten + prijzen zijn GEDEELD (door het gezin), winkelmandjes zijn
-- PRIVÉ per gebruiker. Toegang is afgeschermd op een allowlist: alleen wie in
-- allowed_emails staat wordt bij eerste login lid en ziet iets. Buitenstaanders
-- die met Google inloggen worden geen lid en zien via RLS niets.

-- ── tabellen ─────────────────────────────────────────────────────────────

-- vooraf toegelaten e-mailadressen (jij vult deze; zie onderaan)
create table if not exists allowed_emails (
  email text primary key
);

-- daadwerkelijke leden (automatisch gevuld bij eerste login, zie trigger)
create table if not exists members (
  user_id  uuid primary key references auth.users(id) on delete cascade,
  email    text,
  naam     text,
  added_at timestamptz default now()
);

-- gedeelde productcatalogus: een "zoekterm/behoefte", bv 'havermout'
create table if not exists products (
  id         text primary key,          -- slug, bv 'havermout'
  naam       text not null,
  created_at timestamptz default now()
);

-- alle matchende producten (SKU's) per zoekterm, van alle winkels
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

-- winkelmandje per gebruiker; chosen_offer_id = de gekozen SKU
create table if not exists list_items (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users(id) on delete cascade default auth.uid(),
  product_id      text references products(id) on delete cascade,
  chosen_offer_id uuid references offers(id) on delete set null,
  aantal          int     default 1,
  afgevinkt       boolean default false,
  created_at      timestamptz default now()
);

-- besteld-geschiedenis per gebruiker (voor "eerder besteld bovenaan")
create table if not exists purchases (
  user_id    uuid references auth.users(id) on delete cascade default auth.uid(),
  offer_id   uuid references offers(id) on delete cascade,
  product_id text,                  -- gedenormaliseerd, voor sorteren per zoekterm
  ordered_at timestamptz default now(),
  primary key (user_id, offer_id)
);

-- ── allowlist-trigger: maak toegelaten gebruikers automatisch lid ──────────

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from allowed_emails where lower(email) = lower(new.email)) then
    insert into members (user_id, email, naam)
    values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.email))
    on conflict (user_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── helper: is de huidige gebruiker een toegelaten lid? ────────────────────

create or replace function public.is_member()
returns boolean language sql security definer set search_path = public as $$
  select exists (select 1 from members where user_id = auth.uid())
$$;

-- ── Row-Level Security ─────────────────────────────────────────────────────

alter table allowed_emails enable row level security;   -- geen policies → alleen service-role
alter table members        enable row level security;
alter table products       enable row level security;
alter table offers         enable row level security;
alter table list_items     enable row level security;
alter table purchases      enable row level security;

-- leden mogen hun eigen lidmaatschap zien (voor de toegangscheck in de app)
drop policy if exists "eigen lid" on members;
create policy "eigen lid" on members for select using (user_id = auth.uid());

-- gedeelde catalogus + offers: leden lezen en beheren; buitenstaanders niets
drop policy if exists "leden products" on products;
create policy "leden products" on products for all
  using (is_member()) with check (is_member());

drop policy if exists "leden offers" on offers;
create policy "leden offers" on offers for all
  using (is_member()) with check (is_member());

-- winkelmandje: alleen je eigen regels, en alleen als je lid bent
drop policy if exists "eigen mandje" on list_items;
create policy "eigen mandje" on list_items for all
  using (user_id = auth.uid() and is_member())
  with check (user_id = auth.uid() and is_member());

-- besteld-geschiedenis: alleen je eigen aankopen
drop policy if exists "eigen aankopen" on purchases;
create policy "eigen aankopen" on purchases for all
  using (user_id = auth.uid() and is_member())
  with check (user_id = auth.uid() and is_member());

-- ── realtime aanzetten (voor multi-device sync) ────────────────────────────
alter publication supabase_realtime add table products;
alter publication supabase_realtime add table offers;
alter publication supabase_realtime add table list_items;
alter publication supabase_realtime add table purchases;

-- ── VUL JE ALLOWLIST ───────────────────────────────────────────────────────
-- Zet hier de Google-e-mailadressen van jou + gezin. Voer daarna deze inserts
-- uit (of doe het via de Table editor). Iedereen hierbuiten krijgt geen toegang.
--
-- insert into allowed_emails (email) values
--   ('lukas@q42.nl'),
--   ('hester@example.com')
-- on conflict do nothing;
