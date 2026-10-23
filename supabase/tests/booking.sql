-- Booking tests for start_booking(), capacity, holds and the first-clean offer. Run: npm run test:db
\set ON_ERROR_STOP 1
create temp table results (ok boolean, label text);
grant all on results to public;
create function pg_temp.check(label text, cond boolean) returns void language sql as $$
  insert into results values (coalesce(cond, false), label);
$$;

-- Next Monday and Friday at least one day out, in Atlanta time.
create temp table d as
select (select x::date from generate_series(local_today() + 1, local_today() + 7, interval '1 day') x where extract(isodow from x) = 1) as mon,
       (select x::date from generate_series(local_today() + 1, local_today() + 7, interval '1 day') x where extract(isodow from x) = 7) as sun;

create function pg_temp.clean(key uuid, mobile text, street text, win text, dt date, discount int, accept boolean default false)
returns jsonb language sql as $$
  select start_booking(jsonb_build_object(
    'idempotency_key', key, 'service', 'standard', 'frequency', 'biweekly', 'beds', 3, 'baths', 2,
    'date', dt, 'window', win, 'price_per_visit_cents', 16500, 'first_visit_cents', 16500,
    'discount_cents', discount, 'accept_full_price', accept,
    'customer', jsonb_build_object('name', 'Test Customer', 'mobile', mobile, 'email', 't@example.com'),
    'address', jsonb_build_object('street', street, 'city', 'Marietta', 'zip', '30062'),
    'consents', jsonb_build_array(jsonb_build_object('kind', 'booking', 'version', 'booking-v1', 'text', 'By giving your mobile number…')),
    'utm', jsonb_build_object('utm_source', 'facebook', 'fbclid', 'abc')));
$$;

create function pg_temp.pet(key uuid, mobile text, rd text)
returns jsonb language sql as $$
  select start_booking(jsonb_build_object(
    'idempotency_key', key, 'service', 'pet', 'frequency', 'weekly', 'dogs', 2, 'yard_condition', 'weeks',
    'route_day', rd, 'date', local_today() + 3, 'price_per_visit_cents', 2700, 'first_visit_cents', 3900,
    'customer', jsonb_build_object('name', 'Yard Customer', 'mobile', mobile, 'email', 'y@example.com'),
    'address', jsonb_build_object('street', '9 Oak St', 'city', 'Decatur', 'zip', '30030', 'gate_code', 'enc:xyz'),
    'dog_names', 'Biscuit', 'dogs_friendly', true));
$$;

-- Capacity: Monday morning has 2 slots.
select pg_temp.check('first Monday-morning booking ok', (pg_temp.clean('00000000-0000-0000-0000-000000000001', '+14045550101', '1 Elm St', 'morning', (select mon from d), 3300)->>'ok')::boolean);
select pg_temp.check('ref looks like FH-YY-NNNNN', (select ref ~ '^FH-[0-9]{2}-[0-9]{5}$' from plans limit 1));
select pg_temp.check('booking is pending with a 15-minute hold', (select p.status = 'pending' and h.expires_at between now() + interval '14 minutes' and now() + interval '16 minutes' from plans p join slot_holds h on h.plan_id = p.id limit 1));
select pg_temp.check('first visit carries the discount', (select price_cents = 16500 and discount_cents = 3300 from visits limit 1));
select pg_temp.check('booking consent saved with its wording', (select count(*) = 1 from sms_consent where form = 'booking' and consent_text_version = 'booking-v1'));
select pg_temp.check('UTM saved on the plan', (select utm_source = 'facebook' and fbclid = 'abc' from plans limit 1));
select pg_temp.check('same attempt replays, no second booking',
  (pg_temp.clean('00000000-0000-0000-0000-000000000001', '+14045550101', '1 Elm St', 'morning', (select mon from d), 3300)->>'replayed')::boolean
  and (select count(*) = 1 from plans));
select pg_temp.check('second Monday-morning booking ok', (pg_temp.clean('00000000-0000-0000-0000-000000000002', '+14045550102', '2 Elm St', 'morning', (select mon from d), 3300)->>'ok')::boolean);
select pg_temp.check('third Monday-morning booking is full',
  pg_temp.clean('00000000-0000-0000-0000-000000000003', '+14045550103', '3 Elm St', 'morning', (select mon from d), 3300)->>'reason' = 'full');
select pg_temp.check('availability shows Monday morning taken 2 of 2',
  (select slots = 2 and taken = 2 from clean_availability((select mon from d), (select mon from d)) where "window" = 'morning'));
