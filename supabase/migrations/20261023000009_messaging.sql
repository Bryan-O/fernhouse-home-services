-- Texts and emails (build step 7): one row per message in `messages`, sent once,
-- and text-message consent that STOP revokes and START restores.

-- A START reply is a consent of its own (the customer texted us), logged like the web forms.
alter type consent_form add value if not exists 'keyword';

alter table messages
  add column dedupe_key text unique, -- e.g. 'booking:<plan id>:sms' — the same event never sends twice
  add column subject text, -- emails
  add column media_path text, -- MMS gate photo: path in the private gate-photos bucket
  add column error text, -- why it wasn't sent (provider error code, 'opted_out', 'not_configured')
  add column inbound_of uuid references messages (id) on delete set null; -- keyword reply → the text it answers

create index messages_to_idx on messages (to_address, created_at desc);
create index messages_template_idx on messages (template, created_at desc);

-- Can we text this number? Owner alerts skip this; everyone else needs a live consent of the kind.
create or replace function sms_allowed(p_phone text, p_kind consent_kind) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from sms_consent where phone = p_phone and kind = p_kind and revoked_at is null);
$$;

-- STOP (and UNSUBSCRIBE, CANCEL, END, QUIT…): every consent for the number ends, marketing included.
create or replace function sms_opt_out(p_phone text) returns integer
language sql security definer set search_path = public as $$
  with r as (
    update sms_consent set revoked_at = now() where phone = p_phone and revoked_at is null returning 1
  ) select count(*)::integer from r;
$$;

-- START: booking texts (or a pro's job texts) come back. Marketing stays off until they tick the box again.
create or replace function sms_opt_in(p_phone text, p_text text) returns integer
language plpgsql security definer set search_path = public as $$
declare
  n integer := 0;
  v_customer uuid := (select id from customers where mobile = p_phone);
  v_pro uuid := (select id from pros where mobile = p_phone);
begin
  if v_pro is not null and not sms_allowed(p_phone, 'pro_jobs') then
    insert into sms_consent (pro_id, phone, kind, form, consent_text_version, consent_text)
    values (v_pro, p_phone, 'pro_jobs', 'keyword', 'keyword-start', p_text);
    n := n + 1;
  end if;
  if (v_customer is not null or v_pro is null) and not sms_allowed(p_phone, 'booking') then
    insert into sms_consent (customer_id, phone, kind, form, consent_text_version, consent_text)
    values (v_customer, p_phone, 'booking', 'keyword', 'keyword-start', p_text);
    n := n + 1;
  end if;
  return n;
end;
$$;

do $$
declare f text;
begin
  foreach f in array array['sms_allowed(text, consent_kind)', 'sms_opt_out(text)', 'sms_opt_in(text, text)'] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end;
$$;
