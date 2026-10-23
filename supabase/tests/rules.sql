-- Rule and row-level-security tests for supabase/migrations. Run: npm run test:db
\set ON_ERROR_STOP 1
create temp table results (ok boolean, label text);
grant all on results to public;
create function pg_temp.expect(label text, stmt text, should_fail boolean) returns void language plpgsql as $$
begin
  begin
    execute stmt;
    insert into results values (not should_fail, label || case when should_fail then ' (was accepted!)' else '' end);
  exception when others then
    insert into results values (should_fail, label || case when should_fail then '' else ' (rejected: ' || sqlerrm || ')' end);
  end;
end $$;

insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000a', 'owner@example.com'), ('00000000-0000-0000-0000-00000000000b', 'someone@example.com');
insert into admin_users values ('00000000-0000-0000-0000-00000000000a');
insert into customers (id, name, mobile, email) values ('11111111-1111-1111-1111-111111111111', 'Taylor M.', '+16784396213', 'taylor@example.com');
insert into addresses (id, customer_id, street, city, zip) values ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', '482 Maple Ridge Dr', 'Marietta', '30062');
insert into pros (id, name, mobile, service_types) values ('33333333-3333-3333-3333-333333333333', 'Pro A', '+14045550123', '{cleaning,pet}');

select pg_temp.expect('bad phone rejected', $q$insert into customers (name, mobile, email) values ('X', '678-439-6213', 'x@example.com')$q$, true);
select pg_temp.expect('bad email rejected', $q$insert into customers (name, mobile, email) values ('X', '+14045550199', 'not-an-email')$q$, true);
select pg_temp.expect('duplicate mobile rejected', $q$insert into customers (name, mobile, email) values ('X', '+16784396213', 'y@example.com')$q$, true);
select pg_temp.expect('bad ZIP rejected', $q$insert into addresses (customer_id, street, city, zip) values ('11111111-1111-1111-1111-111111111111', '1 St', 'Atlanta', '3006')$q$, true);

select pg_temp.expect('standard biweekly clean accepted', $q$insert into plans (id, ref, customer_id, address_id, service, frequency, beds, baths, price_per_visit_cents, "window") values ('44444444-4444-4444-4444-444444444444', 'FH-26-04817', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'standard', 'biweekly', 3, 2, 16500, 'morning')$q$, false);
select pg_temp.expect('pet plan accepted', $q$insert into plans (id, ref, customer_id, address_id, service, frequency, dogs, yard_condition, route_day, price_per_visit_cents) values ('55555555-5555-5555-5555-555555555555', 'FH-26-05132', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'pet', 'weekly', 2, 'weeks', 'tue', 2700)$q$, false);
select pg_temp.expect('weekly deep clean rejected', $q$insert into plans (ref, customer_id, address_id, service, frequency, beds, baths, price_per_visit_cents, "window") values ('FH-26-00001', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'deep', 'weekly', 3, 2, 36000, 'morning')$q$, true);
select pg_temp.expect('pet plan without route day rejected', $q$insert into plans (ref, customer_id, address_id, service, frequency, dogs, yard_condition, price_per_visit_cents) values ('FH-26-00002', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'pet', 'weekly', 2, 'weeks', 2700)$q$, true);
select pg_temp.expect('5 dogs rejected (quote only)', $q$insert into plans (ref, customer_id, address_id, service, frequency, dogs, yard_condition, route_day, price_per_visit_cents) values ('FH-26-00003', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'pet', 'weekly', 5, 'weeks', 'mon', 3600)$q$, true);
select pg_temp.expect('6 beds rejected (custom quote)', $q$insert into plans (ref, customer_id, address_id, service, frequency, beds, baths, price_per_visit_cents, "window") values ('FH-26-00004', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'standard', 'weekly', 6, 2, 30000, 'morning')$q$, true);
select pg_temp.expect('bad ref format rejected', $q$insert into plans (ref, customer_id, address_id, service, frequency, beds, baths, price_per_visit_cents, "window") values ('4817', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'standard', 'weekly', 3, 2, 15000, 'morning')$q$, true);

select pg_temp.expect('visit with discount accepted', $q$insert into visits (id, plan_id, date, "window", price_cents, discount_cents) values ('66666666-6666-6666-6666-666666666666', '44444444-4444-4444-4444-444444444444', '2026-10-27', 'morning', 16500, 3300)$q$, false);
select pg_temp.expect('two visits same plan same day rejected', $q$insert into visits (plan_id, date, "window", price_cents) values ('44444444-4444-4444-4444-444444444444', '2026-10-27', 'midday', 16500)$q$, true);
select pg_temp.expect('discount above price rejected', $q$insert into visits (plan_id, date, "window", price_cents, discount_cents) values ('44444444-4444-4444-4444-444444444444', '2026-11-10', 'morning', 16500, 20000)$q$, true);
select pg_temp.expect('pro without documents cannot be assigned', $q$update visits set pro_id = '33333333-3333-3333-3333-333333333333', assigned_at = now() where id = '66666666-6666-6666-6666-666666666666'$q$, true);

insert into pro_documents (pro_id, kind, file_url, expires_on, verified_by, verified_at) values
  ('33333333-3333-3333-3333-333333333333', 'insurance', 'p/ins.pdf', '2026-11-14', '00000000-0000-0000-0000-00000000000a', now()),
  ('33333333-3333-3333-3333-333333333333', 'bond', 'p/bond.pdf', '2027-06-01', '00000000-0000-0000-0000-00000000000a', now());
