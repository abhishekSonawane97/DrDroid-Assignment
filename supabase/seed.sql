-- Run this once after `npm run db:push` (and again any time db:push adds
-- a new user-owned table). Four things this covers that `db:push` alone
-- does not:
--
-- 1. Baseline grants. Tables here are created by Drizzle, not Supabase's
--    own migration tooling, so `authenticated` doesn't automatically get
--    the table privileges Supabase normally sets up. RLS policies alone
--    are not enough — Postgres requires the base command privilege before
--    a policy is even evaluated. `alter default privileges` makes this
--    apply to future tables too.
--
-- 2. RLS policies. drizzle-kit push (0.31.x) silently drops the
--    using/withCheck expressions on schema-defined pgPolicy() — verified
--    empirically (policies were created with qual/with_check = null,
--    i.e. non-functional). Raw SQL is the reliable path, so it's the
--    single source of truth for policies; db/schema.ts only enables RLS.

grant usage on schema public to authenticated;
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

-- users: a row is its own owner (id = auth.uid()), not via a user_id column.
drop policy if exists users_select_own on users;
create policy users_select_own on users
  for select to authenticated
  using (auth.uid() = id);

drop policy if exists users_update_own on users;
create policy users_update_own on users
  for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- chat_threads
drop policy if exists chat_threads_select_own on chat_threads;
create policy chat_threads_select_own on chat_threads
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists chat_threads_insert_own on chat_threads;
create policy chat_threads_insert_own on chat_threads
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists chat_threads_update_own on chat_threads;
create policy chat_threads_update_own on chat_threads
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists chat_threads_delete_own on chat_threads;
create policy chat_threads_delete_own on chat_threads
  for delete to authenticated
  using (auth.uid() = user_id);

-- messages: ownership is one hop away via chat_threads.user_id.
drop policy if exists messages_select_own on messages;
create policy messages_select_own on messages
  for select to authenticated
  using (auth.uid() = (select user_id from chat_threads where chat_threads.id = messages.thread_id));

drop policy if exists messages_insert_own on messages;
create policy messages_insert_own on messages
  for insert to authenticated
  with check (auth.uid() = (select user_id from chat_threads where chat_threads.id = messages.thread_id));

-- api_keys
drop policy if exists api_keys_select_own on api_keys;
create policy api_keys_select_own on api_keys
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists api_keys_insert_own on api_keys;
create policy api_keys_insert_own on api_keys
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists api_keys_update_own on api_keys;
create policy api_keys_update_own on api_keys
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- usage_logs (read-only for the owner; writes go through the server)
drop policy if exists usage_logs_select_own on usage_logs;
create policy usage_logs_select_own on usage_logs
  for select to authenticated
  using (auth.uid() = user_id);

-- payments (read-only for the owner; writes go through the Stripe webhook)
drop policy if exists payments_select_own on payments;
create policy payments_select_own on payments
  for select to authenticated
  using (auth.uid() = user_id);

-- coupon_redemptions (read-only for the owner; writes go through the server)
drop policy if exists coupon_redemptions_select_own on coupon_redemptions;
create policy coupon_redemptions_select_own on coupon_redemptions
  for select to authenticated
  using (auth.uid() = user_id);

-- 3. Bootstrap a public.users profile row whenever Supabase Auth creates a
--    new auth.users row (any provider, any flow), rather than relying on
--    app code in the OAuth callback to remember to do it. security definer
--    is required: this fires as the auth trigger role, which has no
--    privileges on public.users otherwise.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, email, provider, credits, is_unlocked)
  values (
    new.id,
    new.email,
    coalesce(new.raw_app_meta_data->>'provider', 'unknown'),
    0,
    false
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- 4. PDF report storage. Private bucket (not public) — files are only
--    reachable via short-lived signed URLs. Objects are stored at
--    `{user_id}/{report_id}.pdf`; RLS checks the first path segment
--    against auth.uid(), same ownership pattern as every other table.
insert into storage.buckets (id, name, public)
values ('reports', 'reports', false)
on conflict (id) do nothing;

drop policy if exists reports_select_own on storage.objects;
create policy reports_select_own on storage.objects
  for select to authenticated
  using (bucket_id = 'reports' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists reports_insert_own on storage.objects;
create policy reports_insert_own on storage.objects
  for insert to authenticated
  with check (bucket_id = 'reports' and (storage.foldername(name))[1] = auth.uid()::text);
