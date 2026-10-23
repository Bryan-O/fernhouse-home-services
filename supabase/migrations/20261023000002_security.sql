-- Row-level security: the browser never reads or writes these tables directly.
-- The owner (admin_users) has full access from /admin; everything public goes through
-- the server with the service-role key, which bypasses RLS.

create function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from admin_users where user_id = auth.uid());
$$;

revoke all on function is_admin() from public;
grant execute on function is_admin() to authenticated;

do $$
declare
  t text;
begin
  foreach t in array array[
    'admin_users', 'customers', 'addresses', 'pros', 'pro_documents', 'plans', 'visits',
    'payments', 'capacity', 'quote_requests', 'waitlist', 'sms_consent', 'messages', 'manage_tokens'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('revoke all on table %I from anon', t);
    execute format(
      'create policy owner_all on %I for all to authenticated using (is_admin()) with check (is_admin())', t
    );
  end loop;
end;
$$;

-- The owner can see who else is an owner but not add themselves via the API.
drop policy owner_all on admin_users;
create policy owner_read on admin_users for select to authenticated using (is_admin());
