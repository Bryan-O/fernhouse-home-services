-- Manage-booking tests: visit generation, reschedule, skip/cancel, pause, route day, upsell. Run: npm run test:db
\set ON_ERROR_STOP 1
create temp table results (ok boolean, label text);
grant all on results to public;
create function pg_temp.check(label text, cond boolean) returns void language sql as $$
  insert into results values (coalesce(cond, false), label);
$$;

create temp table d as
select (select x::date from generate_series(local_today() + 2, local_today() + 8, interval '1 day') x where extract(isodow from x) = 2) as tue;

create function pg_temp.clean(key uuid, mobile text, freq text, win text, dt date) returns uuid language plpgsql as $$
declare id uuid;
begin
  id := (start_booking(jsonb_build_object(
    'idempotency_key', key, 'service', 'standard', 'frequency', freq, 'beds', 3, 'baths', 2,
    'date', dt, 'window', win, 'price_per_visit_cents', 16500, 'first_visit_cents', 16500, 'discount_cents', 3300,
    'customer', jsonb_build_object('name', 'Manage Test', 'mobile', mobile, 'email', 'm@example.com'),
    'address', jsonb_build_object('street', mobile || ' Elm', 'city', 'Marietta', 'zip', '30062')))->>'plan_id')::uuid;
  perform confirm_booking(id, jsonb_build_object('payment_intent', 'pi_' || key, 'amount_cents', 13200));
  return id;
end $$;

-- Biweekly plan: paid → visits every 14 days for 60 days.
create temp table a as select pg_temp.clean('00000000-0000-0000-0000-0000000000a1', '+14045550801', 'biweekly', 'morning', (select tue from d)) as id;
select pg_temp.check('paid biweekly plan gets its visits for 60 days',
  (select count(*) between 4 and 5 and bool_and(extract(dow from date) = 2) and bool_and("window" = 'morning') from visits where plan_id = (select id from a)));
select pg_temp.check('later visits use the per-visit price, no discount',
  (select bool_and(price_cents = 16500 and discount_cents = 0) from visits where plan_id = (select id from a) and date > (select tue from d)));
select pg_temp.check('regenerating adds nothing', generate_plan_visits((select id from a), local_today() + 60) = 0);

-- Reschedule the second visit to Wednesday midday (free).
create temp table v2 as select id, date from visits where plan_id = (select id from a) order by date offset 1 limit 1;
select pg_temp.check('reschedule ok', (reschedule_visit((select id from v2), (select date from v2) + 1, 'midday', 0)->>'ok')::boolean);
select pg_temp.check('moved visit keeps its cadence slot', (select date = occurrence_date + 1 and "window" = 'midday' from visits where id = (select id from v2)));
select pg_temp.check('regenerating does not recreate the moved visit', generate_plan_visits((select id from a), local_today() + 60) = 0);
select pg_temp.check('late reschedule ok', (reschedule_visit((select id from v2), (select date from v2) + 2, 'midday', 5000)->>'ok')::boolean);
select pg_temp.check('late reschedule records the fee', (select fee_cents = 5000 from visits where id = (select id from v2)));
update capacity set slots = 0 where kind = 'cleaning' and weekday = 5 and "window" = 'afternoon';
select pg_temp.check('reschedule into a full slot refused', reschedule_visit((select id from v2), (select date from v2) + 3, 'afternoon', 0)->>'reason' = 'full');

-- Skip and cancel.
create temp table v3 as select id from visits where plan_id = (select id from a) order by date offset 2 limit 1;
select pg_temp.check('skip ok', (drop_visit((select id from v3), 'skipped', 0)->>'ok')::boolean);
select pg_temp.check('visit marked skipped', (select status = 'skipped' from visits where id = (select id from v3)));
select pg_temp.check('undo skip ok', restore_visit((select id from v3)));
select pg_temp.check('visit back on', (select status = 'scheduled' from visits where id = (select id from v3)));
select pg_temp.check('late cancel ok', (drop_visit((select id from v3), 'cancelled', 5000)->>'ok')::boolean);
select pg_temp.check('late cancel records the fee, plan continues', (select status = 'cancelled' and fee_cents = 5000 from visits where id = (select id from v3)) and (select status = 'active' from plans where id = (select id from a)));
select pg_temp.check('cannot cancel twice', drop_visit((select id from v3), 'cancelled', 0)->>'reason' = 'not_open');
select pg_temp.check('a visit with a fee cannot be un-skipped', not restore_visit((select id from v3)));

