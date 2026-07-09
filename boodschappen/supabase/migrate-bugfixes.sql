-- Bugfix-migratie voor bestaande Supabase-projecten (jul 2026).
-- Draai in SQL Editor als schema.sql al eerder was uitgevoerd.

-- 1. Allowlist ook bij latere logins (niet alleen bij eerste signup)
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

grant execute on function public.ensure_member() to authenticated;
grant execute on function public.promote_user_if_allowed(uuid, text, text) to service_role;

-- 2. Dubbele list_items opruimen + unieke index
delete from list_items a using list_items b
where a.user_id = b.user_id
  and a.product_id = b.product_id
  and a.id > b.id;

create unique index if not exists list_items_user_product_key on list_items (user_id, product_id);
