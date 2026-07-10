-- Parro-dashboard — Supabase schema + Row-Level Security
-- Draai dit in de Supabase SQL-editor (zie supabase/README.md).
--
-- Bedoeld voor HETZELFDE Supabase-project als de boodschappen-app: het
-- allowlist/leden-deel hieronder is identiek en idempotent (create if not
-- exists / create or replace), dus dubbel draaien kan geen kwaad. Gebruik je
-- een vers project, dan zet dit bestand ook de allowlist zelf op.
--
-- Model: alle Parro-data is GEDEELD leesbaar voor leden (gezin). Schrijven
-- doet alleen de lokale agent met de service-role key — behalve het afvinken
-- van acties, dat mogen leden vanuit de app.

-- ── allowlist + leden (gedeeld met boodschappen; idempotent) ───────────────

create table if not exists allowed_emails (
  email text primary key
);

create table if not exists members (
  user_id  uuid primary key references auth.users(id) on delete cascade,
  email    text,
  naam     text,
  added_at timestamptz default now()
);

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

create or replace function public.is_member()
returns boolean language sql security definer set search_path = public as $$
  select exists (select 1 from members where user_id = auth.uid())
$$;

-- ── Parro-tabellen ──────────────────────────────────────────────────────────

-- ruwe items uit Parro (mededelingen, agenda-items, chatberichten)
create table if not exists parro_items (
  id          text primary key,          -- '<bron>:<parro-id>', bv 'event:12345'
  soort       text not null check (soort in ('mededeling','agenda','chat')),
  titel       text,
  tekst       text,
  groep       text,                      -- groepsnaam uit Parro
  afzender    text,
  datum       timestamptz,               -- sort_date (events) of sent_at (chat)
  raw         jsonb,
  verwerkt    boolean not null default false,  -- door Claude-verrijking gezien?
  belangrijk  boolean not null default false,  -- door verrijking gezet
  actie_nodig boolean not null default false,  -- door verrijking gezet
  synced_at   timestamptz default now()
);

-- verrijkte agenda: wat komt er aan, per kind, met kind-van-de-week vlag
create table if not exists parro_agenda (
  id               uuid primary key default gen_random_uuid(),
  item_id          text references parro_items(id) on delete cascade,
  datum            date not null,
  eind_datum       date,
  titel            text not null,
  omschrijving     text,
  kind             text,                       -- naam van het kind, of null = beide/onbekend
  kind_van_de_week boolean not null default false,
  created_at       timestamptz default now()
);

-- acties per agenda-item: meenemen / voorbereiden / regelen (afvinkbaar in de app)
create table if not exists parro_acties (
  id             uuid primary key default gen_random_uuid(),
  agenda_id      uuid references parro_agenda(id) on delete cascade,
  tekst          text not null,
  uiterlijk      date,                          -- deadline, indien genoemd
  afgevinkt      boolean not null default false,
  afgevinkt_door text,
  created_at     timestamptz default now()
);

-- wekelijkse samenvatting (door week.mjs gegenereerd)
create table if not exists parro_weekoverzicht (
  week_start   date primary key,                -- de maandag van de week
  samenvatting text not null,                   -- markdown
  created_at   timestamptz default now()
);

create index if not exists parro_items_datum_idx  on parro_items (datum desc);
create index if not exists parro_agenda_datum_idx on parro_agenda (datum);

-- ── rechten (Postgres GRANT, los van RLS) ───────────────────────────────────

grant usage on schema public to anon, authenticated, service_role;

grant all on table public.allowed_emails to service_role;
grant all on table public.members            to anon, authenticated, service_role;
grant all on table public.parro_items        to authenticated, service_role;
grant all on table public.parro_agenda       to authenticated, service_role;
grant all on table public.parro_acties       to authenticated, service_role;
grant all on table public.parro_weekoverzicht to authenticated, service_role;

grant execute on function public.is_member() to anon, authenticated, service_role;
grant execute on function public.handle_new_user() to service_role;
grant execute on function public.ensure_member() to authenticated;
grant execute on function public.promote_user_if_allowed(uuid, text, text) to service_role;

-- ── Row-Level Security ──────────────────────────────────────────────────────

alter table allowed_emails      enable row level security;  -- geen policies → alleen service-role
alter table members             enable row level security;
alter table parro_items         enable row level security;
alter table parro_agenda        enable row level security;
alter table parro_acties        enable row level security;
alter table parro_weekoverzicht enable row level security;

drop policy if exists "eigen lid" on members;
create policy "eigen lid" on members for select using (user_id = auth.uid());

-- leden lezen alles; schrijven gebeurt via de service-role (agent)
drop policy if exists "leden lezen items" on parro_items;
create policy "leden lezen items" on parro_items for select using (is_member());

drop policy if exists "leden lezen agenda" on parro_agenda;
create policy "leden lezen agenda" on parro_agenda for select using (is_member());

drop policy if exists "leden lezen weekoverzicht" on parro_weekoverzicht;
create policy "leden lezen weekoverzicht" on parro_weekoverzicht for select using (is_member());

-- acties: leden mogen lezen én afvinken
drop policy if exists "leden lezen acties" on parro_acties;
create policy "leden lezen acties" on parro_acties for select using (is_member());

drop policy if exists "leden vinken acties af" on parro_acties;
create policy "leden vinken acties af" on parro_acties for update
  using (is_member()) with check (is_member());

-- ── realtime (afgevinkte acties direct op alle devices) ─────────────────────
do $$ begin
  alter publication supabase_realtime add table parro_acties;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table parro_agenda;
exception when duplicate_object then null; end $$;

-- ── VUL JE ALLOWLIST (overslaan als het boodschappen-project al gevuld is) ──
-- insert into allowed_emails (email) values
--   ('lukas@q42.nl'),
--   ('<e-mailadres van je vrouw>')
-- on conflict do nothing;
