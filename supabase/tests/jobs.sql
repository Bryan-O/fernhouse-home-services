-- Scheduled-job queries: recurring charges, declined charges, unassigned visits, access clean-up,
-- ratings. Run: npm run test:db
\set ON_ERROR_STOP 1
create temp table results (ok boolean, label text);
grant all on results to public;
create function pg_temp.check(label text, cond boolean) returns void language sql as $$
  insert into results values (coalesce(cond, false), label);
$$;

-- A verified pro, for assigning and completing visits.
insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000a', 'owner@example.com');
insert into pros (id, name, mobile, service_types) values ('33333333-3333-3333-3333-333333333333', 'Pro', '+14045550950', '{cleaning,pet}');
insert into pro_documents (pro_id, kind, file_url, expires_on, verified_by, verified_at) values
  ('33333333-3333-3333-3333-333333333333', 'insurance', 'x', local_today() + 365, '00000000-0000-0000-0000-00000000000a', now()),
  ('33333333-3333-3333-3333-333333333333', 'bond', 'x', local_today() + 365, '00000000-0000-0000-0000-00000000000a', now()),
  ('33333333-3333-3333-3333-333333333333', 'background_check', 'x', null, '00000000-0000-0000-0000-00000000000a', now());

create function pg_temp.book(mobile text, svc text, freq text, dt date, prepaid boolean) returns uuid language plpgsql as $$
declare id uuid;
begin
  id := (start_booking(jsonb_build_object(
    'idempotency_key', gen_random_uuid(), 'service', svc, 'frequency', freq,
    'beds', case when svc = 'pet' then null else 3 end, 'baths', case when svc = 'pet' then null else 2 end,
    'dogs', case when svc = 'pet' then 1 end, 'yard_condition', case when svc = 'pet' then 'kept' end,
    'route_day', case when svc = 'pet' then lower(to_char(dt, 'Dy')) end,
    'date', dt, 'window', case when svc = 'pet' then null else 'morning' end,
    'price_per_visit_cents', 16500, 'first_visit_cents', 16500, 'discount_cents', 0,
    'customer', jsonb_build_object('name', 'Job Test', 'mobile', mobile, 'email', 'j@example.com'),
    'address', jsonb_build_object('street', mobile || ' Job St', 'city', 'Marietta', 'zip', '30062', 'access_notes', 'v1:secret', 'gate_code', 'v1:gate')))->>'plan_id')::uuid;
  perform confirm_booking(id, case when prepaid then jsonb_build_object('payment_intent', 'pi_' || id, 'amount_cents', 16500) else '{}'::jsonb end);
  return id;
end $$;

create temp table d as
select (select x::date from generate_series(local_today() + 2, local_today() + 8, interval '1 day') x where extract(isodow from x) = 2) as tue;

-- Weekly clean, first visit prepaid at booking.
create temp table a as select pg_temp.book('+14045550951', 'standard', 'weekly', (select tue from d), true) as id;
create temp table av as select id, date from visits where plan_id = (select id from a) order by date;
select pg_temp.check('first (prepaid) visit is not charged again', not exists (select 1 from clean_charges_due((select min(date) from av)) x where x = (select id from av order by date limit 1)));
select pg_temp.check('second weekly visit is due on its day', (select id from av order by date offset 1 limit 1) in (select clean_charges_due((select date from av order by date offset 1 limit 1))));
select pg_temp.check('not due the day before', (select id from av order by date offset 1 limit 1) not in (select clean_charges_due((select date from av order by date offset 1 limit 1) - 1)));
select pg_temp.check('still due 2 days later (missed runs catch up)', (select id from av order by date offset 1 limit 1) in (select clean_charges_due((select date from av order by date offset 1 limit 1) + 2)));
select pg_temp.check('not due 3 days later', (select id from av order by date offset 1 limit 1) not in (select clean_charges_due((select date from av order by date offset 1 limit 1) + 3)));
update visits set status = 'skipped' where id = (select id from av order by date offset 2 limit 1);
select pg_temp.check('skipped visit is not charged', (select id from av order by date offset 2 limit 1) not in (select clean_charges_due((select date from av order by date offset 2 limit 1))));

