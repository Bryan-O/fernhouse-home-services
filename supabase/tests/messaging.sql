-- Messaging tests: consent checks, STOP / START, send-once keys. Run: npm run test:db
\set ON_ERROR_STOP 1
create temp table results (ok boolean, label text);
grant all on results to public;
create function pg_temp.check(label text, cond boolean) returns void language sql as $$
  insert into results values (coalesce(cond, false), label);
$$;

insert into customers (name, mobile, email) values ('Text Test', '+14045550901', 't@example.com');
insert into sms_consent (customer_id, phone, kind, form, consent_text_version, consent_text)
select id, mobile, 'booking', 'booking', 'booking-2026-10-21', 'By giving your mobile number…' from customers where mobile = '+14045550901';
insert into sms_consent (customer_id, phone, kind, form, consent_text_version, consent_text)
select id, mobile, 'marketing', 'booking', 'marketing-2026-10-21', 'Also text me offers' from customers where mobile = '+14045550901';

select pg_temp.check('booking texts allowed after booking consent', sms_allowed('+14045550901', 'booking'));
select pg_temp.check('marketing allowed only with its own consent', sms_allowed('+14045550901', 'marketing') and not sms_allowed('+14045550902', 'marketing'));
select pg_temp.check('no consent, no texts', not sms_allowed('+14045550902', 'booking'));

select pg_temp.check('STOP revokes every consent for the number', sms_opt_out('+14045550901') = 2);
select pg_temp.check('after STOP nothing is allowed', not sms_allowed('+14045550901', 'booking') and not sms_allowed('+14045550901', 'marketing'));
select pg_temp.check('revoked consents are kept, with the time', (select count(*) = 2 and bool_and(revoked_at is not null) from sms_consent where phone = '+14045550901'));
select pg_temp.check('a second STOP changes nothing', sms_opt_out('+14045550901') = 0);

select pg_temp.check('START restores booking texts only', sms_opt_in('+14045550901', 'Texted “START” to resubscribe') = 1);
select pg_temp.check('booking allowed again, marketing still off', sms_allowed('+14045550901', 'booking') and not sms_allowed('+14045550901', 'marketing'));
select pg_temp.check('START consent is logged as a keyword consent for the customer',
  (select form = 'keyword' and customer_id is not null from sms_consent where phone = '+14045550901' and revoked_at is null));
select pg_temp.check('a second START adds nothing', sms_opt_in('+14045550901', 'START') = 0);

-- A pro's START restores job texts.
insert into pros (name, mobile, service_types) values ('Pro Test', '+14045550903', '{cleaning}');
select pg_temp.check('pro START adds one consent', sms_opt_in('+14045550903', 'START') = 1);
select pg_temp.check('pro START restores job texts, not booking texts',
  sms_allowed('+14045550903', 'pro_jobs') and not sms_allowed('+14045550903', 'booking'));

-- Send once: the same event key can't be logged twice.
insert into messages (to_address, channel, template, body, dedupe_key) values ('+14045550901', 'sms', 'bookingConfirmed', 'x', 'booking:1:sms');
do $$ begin
  insert into messages (to_address, channel, template, body, dedupe_key) values ('+14045550901', 'sms', 'bookingConfirmed', 'x', 'booking:1:sms');
  insert into results values (false, 'a message key sends once (was allowed twice!)');
exception when unique_violation then insert into results values (true, 'a message key sends once');
end $$;
insert into messages (to_address, channel, template, body) values ('+14045550901', 'sms', 'manageLink', 'a'), ('+14045550901', 'sms', 'manageLink', 'b');
select pg_temp.check('messages without a key are not limited', (select count(*) = 2 from messages where template = 'manageLink'));

-- Server only.
set role authenticated;
do $$ begin
  perform sms_opt_out('+14045550901');
  insert into results values (false, 'signed-in users cannot change consent (was allowed!)');
exception when insufficient_privilege then insert into results values (true, 'signed-in users cannot change consent');
end $$;
reset role;
set role anon;
do $$ begin
  perform sms_allowed('+14045550901', 'booking');
  insert into results values (false, 'visitors cannot check consent (was allowed!)');
exception when insufficient_privilege then insert into results values (true, 'visitors cannot check consent');
end $$;
reset role;

select case when ok then 'PASS ' else 'FAIL ' end || label from results;
select count(*) filter (where not ok) || ' failed of ' || count(*) from results;