select pg_temp.expect('pro missing background check cannot be assigned', $q$update visits set pro_id = '33333333-3333-3333-3333-333333333333', assigned_at = now() where id = '66666666-6666-6666-6666-666666666666'$q$, true);
insert into pro_documents (pro_id, kind, file_url) values ('33333333-3333-3333-3333-333333333333', 'background_check', 'p/bg.pdf');
select pg_temp.expect('unverified background check still blocks', $q$update visits set pro_id = '33333333-3333-3333-3333-333333333333', assigned_at = now() where id = '66666666-6666-6666-6666-666666666666'$q$, true);
update pro_documents set verified_by = '00000000-0000-0000-0000-00000000000a', verified_at = now() where kind = 'background_check';
select pg_temp.expect('fully verified pro can be assigned', $q$update visits set pro_id = '33333333-3333-3333-3333-333333333333', assigned_at = now() where id = '66666666-6666-6666-6666-666666666666'$q$, false);
select pg_temp.expect('pro with expired insurance cannot take a later visit', $q$insert into visits (plan_id, date, "window", price_cents, pro_id, assigned_at) values ('44444444-4444-4444-4444-444444444444', '2026-11-24', 'morning', 16500, '33333333-3333-3333-3333-333333333333', now())$q$, true);
select pg_temp.expect('insurance without expiry rejected', $q$insert into pro_documents (pro_id, kind, file_url) values ('33333333-3333-3333-3333-333333333333', 'insurance', 'x.pdf')$q$, true);

insert into visits (id, plan_id, date, price_cents, pro_id, assigned_at) values ('77777777-7777-7777-7777-777777777777', '55555555-5555-5555-5555-555555555555', '2026-10-27', 3900, '33333333-3333-3333-3333-333333333333', now());
select pg_temp.expect('yard visit done without gate photo rejected', $q$update visits set status = 'done', completed_at = now() where id = '77777777-7777-7777-7777-777777777777'$q$, true);
select pg_temp.expect('yard visit done with gate photo accepted', $q$update visits set status = 'done', completed_at = now(), gate_photo_url = 'g/1.jpg' where id = '77777777-7777-7777-7777-777777777777'$q$, false);
select pg_temp.expect('cleaning visit done accepted', $q$update visits set status = 'done', completed_at = now() where id = '66666666-6666-6666-6666-666666666666'$q$, false);
select pg_temp.expect('done without completed_at rejected', $q$insert into visits (plan_id, date, "window", price_cents, status) values ('44444444-4444-4444-4444-444444444444', '2026-12-08', 'morning', 16500, 'done')$q$, true);
select pg_temp.expect('zero payment rejected', $q$insert into payments (visit_id, amount_cents, kind) values ('66666666-6666-6666-6666-666666666666', 0, 'visit')$q$, true);
select pg_temp.expect('late fee payment accepted', $q$insert into payments (visit_id, amount_cents, kind, stripe_payment_intent) values ('66666666-6666-6666-6666-666666666666', 5000, 'late_fee', 'pi_1')$q$, false);
select pg_temp.expect('duplicate payment intent rejected', $q$insert into payments (visit_id, amount_cents, kind, stripe_payment_intent) values ('66666666-6666-6666-6666-666666666666', 5000, 'late_fee', 'pi_1')$q$, true);

select pg_temp.expect('blocked cleaning date (no window) accepted', $q$insert into capacity (kind, date, blocked) values ('cleaning', '2026-11-26', true)$q$, false);
select pg_temp.expect('duplicate weekday capacity rejected', $q$insert into capacity (kind, weekday, "window", slots) values ('cleaning', 1, 'morning', 3)$q$, true);
select pg_temp.expect('yard capacity on Saturday rejected', $q$insert into capacity (kind, weekday, slots) values ('yard', 6, 5)$q$, true);
select pg_temp.expect('yard capacity with a window rejected', $q$insert into capacity (kind, date, "window", slots) values ('yard', '2026-11-02', 'morning', 5)$q$, true);
select pg_temp.expect('consent for both customer and pro rejected', $q$insert into sms_consent (customer_id, pro_id, phone, kind, form, consent_text_version, consent_text) values ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', '+16784396213', 'booking', 'booking', 'v1', 't')$q$, true);
select pg_temp.expect('quote consent (phone only) accepted', $q$insert into sms_consent (phone, kind, form, consent_text_version, consent_text) values ('+14045550123', 'booking', 'quote', 'quote-2026-10-21', 'By tapping...')$q$, false);

-- RLS: owner vs other signed-in user vs anonymous
grant select, insert, update, delete on all tables in schema public to authenticated;
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select pg_temp.expect('owner can read customers', $q$do $x$ begin if (select count(*) from customers) <> 1 then raise exception 'owner saw % rows', (select count(*) from customers); end if; end $x$$q$, false);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select pg_temp.expect('non-owner sees no customers', $q$do $x$ begin if (select count(*) from customers) <> 0 then raise exception 'leak'; end if; end $x$$q$, false);
select pg_temp.expect('non-owner cannot insert customers', $q$insert into customers (name, mobile, email) values ('X', '+14045550111', 'x@example.com')$q$, true);
select pg_temp.expect('non-owner cannot make themselves owner', $q$insert into admin_users values ('00000000-0000-0000-0000-00000000000b')$q$, true);
reset role;
set role anon;
select pg_temp.expect('anonymous cannot read customers', $q$select * from customers$q$, true);
reset role;

select case when ok then 'PASS ' else 'FAIL ' end || label from results;
select count(*) filter (where not ok) || ' failed of ' || count(*) from results;