-- Yard visits are charged when done, not by this job.
create temp table y as select pg_temp.book('+14045550952', 'pet', 'weekly', (select tue from d), false) as id;
select pg_temp.check('yard visits are not charged in the morning', not exists (select 1 from clean_charges_due((select tue from d)) x join visits v on v.id = x where v.plan_id = (select id from y)));

-- Declined charges.
create temp table v2 as select id from av order by date offset 1 limit 1;
insert into payments (visit_id, stripe_payment_intent, amount_cents, kind, status, created_at) values
  ((select id from v2), 'pi_f1', 16500, 'visit', 'failed', now() - interval '30 hours'),
  ((select id from v2), 'pi_f2', 16500, 'visit', 'failed', now() - interval '2 hours');
select pg_temp.check('one open decline per visit: the latest attempt',
  (select count(*) = 1 and bool_and(failed_at > now() - interval '3 hours') and bool_and(amount_cents = 16500) from open_failed_charges(now() - interval '14 days') where visit_id = (select id from v2)));
select pg_temp.check('declined visit is no longer due for a morning charge', (select id from v2) not in (select clean_charges_due((select date from av order by date offset 1 limit 1))));
insert into payments (visit_id, stripe_payment_intent, amount_cents, kind, status) values ((select id from v2), 'pi_ok', 16500, 'visit', 'succeeded');
select pg_temp.check('paid after a new card: no longer open', not exists (select 1 from open_failed_charges(now() - interval '14 days') where visit_id = (select id from v2)));

-- Unassigned visits: counted by booking; the next week, plus every visit of a booking with no pro yet.
select pg_temp.check('new bookings show as unassigned', (select count(distinct plan_id) >= 2 from unassigned_visits(local_today(), 7)));
update visits set pro_id = '33333333-3333-3333-3333-333333333333', assigned_at = now() where id = (select id from av order by date limit 1);
select pg_temp.check('a booking with a pro: only its visits in the next week remain', not exists (
  select 1 from unassigned_visits(local_today(), 7) u where u.plan_id = (select id from a) and u.date > local_today() + 7));

-- Access codes are kept while service continues, cleared after it ends.
select pg_temp.check('nothing cleared while plans are live', clear_ended_access() = 0);
update visits set status = 'cancelled' where plan_id = (select id from y) and status = 'scheduled';
update plans set status = 'ended', ended_at = now() where id = (select id from y);
select pg_temp.check('ended plan: access cleared', clear_ended_access() = 1);
select pg_temp.check('gate code gone', (select gate_code is null and access_notes is null from addresses where id = (select address_id from plans where id = (select id from y))));
update plans set status = 'ended', ended_at = now() where id = (select id from a);
select pg_temp.check('ended plan with a visit still to come keeps its codes', clear_ended_access() = 0);

-- Ratings: one per visit, 1–5.
update visits set status = 'done', completed_at = now() where id = (select id from av order by date limit 1);
insert into ratings (customer_id, visit_id, score) select customer_id, (select id from av order by date limit 1), 5 from plans where id = (select id from a);
do $$ begin
  insert into ratings (customer_id, visit_id, score) select customer_id, (select id from av order by date limit 1), 1 from plans where id = (select id from a);
  insert into results values (false, 'one rating per visit (was allowed twice!)');
exception when unique_violation then insert into results values (true, 'one rating per visit');
end $$;
do $$ begin
  insert into ratings (customer_id, visit_id, score) select customer_id, (select id from av order by date offset 3 limit 1), 6 from plans where id = (select id from a);
  insert into results values (false, 'ratings are 1–5 (6 was allowed!)');
exception when check_violation then insert into results values (true, 'ratings are 1–5');
end $$;

-- Server only.
set role authenticated;
do $$ begin
  perform clean_charges_due(local_today());
  insert into results values (false, 'signed-in users cannot run job queries (was allowed!)');
exception when insufficient_privilege then insert into results values (true, 'signed-in users cannot run job queries');
end $$;
select pg_temp.check('non-owners see no ratings', (select count(*) = 0 from ratings));
reset role;

select case when ok then 'PASS ' else 'FAIL ' end || label from results;
select count(*) filter (where not ok) || ' failed of ' || count(*) from results;
