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

-- gedeelde productcatalogus
create table if not exists products (
  id         text primary key,          -- slug, bv 'havermout'
  naam       text not null,
  created_at timestamptz default now()
);

-- actuele prijs per product per winkel (agent of lid schrijft)
create table if not exists prices (
  product_id   text references products(id) on delete cascade,
  shop         text check (shop in ('varuvo','ah','vhtg')),
  prijs        numeric,
  inhoud       int  default 1,           -- stuks per verpakking/doos → stuksprijs
  url          text,
  omschrijving text,
  external_id  text,                     -- bv AH webshopId (voor mandje vullen)
  updated_at   timestamptz default now(),
  primary key (product_id, shop)
);

-- winkelmandje per gebruiker
create table if not exists list_items (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade default auth.uid(),
  product_id text references products(id) on delete cascade,
  aantal     int     default 1,
  afgevinkt  boolean default false,
  shop_keuze text,                       -- handmatige override van de goedkoopste
  created_at timestamptz default now()
);

-- één regel per gebruiker per product (voorkomt race bij voegToe)
create unique index if not exists list_items_user_product_key on list_items (user_id, product_id);

-- ── allowlist: maak toegelaten gebruikers automatisch lid ──────────────────
-- Bij eerste signup (trigger) én bij latere logins (ensure_member RPC uit de app),
-- zodat iemand die al in auth.users stond vóór allowlist-toevoeging alsnog lid wordt.

create or replace function public.promote_user_if_allowed(p_user_id uuid, p_email text, p_naam text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_email is not null and exists (select 1 from allowed_emails where lower(email) = lower(p_email)) then
    insert into members (user_id, email, naam)
    values (p_user_id, p_email, coalesce(p_naam, p_email))
    on conflict (user_id) do nothing;
  end if;
end;
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.promote_user_if_allowed(
    new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.email)
  );
  return new;
end;
$$;

create or replace function public.ensure_member()
returns void language plpgsql security definer set search_path = public as $$
declare u record;
begin
  select id, email, raw_user_meta_data into u from auth.users where id = auth.uid();
  if not found then return; end if;
  perform public.promote_user_if_allowed(
    u.id, u.email, coalesce(u.raw_user_meta_data->>'full_name', u.email)
  );
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

-- ── rechten (Postgres GRANT, los van RLS) ───────────────────────────────────
-- Supabase geeft anon/authenticated/service_role normaal rechten op public,
-- maar tabellen die je zelf aanmaakt in de SQL-editor missen die soms. Zonder
-- GRANT krijg je "permission denied for table …" — ook met de service_role key.

grant usage on schema public to anon, authenticated, service_role;

grant all on table public.allowed_emails to service_role;
grant all on table public.members        to anon, authenticated, service_role;
grant all on table public.products       to anon, authenticated, service_role;
grant all on table public.prices         to anon, authenticated, service_role;
grant all on table public.list_items     to anon, authenticated, service_role;

grant execute on function public.is_member() to anon, authenticated, service_role;
grant execute on function public.handle_new_user() to service_role;
grant execute on function public.ensure_member() to authenticated;
grant execute on function public.promote_user_if_allowed(uuid, text, text) to service_role;

-- ── Row-Level Security ─────────────────────────────────────────────────────

alter table allowed_emails enable row level security;   -- geen policies → alleen service-role
alter table members        enable row level security;
alter table products       enable row level security;
alter table prices         enable row level security;
alter table list_items     enable row level security;

-- leden mogen hun eigen lidmaatschap zien (voor de toegangscheck in de app)
drop policy if exists "eigen lid" on members;
create policy "eigen lid" on members for select using (user_id = auth.uid());

-- gedeelde catalogus + prijzen: leden lezen en beheren; buitenstaanders niets
drop policy if exists "leden products" on products;
create policy "leden products" on products for all
  using (is_member()) with check (is_member());

drop policy if exists "leden prices" on prices;
create policy "leden prices" on prices for all
  using (is_member()) with check (is_member());

-- winkelmandje: alleen je eigen regels, en alleen als je lid bent
drop policy if exists "eigen mandje" on list_items;
create policy "eigen mandje" on list_items for all
  using (user_id = auth.uid() and is_member())
  with check (user_id = auth.uid() and is_member());

-- ── realtime aanzetten (voor multi-device sync) ────────────────────────────
alter publication supabase_realtime add table products;
alter publication supabase_realtime add table prices;
alter publication supabase_realtime add table list_items;

-- ── VUL JE ALLOWLIST ───────────────────────────────────────────────────────
-- Zet hier de Google-e-mailadressen van jou + gezin. Voer daarna deze inserts
-- uit (of doe het via de Table editor). Iedereen hierbuiten krijgt geen toegang.
--
-- insert into allowed_emails (email) values
--   ('lukas@q42.nl'),
--   ('hester@example.com')
-- on conflict do nothing;