-- Pause and resume.
select pg_temp.check('pause ok', set_plan_paused((select id from a), true));
select pg_temp.check('pause removes later visits but keeps the prepaid first one',
  (select count(*) = 1 from visits v where v.plan_id = (select id from a) and v.status in ('scheduled', 'confirmed') and v.date > local_today() + 1));
select pg_temp.check('resume ok', set_plan_paused((select id from a), false));
select pg_temp.check('visits come back after resume', (select count(*) >= 3 from visits where plan_id = (select id from a) and status in ('scheduled', 'confirmed')));

-- One-time clean → upsell to biweekly.
create temp table o as select pg_temp.clean('00000000-0000-0000-0000-0000000000b1', '+14045550802', 'one_time', 'afternoon', (select tue from d)) as id;
select pg_temp.check('one-time plan has a single visit', (select count(*) = 1 from visits where plan_id = (select id from o)));
select pg_temp.check('make recurring ok', make_plan_recurring((select id from o), 16500));
select pg_temp.check('now biweekly at the biweekly price with visits', (select frequency = 'biweekly' and price_per_visit_cents = 16500 from plans where id = (select id from o))
  and (select count(*) > 1 from visits where plan_id = (select id from o)));
select pg_temp.check('upsell only once', not make_plan_recurring((select id from o), 16500));

-- Cancelling a one-time visit ends the plan.
create temp table o2 as select pg_temp.clean('00000000-0000-0000-0000-0000000000b2', '+14045550803', 'one_time', 'midday', (select tue from d)) as id;
select drop_visit((select id from visits where plan_id = (select id from o2)), 'cancelled', 0);
select pg_temp.check('cancelling a one-time visit ends the plan', (select status = 'ended' from plans where id = (select id from o2)));

-- End a plan.
select pg_temp.check('end plan ok', end_plan((select id from a)));
select pg_temp.check('ended plan has no visits left beyond tomorrow',
  not exists (select 1 from visits where plan_id = (select id from a) and status in ('scheduled', 'confirmed') and date > local_today() + 1));

-- Yards: generation, twice weekly, route-day change.
create temp table y as select (start_booking(jsonb_build_object(
  'idempotency_key', '00000000-0000-0000-0000-0000000000c1', 'service', 'pet', 'frequency', 'twice_weekly', 'dogs', 2, 'yard_condition', 'kept',
  'route_day', 'tue', 'date', (select tue from d), 'price_per_visit_cents', 2300, 'first_visit_cents', 2300,
  'customer', jsonb_build_object('name', 'Yard', 'mobile', '+14045550804', 'email', 'y@example.com'),
  'address', jsonb_build_object('street', '8 Yard St', 'city', 'Decatur', 'zip', '30030')))->>'plan_id')::uuid as id;
select confirm_booking((select id from y), '{}');
select pg_temp.check('twice weekly yard: Tuesdays and Fridays', (select bool_and(extract(dow from date) in (2, 5)) and count(*) filter (where extract(dow from date) = 5) >= 7 from visits where plan_id = (select id from y)));
select pg_temp.check('route day change ok', (change_route_day((select id from y), 'thu', (select tue from d) + 9)->>'ok')::boolean);
select pg_temp.check('route day now Thursday', (select route_day = 'thu' from plans where id = (select id from y)));
select pg_temp.check('future visits now Thursdays and Mondays', (select bool_and(extract(dow from date) in (4, 1)) from visits where plan_id = (select id from y) and date >= (select tue from d) + 9));
update capacity set slots = 0 where kind = 'yard' and weekday = 3;
select pg_temp.check('change to a full route day refused', change_route_day((select id from y), 'wed', (select tue from d) + 8)->>'reason' = 'full');

-- Re-clean request: one per visit.
insert into service_requests (visit_id, kind, note) select id, 'reclean', 'Guest bath missed' from visits where plan_id = (select id from o) order by date limit 1;
do $$ begin
  insert into service_requests (visit_id, kind) select id, 'reclean' from visits where plan_id = (select id from o) order by date limit 1;
  insert into results values (false, 'one request per visit (was allowed!)');
exception when unique_violation then insert into results values (true, 'one request per visit');
end $$;

-- Server only.
set role authenticated;
do $$ begin
  perform drop_visit(gen_random_uuid(), 'cancelled', 0);
  insert into results values (false, 'signed-in users cannot change visits (was allowed!)');
exception when insufficient_privilege then insert into results values (true, 'signed-in users cannot change visits');
end $$;
reset role;

select case when ok then 'PASS ' else 'FAIL ' end || label from results;
select count(*) filter (where not ok) || ' failed of ' || count(*) from results;
