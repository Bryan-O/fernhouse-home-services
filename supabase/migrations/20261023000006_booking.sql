-- Booking: slot holds, live availability and the atomic start_booking() call.
-- start_booking() runs as the server (service role) only; the browser never calls it.

alter table plans
  add column idempotency_key uuid unique, -- one per booking attempt: a double-tap never double-books
  add column dog_names text,
  add column dogs_friendly boolean;

create sequence booking_ref_seq start 1001 maxvalue 99999;

-- The 15-minute hold on a pending booking's slot (HANDOFF: held during checkout).
create table slot_holds (
  plan_id uuid primary key references plans (id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index slot_holds_expiry_idx on slot_holds (expires_at);

alter table slot_holds enable row level security;
alter table slot_holds force row level security;
revoke all on table slot_holds from anon;
create policy owner_all on slot_holds for all to authenticated using (is_admin()) with check (is_admin());

-- Today's date in Atlanta.
create function local_today() returns date language sql stable as $$
  select (now() at time zone 'America/New_York')::date;
$$;

-- A plan takes capacity once it's live, or while its checkout hold is running.
create function plan_takes_capacity(p_plan_id uuid, p_status plan_status) returns boolean
language sql stable as $$
  select case
    when p_status = 'pending' then exists (select 1 from slot_holds h where h.plan_id = p_plan_id and h.expires_at > now())
    else p_status in ('active', 'paused')
  end;
$$;

-- Cleaning visits per date and window: capacity and how many are taken.
-- A date row overrides the weekday default; a blocked date row closes the whole day.
create function clean_availability(p_from date, p_to date)
returns table (date date, "window" arrival_window, slots integer, taken integer)
language sql stable as $$
  with days as (
    select d::date as date from generate_series(p_from, p_to, interval '1 day') d
  ), wins as (
    select unnest(enum_range(null::arrival_window)) as win
  )
  select
    days.date,
    wins.win,
    case
      when exists (select 1 from capacity c where c.kind = 'cleaning' and c.date = days.date and c."window" is null and c.blocked) then 0
      else coalesce(
        (select case when c.blocked then 0 else c.slots end from capacity c
          where c.kind = 'cleaning' and c.date = days.date and c."window" = wins.win),
        (select case when c.blocked then 0 else c.slots end from capacity c
          where c.kind = 'cleaning' and c.weekday = extract(dow from days.date) and c."window" = wins.win),
        0)
    end::integer,
    (select count(*) from visits v join plans p on p.id = v.plan_id
      where v.date = days.date and v."window" = wins.win
        and v.status not in ('cancelled', 'skipped')
        and plan_takes_capacity(p.id, p.status))::integer
  from days cross join wins
  order by 1, 2;
$$;

-- Yards per route day: capacity and live yard plans on that day.
create function yard_availability()
returns table (route_day route_day, slots integer, taken integer)
language sql stable as $$
  select
    rd,
    coalesce((select case when c.blocked then 0 else c.slots end from capacity c
      where c.kind = 'yard' and c.weekday = array_position(enum_range(null::route_day), rd)), 0)::integer,
    (select count(*) from plans p
      where p.service = 'pet' and p.route_day = rd and plan_takes_capacity(p.id, p.status))::integer
  from unnest(enum_range(null::route_day)) rd;
$$;

-- First-clean offer: once per household (same customer, or same street address and ZIP).
create function first_clean_offer_available(p_mobile text, p_street text, p_zip text)
returns boolean language sql stable as $$
  select not exists (
    select 1 from customers c where c.mobile = p_mobile and c.first_clean_offer_used_at is not null
  ) and not exists (
    select 1 from addresses a join customers c on c.id = a.customer_id
    where c.first_clean_offer_used_at is not null
      and a.zip = p_zip
      and regexp_replace(lower(a.street), '[^a-z0-9]', '', 'g') = regexp_replace(lower(p_street), '[^a-z0-9]', '', 'g')
  );
$$;

-- Create a pending booking and hold its slot, all-or-nothing.
-- Prices come from the app (lib/config.ts); the database checks capacity, the offer and the shape.
-- Returns { ok, ref, plan_id, hold_expires_at, first_visit_cents, discount_cents } or { ok: false, reason }.
create function start_booking(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key uuid := (p->>'idempotency_key')::uuid;
  v_service service_type := (p->>'service')::service_type;
  v_date date := (p->>'date')::date;
  v_window arrival_window := (p->>'window')::arrival_window;
  v_route route_day := (p->>'route_day')::route_day;
  v_existing plans%rowtype;
  v_customer uuid;
  v_address uuid;
  v_plan uuid;
  v_ref text;
  v_left integer;
  v_discount integer := coalesce((p->>'discount_cents')::integer, 0);
  v_expires timestamptz := now() + make_interval(mins => coalesce((p->>'hold_minutes')::integer, 15));
begin
  if v_key is null then
    raise exception 'idempotency_key is required' using errcode = 'invalid_parameter_value';
  end if;

  -- Same attempt again (double-tap, retry): return what was created the first time.
  select * into v_existing from plans where idempotency_key = v_key;
  if found then
    return jsonb_build_object(
      'ok', true, 'replayed', true, 'plan_id', v_existing.id, 'ref', v_existing.ref,
      'hold_expires_at', (select expires_at from slot_holds where plan_id = v_existing.id),
      'first_visit_cents', (select price_cents from visits where plan_id = v_existing.id order by date limit 1),
      'discount_cents', (select discount_cents from visits where plan_id = v_existing.id order by date limit 1));
  end if;

  if v_date is null or v_date < local_today() + 1 or v_date > local_today() + 60 then
    return jsonb_build_object('ok', false, 'reason', 'date_out_of_range');
  end if;

  -- Serialize bookings for the same slot, then check what's left.
  if v_service = 'pet' then
    perform pg_advisory_xact_lock(hashtext('yard:' || v_route::text));
    select slots - taken into v_left from yard_availability() where route_day = v_route;
  else
    perform pg_advisory_xact_lock(hashtext('clean:' || v_date::text || ':' || v_window::text));
    select slots - taken into v_left from clean_availability(v_date, v_date) a where a."window" = v_window;
  end if;
  if coalesce(v_left, 0) <= 0 then
    return jsonb_build_object('ok', false, 'reason', 'full');
  end if;

  -- First-clean offer: if this household already used it, ask before charging full price.
  if v_service <> 'pet' and v_discount > 0
     and not first_clean_offer_available(p #>> '{customer,mobile}', p #>> '{address,street}', p #>> '{address,zip}') then
    if coalesce((p->>'accept_full_price')::boolean, false) then
      v_discount := 0;
    else
      return jsonb_build_object('ok', false, 'reason', 'offer_used');
    end if;
  end if;

  insert into customers (name, mobile, email)
  values (p #>> '{customer,name}', p #>> '{customer,mobile}', p #>> '{customer,email}')
  on conflict (mobile) do update set name = excluded.name, email = excluded.email
  returning id into v_customer;

  insert into addresses (customer_id, street, unit, city, zip, access_notes, gate_code)
  values (v_customer, p #>> '{address,street}', nullif(p #>> '{address,unit}', ''), p #>> '{address,city}',
          p #>> '{address,zip}', p #>> '{address,access_notes}', p #>> '{address,gate_code}')
  returning id into v_address;

  v_ref := 'FH-' || to_char(now() at time zone 'America/New_York', 'YY') || '-' || lpad(nextval('booking_ref_seq')::text, 5, '0');

  insert into plans (ref, idempotency_key, customer_id, address_id, service, frequency, beds, baths, dogs,
                     yard_condition, price_per_visit_cents, route_day, "window", status, pets_note, requests,
                     dog_names, dogs_friendly,
                     utm_source, utm_medium, utm_campaign, utm_content, utm_term, fbclid, gclid)
  values (v_ref, v_key, v_customer, v_address, v_service, (p->>'frequency')::plan_frequency,
          (p->>'beds')::smallint, (p->>'baths')::smallint, (p->>'dogs')::smallint,
          (p->>'yard_condition')::yard_condition, (p->>'price_per_visit_cents')::integer, v_route, v_window,
          'pending', nullif(p->>'pets_note', ''), nullif(p->>'requests', ''),
          nullif(p->>'dog_names', ''), (p->>'dogs_friendly')::boolean,
          p #>> '{utm,utm_source}', p #>> '{utm,utm_medium}', p #>> '{utm,utm_campaign}', p #>> '{utm,utm_content}',
          p #>> '{utm,utm_term}', p #>> '{utm,fbclid}', p #>> '{utm,gclid}')
  returning id into v_plan;

  insert into visits (plan_id, date, "window", price_cents, discount_cents)
  values (v_plan, v_date, v_window, (p->>'first_visit_cents')::integer, v_discount);

  insert into slot_holds (plan_id, expires_at) values (v_plan, v_expires);

  -- Text-message consent, with the exact wording shown (booking texts; marketing only if ticked).
  insert into sms_consent (customer_id, phone, kind, form, consent_text_version, consent_text, ip, user_agent)
  select v_customer, p #>> '{customer,mobile}', (c->>'kind')::consent_kind, 'booking', c->>'version', c->>'text',
         nullif(p->>'ip', '')::inet, nullif(p->>'user_agent', '')
  from jsonb_array_elements(coalesce(p->'consents', '[]'::jsonb)) c;

  return jsonb_build_object('ok', true, 'replayed', false, 'plan_id', v_plan, 'ref', v_ref,
    'hold_expires_at', v_expires, 'first_visit_cents', (p->>'first_visit_cents')::integer, 'discount_cents', v_discount);
end;
$$;

-- Server-only entry points.
revoke all on function start_booking(jsonb) from public, anon, authenticated;
grant execute on function start_booking(jsonb) to service_role;
revoke all on function clean_availability(date, date) from public, anon;
revoke all on function yard_availability() from public, anon;
revoke all on function first_clean_offer_available(text, text, text) from public, anon, authenticated;
grant execute on function clean_availability(date, date), yard_availability() to authenticated, service_role;
grant execute on function first_clean_offer_available(text, text, text) to service_role;
