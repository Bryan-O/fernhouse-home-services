-- Payment tests for confirm_booking() and abandon_booking(). Run: npm run test:db
\set ON_ERROR_STOP 1
create temp table results (ok boolean, label text);
grant all on results to public;
create function pg_temp.check(label text, cond boolean) returns void language sql as $$
  insert into results values (coalesce(cond, false), label);
$$;

create temp table d as
select (select x::date from generate_series(local_today() + 1, local_today() + 7, interval '1 day') x where extract(isodow from x) = 1) as mon;

create function pg_temp.book(key uuid, mobile text, street text, win text) returns uuid language sql as $$
  select (start_booking(jsonb_build_object(
    'idempotency_key', key, 'service', 'standard', 'frequency', 'biweekly', 'beds', 3, 'baths', 2,
    'date', (select mon from d), 'window', win, 'price_per_visit_cents', 16500, 'first_visit_cents', 16500, 'discount_cents', 3300,
    'customer', jsonb_build_object('name', 'Pay Test', 'mobile', mobile, 'email', 'p@example.com'),
    'address', jsonb_build_object('street', street, 'city', 'Marietta', 'zip', '30062')))->>'plan_id')::uuid;
$$;

-- Paid within the hold.
create temp table a as select pg_temp.book('00000000-0000-0000-0000-0000000000a1', '+14045550601', '1 Pay St', 'morning') as id;
select pg_temp.check('confirm ok', (confirm_booking((select id from a), '{"payment_intent":"pi_A","amount_cents":13200,"stripe_customer_id":"cus_A","payment_method_id":"pm_A","card_brand":"visa","card_last4":"4242"}')->>'ok')::boolean);
select pg_temp.check('plan is active, hold released', (select status = 'active' from plans where id = (select id from a)) and not exists (select 1 from slot_holds where plan_id = (select id from a)));
select pg_temp.check('payment recorded as succeeded', (select amount_cents = 13200 and status = 'succeeded' and kind = 'visit' from payments where stripe_payment_intent = 'pi_A'));
select pg_temp.check('card saved on the customer', (select stripe_customer_id = 'cus_A' and stripe_payment_method_id = 'pm_A' and card_last4 = '4242' from customers where mobile = '+14045550601'));
select pg_temp.check('first-clean offer marked used', (select first_clean_offer_used_at is not null from customers where mobile = '+14045550601'));
select pg_temp.check('second confirm is a no-op', (select (r->>'already')::boolean and (select count(*) = 1 from payments) from confirm_booking((select id from a), '{"payment_intent":"pi_A","amount_cents":13200}') r));
select pg_temp.check('active plan still takes its slot', (select taken = 1 from clean_availability((select mon from d), (select mon from d)) where "window" = 'morning'));

do $$ begin
  insert into payments (visit_id, stripe_payment_intent, amount_cents, kind, status)
  select visit_id, 'pi_A2', 13200, 'visit', 'succeeded' from payments where stripe_payment_intent = 'pi_A';
  insert into results values (false, 'double charge blocked (was allowed!)');
exception when unique_violation then
  insert into results values (true, 'double charge blocked');
end $$;
do $$ begin
  insert into payments (visit_id, stripe_payment_intent, amount_cents, kind, status)
  select visit_id, 'pi_A3', 13200, 'visit', 'failed' from payments where stripe_payment_intent = 'pi_A';
  insert into results values (true, 'a failed attempt can still be recorded');
end $$;

-- Paid after the hold ran out, slot still free → confirmed.
create temp table b as select pg_temp.book('00000000-0000-0000-0000-0000000000b1', '+14045550602', '2 Pay St', 'midday') as id;
update slot_holds set expires_at = now() - interval '1 minute' where plan_id = (select id from b);
select pg_temp.check('late payment confirmed when the slot is still free', (confirm_booking((select id from b), '{"payment_intent":"pi_B","amount_cents":13200}')->>'ok')::boolean);

-- Paid after the hold ran out, slot taken meanwhile → refused, booking closed.
update capacity set slots = 1 where kind = 'cleaning' and weekday = 1 and "window" = 'afternoon';
create temp table c as select pg_temp.book('00000000-0000-0000-0000-0000000000c1', '+14045550603', '3 Pay St', 'afternoon') as id;
update slot_holds set expires_at = now() - interval '1 minute' where plan_id = (select id from c);
create temp table c2 as select pg_temp.book('00000000-0000-0000-0000-0000000000c2', '+14045550604', '4 Pay St', 'afternoon') as id;
select pg_temp.check('someone else took the freed afternoon slot', (select id from c2) is not null);
select pg_temp.check('late payment for a taken slot is refused', confirm_booking((select id from c), '{"payment_intent":"pi_C","amount_cents":13200}')->>'reason' = 'slot_taken');
select pg_temp.check('refused booking is ended and its visit cancelled', (select p.status = 'ended' and v.status = 'cancelled' from plans p join visits v on v.plan_id = p.id where p.id = (select id from c)));
select pg_temp.check('no payment row for a refused booking', not exists (select 1 from payments where stripe_payment_intent = 'pi_C'));
select pg_temp.check('offer not used by a refused booking', (select first_clean_offer_used_at is null from customers where mobile = '+14045550603'));

-- Checkout expired → booking abandoned and slot freed.
select pg_temp.check('abandon frees a pending booking', abandon_booking((select id from c2)));
select pg_temp.check('abandoned booking ended, visit cancelled, hold gone',
  (select p.status = 'ended' and v.status = 'cancelled' from plans p join visits v on v.plan_id = p.id where p.id = (select id from c2))
  and not exists (select 1 from slot_holds where plan_id = (select id from c2)));
select pg_temp.check('abandon never touches a paid booking', not abandon_booking((select id from a)) and (select status = 'active' from plans where id = (select id from a)));

-- Pet: card saved, nothing charged.
create temp table pet as select (start_booking(jsonb_build_object(
  'idempotency_key', '00000000-0000-0000-0000-0000000000e1', 'service', 'pet', 'frequency', 'weekly', 'dogs', 1, 'yard_condition', 'kept',
  'route_day', 'wed', 'date', local_today() + 3, 'price_per_visit_cents', 2400, 'first_visit_cents', 2400,
  'customer', jsonb_build_object('name', 'Yard', 'mobile', '+14045550605', 'email', 'y@example.com'),
  'address', jsonb_build_object('street', '5 Yard St', 'city', 'Decatur', 'zip', '30030')))->>'plan_id')::uuid as id;
select pg_temp.check('pet confirm with saved card, no payment', (confirm_booking((select id from pet), '{"stripe_customer_id":"cus_E","payment_method_id":"pm_E","card_brand":"mastercard","card_last4":"4444"}')->>'ok')::boolean
  and not exists (select 1 from payments p join visits v on v.id = p.visit_id where v.plan_id = (select id from pet)));

-- Server only.
set role authenticated;
do $$ begin
  perform confirm_booking(gen_random_uuid(), '{}');
  insert into results values (false, 'signed-in users cannot confirm bookings (was allowed!)');
exception when insufficient_privilege then
  insert into results values (true, 'signed-in users cannot confirm bookings');
end $$;
reset role;

select case when ok then 'PASS ' else 'FAIL ' end || label from results;
select count(*) filter (where not ok) || ' failed of ' || count(*) from results;
