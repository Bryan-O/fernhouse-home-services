-- Owner dashboard and pro job page: assigning pros, days off, marking done, the yard upgrade.
-- Run: npm run test:db
\set ON_ERROR_STOP 1
create temp table results (ok boolean, label text);
grant all on results to public;
create function pg_temp.check(label text, cond boolean) returns void language sql as $$
  insert into results values (coalesce(cond, false), label);
$$;

insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000a', 'owner@example.com');
create function pg_temp.pro(id uuid, mobile text, svc pro_service[], ins_until date, off smallint[]) returns void language sql as $$
  insert into pros (id, name, mobile, service_types, off_weekdays) values (id, 'Pro', mobile, svc, off);
  insert into pro_documents (pro_id, kind, file_url, expires_on, verified_by, verified_at) values
    (id, 'insurance', 'x', ins_until, '00000000-0000-0000-0000-00000000000a', now()),
    (id, 'bond', 'x', local_today() + 365, '00000000-0000-0000-0000-00000000000a', now()),
    (id, 'background_check', 'x', null, '00000000-0000-0000-0000-00000000000a', now());
$$;
select pg_temp.pro('11111111-1111-1111-1111-111111111111', '+14045550961', '{cleaning}', local_today() + 365, '{}');
select pg_temp.pro('22222222-2222-2222-2222-222222222222', '+14045550962', '{cleaning}', local_today() + 365, '{2}'); -- off Tuesdays
select pg_temp.pro('33333333-3333-3333-3333-333333333333', '+14045550963', '{cleaning,pet}', local_today() + 20, '{}'); -- insurance ends in 20 days

create temp table d as
select (select x::date from generate_series(local_today() + 2, local_today() + 8, interval '1 day') x where extract(isodow from x) = 2) as tue;

create function pg_temp.book(mobile text, svc text, freq text) returns uuid language plpgsql as $$
declare id uuid;
begin
  id := (start_booking(jsonb_build_object(
    'idempotency_key', gen_random_uuid(), 'service', svc, 'frequency', freq,
    'beds', case when svc = 'pet' then null else 3 end, 'baths', case when svc = 'pet' then null else 2 end,
    'dogs', case when svc = 'pet' then 2 end, 'yard_condition', case when svc = 'pet' then 'weeks' end,
    'route_day', case when svc = 'pet' then 'tue' end, 'date', (select tue from d), 'window', case when svc = 'pet' then null else 'morning' end,
    'price_per_visit_cents', case when svc = 'pet' then 2700 else 16500 end, 'first_visit_cents', case when svc = 'pet' then 3900 else 16500 end, 'discount_cents', 0,
    'customer', jsonb_build_object('name', 'Ops Test', 'mobile', mobile, 'email', 'o@example.com'),
    'address', jsonb_build_object('street', mobile || ' Ops St', 'city', 'Marietta', 'zip', '30062')))->>'plan_id')::uuid;
  perform confirm_booking(id, jsonb_build_object('payment_intent', 'pi_' || id, 'amount_cents', 16500, 'stripe_customer_id', 'cus_' || left(id::text, 8), 'payment_method_id', 'pm_x'));
  return id;
end $$;

create temp table a as select pg_temp.book('+14045550971', 'standard', 'weekly') as id;
select pg_temp.check('pro off on Tuesdays can’t take Tuesday visits', (assign_plan((select id from a), '22222222-2222-2222-2222-222222222222', local_today())->>'reason') = 'cannot_take');
select pg_temp.check('no visit changed by the refused assignment', not exists (select 1 from visits where plan_id = (select id from a) and pro_id is not null));
select pg_temp.check('a yard-only booking can’t take a cleaning-only pro',
  (assign_plan(pg_temp.book('+14045550972', 'pet', 'weekly'), '11111111-1111-1111-1111-111111111111', local_today())->>'reason') = 'wrong_service');

create temp table r as select assign_plan((select id from a), '33333333-3333-3333-3333-333333333333', local_today()) as j;
select pg_temp.check('assign: visits before the insurance expiry assigned', ((select j from r)->>'assigned')::int between 2 and 3);
select pg_temp.check('assign: later visits left for another pro', ((select j from r)->>'skipped')::int >= 5);
select pg_temp.check('assigned visits are confirmed', (select bool_and(status = 'confirmed' and assigned_at is not null) from visits where plan_id = (select id from a) and pro_id is not null));
select pg_temp.check('first assigned visit returned', ((select j from r)->>'first_visit_id')::uuid = (select id from visits where plan_id = (select id from a) order by date limit 1));
select pg_temp.check('the rest go to a second pro', (assign_plan((select id from a), '11111111-1111-1111-1111-111111111111', local_today())->>'ok')::boolean);
select pg_temp.check('now every visit has a pro', not exists (select 1 from visits where plan_id = (select id from a) and pro_id is null and status = 'scheduled'));

-- Marking done.
create temp table v1 as select id, date from visits where plan_id = (select id from a) order by date limit 1;
select pg_temp.check('not before the visit day', (mark_visit_done((select id from v1), '', 0)->>'reason') = 'too_early');
update visits set date = local_today() where id = (select id from v1);
select pg_temp.check('done on the day', (mark_visit_done((select id from v1), '  Skipped the garage (locked)  ', 0)->>'ok')::boolean);
select pg_temp.check('done saves time and note', (select status = 'done' and completed_at is not null and pro_note = 'Skipped the garage (locked)' and upgrade_status is null from visits where id = (select id from v1)));
select pg_temp.check('marking done twice is harmless', (mark_visit_done((select id from v1), '', 0)->>'already')::boolean);

-- Yard: gate photo required, then the upgrade question.
create temp table y as select pg_temp.book('+14045550973', 'pet', 'weekly') as id;
select assign_plan((select id from y), '33333333-3333-3333-3333-333333333333', local_today());
create temp table yv as select id from visits where plan_id = (select id from y) order by date limit 1;
update visits set date = local_today() where id = (select id from yv);
do $$ begin
  perform mark_visit_done((select id from yv), '', 7500);
  insert into results values (false, 'yard visit needs a gate photo (was marked done without!)');
exception when check_violation then insert into results values (true, 'yard visit needs a gate photo');
end $$;
update visits set gate_photo_url = 'visits/x.jpg' where id = (select id from yv);
select pg_temp.check('yard done with photo, worse than booked', (mark_visit_done((select id from yv), '', 7500)->>'ok')::boolean);
select pg_temp.check('upgrade waits for the customer', (select upgrade_status = 'pending' and upgrade_cents = 7500 and price_cents = 3900 from visits where id = (select id from yv)));
select pg_temp.check('YES raises the price', answer_upgrade((select id from yv), true));
select pg_temp.check('approved at the higher price', (select upgrade_status = 'approved' and price_cents = 7500 from visits where id = (select id from yv)));
select pg_temp.check('a second answer changes nothing', not answer_upgrade((select id from yv), false));

-- Server only.
set role authenticated;
do $$ begin
  perform assign_plan((select id from a), '11111111-1111-1111-1111-111111111111', local_today());
  insert into results values (false, 'signed-in users cannot assign (was allowed!)');
exception when insufficient_privilege then insert into results values (true, 'signed-in users cannot assign');
end $$;
select pg_temp.check('non-owners see no pro links', (select count(*) = 0 from pro_links));
reset role;

select case when ok then 'PASS ' else 'FAIL ' end || label from results;
select count(*) filter (where not ok) || ' failed of ' || count(*) from results;
