-- Eenmalig draaien als de agent (of app) "permission denied for table …" geeft.
-- Supabase SQL Editor → plakken → Run.

grant usage on schema public to anon, authenticated, service_role;

grant all on table public.allowed_emails to service_role;
grant all on table public.members        to anon, authenticated, service_role;
grant all on table public.products       to anon, authenticated, service_role;
grant all on table public.offers         to anon, authenticated, service_role;
grant all on table public.list_items     to anon, authenticated, service_role;
grant all on table public.purchases      to anon, authenticated, service_role;

grant execute on function public.is_member() to anon, authenticated, service_role;
grant execute on function public.handle_new_user() to service_role;
grant execute on function public.ensure_member() to authenticated;
grant execute on function public.promote_user_if_allowed(uuid, text, text) to service_role;