select pg_temp.check('Sunday has no slots', (select sum(slots) = 0 from clean_availability((select sun from d), (select sun from d))));

-- An expired hold frees the slot.
update slot_holds set expires_at = now() - interval '1 minute'
  where plan_id = (select id from plans where idempotency_key = '00000000-0000-0000-0000-000000000002');
select pg_temp.check('expired hold frees the slot', (pg_temp.clean('00000000-0000-0000-0000-000000000004', '+14045550104', '4 Elm St', 'morning', (select mon from d), 3300)->>'ok')::boolean);

-- A live (paid) booking keeps taking capacity without a hold.
update plans set status = 'active' where idempotency_key = '00000000-0000-0000-0000-000000000001';
delete from slot_holds where plan_id = (select id from plans where idempotency_key = '00000000-0000-0000-0000-000000000001');
select pg_temp.check('active plan still counts after its hold is gone',
  (select taken = 2 from clean_availability((select mon from d), (select mon from d)) where "window" = 'morning'));

-- A blocked date closes the day.
insert into capacity (kind, date, blocked) values ('cleaning', (select mon from d) + 1, true);
select pg_temp.check('blocked date has no slots', (select sum(slots) = 0 from clean_availability((select mon from d) + 1, (select mon from d) + 1)));

-- First-clean offer: once per household.
update customers set first_clean_offer_used_at = now() where mobile = '+14045550101';
select pg_temp.check('offer refused for a customer who used it',
  pg_temp.clean('00000000-0000-0000-0000-000000000005', '+14045550101', '1 Elm St', 'midday', (select mon from d), 3300)->>'reason' = 'offer_used');
select pg_temp.check('offer refused for the same address under a new number',
  pg_temp.clean('00000000-0000-0000-0000-000000000006', '+14045550199', '1 elm st.', 'midday', (select mon from d), 3300)->>'reason' = 'offer_used');
select pg_temp.check('accepting full price books with no discount',
  (select (r->>'ok')::boolean and (r->>'discount_cents')::int = 0
   from pg_temp.clean('00000000-0000-0000-0000-000000000006', '+14045550199', '1 elm st.', 'midday', (select mon from d), 3300, true) r));
select pg_temp.check('new household still gets the offer',
  (pg_temp.clean('00000000-0000-0000-0000-000000000007', '+14045550107', '77 Pine Rd', 'afternoon', (select mon from d), 3300)->>'discount_cents')::int = 3300);

-- Dates outside 1–60 days are refused.
select pg_temp.check('today refused', pg_temp.clean('00000000-0000-0000-0000-000000000008', '+14045550108', '8 Elm St', 'morning', local_today(), 0)->>'reason' = 'date_out_of_range');
select pg_temp.check('61 days out refused', pg_temp.clean('00000000-0000-0000-0000-000000000009', '+14045550109', '9 Elm St', 'morning', local_today() + 61, 0)->>'reason' = 'date_out_of_range');

-- Yards: capacity per route day.
update capacity set slots = 1 where kind = 'yard' and weekday = 5;
select pg_temp.check('first Friday yard ok', (pg_temp.pet('00000000-0000-0000-0000-000000000010', '+14045550110', 'fri')->>'ok')::boolean);
select pg_temp.check('pet visit has no window and the first-visit price', (select v."window" is null and v.price_cents = 3900 from visits v join plans p on p.id = v.plan_id where p.service = 'pet'));
select pg_temp.check('second Friday yard is full', pg_temp.pet('00000000-0000-0000-0000-000000000011', '+14045550111', 'fri')->>'reason' = 'full');
select pg_temp.check('Tuesday yard still open', (pg_temp.pet('00000000-0000-0000-0000-000000000012', '+14045550112', 'tue')->>'ok')::boolean);

-- Only the server may call start_booking.
set role anon;
do $$ begin
  perform start_booking('{}'::jsonb);
  insert into results values (false, 'anonymous cannot call start_booking (was allowed!)');
exception when insufficient_privilege then
  insert into results values (true, 'anonymous cannot call start_booking');
end $$;
reset role;
set role authenticated;
do $$ begin
  perform start_booking('{}'::jsonb);
  insert into results values (false, 'signed-in users cannot call start_booking (was allowed!)');
exception when insufficient_privilege then
  insert into results values (true, 'signed-in users cannot call start_booking');
end $$;
reset role;

select case when ok then 'PASS ' else 'FAIL ' end || label from results;
select count(*) filter (where not ok) || ' failed of ' || count(*) from results;
