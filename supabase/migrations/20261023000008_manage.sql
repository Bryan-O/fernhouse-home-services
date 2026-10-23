-- Manage booking (/b/[token]): recurring visit generation, reschedule, skip, cancel,
-- pause/resume, route-day changes, re-clean/re-scoop requests and receipts.
-- Every function here runs as the server only, after it has checked the customer's link.

-- Which slot of the plan's cadence a visit fills. Rescheduling moves `date` but keeps
-- the occurrence, so regenerating visits never recreates a visit that was moved.
alter table visits add column occurrence_date date;
update visits set occurrence_date = date;
alter table visits alter column occurrence_date set not null;
create unique index visits_plan_occurrence_uidx on visits (plan_id, occurrence_date);

create function visits_default_occurrence() returns trigger language plpgsql as $$
begin
  new.occurrence_date := coalesce(new.occurrence_date, new.date);
  return new;
end;
$$;

create trigger visits_occurrence before insert on visits
for each row execute function visits_default_occurrence();

-- Why a customer cancelled a visit (optional, from the manage page).
alter table visits add column cancel_reason text check (length(cancel_reason) <= 100);

-- Where the plan's cadence starts (first visit, or the new route day after a change).
alter table plans add column cadence_anchor date;

alter table payments
  add column receipt_url text,
  add column refunded_cents integer not null default 0 check (refunded_cents >= 0);
alter table payments add constraint payments_refund_le_amount check (refunded_cents <= amount_cents);

create type service_request_kind as enum ('reclean', 'rescoop');
create type service_request_status as enum ('new', 'scheduled', 'resolved');

-- "Something not right?" — reported within 24 hours of a visit.
create table service_requests (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null unique references visits (id) on delete cascade,
  kind service_request_kind not null,
  note text check (length(note) <= 1000),
  status service_request_status not null default 'new',
  created_at timestamptz not null default now()
);

alter table service_requests enable row level security;
alter table service_requests force row level security;
revoke all on table service_requests from anon;
create policy owner_all on service_requests for all to authenticated using (is_admin()) with check (is_admin());

-- Second weekly yard visit for twice-weekly plans: three days later, kept on Mon–Fri.
create function second_route_day(rd route_day) returns route_day language sql immutable as $$
  select case rd when 'mon' then 'thu' when 'tue' then 'fri' when 'wed' then 'fri' when 'thu' then 'mon' else 'tue' end::route_day;
$$;

-- Create the plan's visits up to p_through (idempotent). Recurring, live plans only.
create function generate_plan_visits(p_plan_id uuid, p_through date)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  p plans%rowtype;
  v_anchor date;
  v_step integer;
  v_day date;
  v_second date;
  n integer := 0;
  c integer;
begin
  select * into p from plans where id = p_plan_id;
  if not found or p.status <> 'active' or p.frequency = 'one_time' then return 0; end if;

  v_anchor := coalesce(p.cadence_anchor, (select min(occurrence_date) from visits where plan_id = p.id));
  if v_anchor is null then return 0; end if;
  v_step := case when p.frequency = 'biweekly' then 14 else 7 end;

  v_day := v_anchor;
  while v_day <= p_through loop
    if v_day > local_today() then
      insert into visits (plan_id, date, occurrence_date, "window", price_cents)
      values (p.id, v_day, v_day, p."window", p.price_per_visit_cents)
      on conflict do nothing;
      get diagnostics c = row_count; n := n + c;
    end if;
    -- Twice weekly: a second visit on the paired route day each week.
    if p.frequency = 'twice_weekly' then
      v_second := v_day + ((array_position(enum_range(null::route_day), second_route_day(p.route_day))
                           - array_position(enum_range(null::route_day), p.route_day) + 7) % 7);
      if v_second > local_today() and v_second <= p_through then
        insert into visits (plan_id, date, occurrence_date, "window", price_cents)
        values (p.id, v_second, v_second, null, p.price_per_visit_cents)
        on conflict do nothing;
        get diagnostics c = row_count; n := n + c;
      end if;
    end if;
    v_day := v_day + v_step;
  end loop;
  return n;
end;
$$;

-- Move one cleaning visit to a new date and window, if there's room. p_fee_cents is the
-- late fee when the change is inside 24 hours (decided by the app from the policy).
create function reschedule_visit(p_visit_id uuid, p_date date, p_window arrival_window, p_fee_cents integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v visits%rowtype;
  v_left integer;
begin
  select * into v from visits where id = p_visit_id for update;
  if not found or v.status not in ('scheduled', 'confirmed') or v."window" is null then
    return jsonb_build_object('ok', false, 'reason', 'not_movable');
  end if;
  if p_date < local_today() + 1 or p_date > local_today() + 60 then
    return jsonb_build_object('ok', false, 'reason', 'date_out_of_range');
  end if;
  if v.date = p_date and v."window" = p_window then
    return jsonb_build_object('ok', true, 'unchanged', true);
  end if;
  perform pg_advisory_xact_lock(hashtext('clean:' || p_date::text || ':' || p_window::text));
  select slots - taken into v_left from clean_availability(p_date, p_date) a where a."window" = p_window;
  if coalesce(v_left, 0) <= 0 then
    return jsonb_build_object('ok', false, 'reason', 'full');
  end if;
  if exists (select 1 from visits where plan_id = v.plan_id and date = p_date and id <> v.id) then
    return jsonb_build_object('ok', false, 'reason', 'clash');
  end if;
  -- The team is re-confirmed for the new time.
  update visits set date = p_date, "window" = p_window, fee_cents = fee_cents + p_fee_cents,
    status = 'scheduled', pro_id = null, assigned_at = null
  where id = v.id;
  return jsonb_build_object('ok', true);
end;
$$;

-- Skip or cancel one visit (with the late fee when inside 24 hours). Cancelling the only
-- visit of a one-time plan ends the plan.
create function drop_visit(p_visit_id uuid, p_status visit_status, p_fee_cents integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v visits%rowtype;
  p plans%rowtype;
begin
  if p_status not in ('skipped', 'cancelled') then raise exception 'bad status %', p_status; end if;
  select * into v from visits where id = p_visit_id for update;
  if not found or v.status not in ('scheduled', 'confirmed') then
    return jsonb_build_object('ok', false, 'reason', 'not_open');
  end if;
  update visits set status = p_status, fee_cents = fee_cents + p_fee_cents where id = v.id;
  select * into p from plans where id = v.plan_id;
  if p.frequency = 'one_time' then
    update plans set status = 'ended', ended_at = now() where id = p.id and status <> 'ended';
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

-- Bring a skipped visit back (yards: "Undo skip"), if it hasn't passed.
create function restore_visit(p_visit_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update visits set status = 'scheduled'
  where id = p_visit_id and status = 'skipped' and fee_cents = 0 and date > local_today();
  return found;
end;
$$;

-- Pause: no visits until resumed. Future visits more than p_keep_days out (and not prepaid)
-- are removed; resuming regenerates them. Visits sooner than that stay booked.
create function set_plan_paused(p_plan_id uuid, p_paused boolean, p_keep_days integer default 1)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_paused then
    update plans set status = 'paused' where id = p_plan_id and status = 'active';
    if not found then return false; end if;
    delete from visits v where v.plan_id = p_plan_id and v.date > local_today() + p_keep_days
      and v.status in ('scheduled', 'confirmed')
      and not exists (select 1 from payments x where x.visit_id = v.id);
  else
    update plans set status = 'active' where id = p_plan_id and status = 'paused';
    if not found then return false; end if;
    perform generate_plan_visits(p_plan_id, local_today() + 60);
  end if;
  return true;
end;
$$;

-- End a plan. Visits more than p_keep_days out are cancelled; a visit sooner stays booked
-- (the customer cancels it separately, with the late fee).
create function end_plan(p_plan_id uuid, p_keep_days integer default 1)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update plans set status = 'ended', ended_at = now() where id = p_plan_id and status in ('active', 'paused');
  if not found then return false; end if;
  update visits set status = 'cancelled'
  where plan_id = p_plan_id and date > local_today() + p_keep_days and status in ('scheduled', 'confirmed');
  return true;
end;
$$;

-- Move a yard plan to another route day, if that day has room.
create function change_route_day(p_plan_id uuid, p_route route_day, p_first date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  p plans%rowtype;
  v_left integer;
begin
  select * into p from plans where id = p_plan_id for update;
  if not found or p.service <> 'pet' or p.status not in ('active', 'paused') then
    return jsonb_build_object('ok', false, 'reason', 'not_movable');
  end if;
  if p.route_day = p_route then return jsonb_build_object('ok', true, 'unchanged', true); end if;
  perform pg_advisory_xact_lock(hashtext('yard:' || p_route::text));
  select slots - taken into v_left from yard_availability() where route_day = p_route;
  if coalesce(v_left, 0) <= 0 then return jsonb_build_object('ok', false, 'reason', 'full'); end if;

  update plans set route_day = p_route, cadence_anchor = p_first where id = p.id;
  -- Every upcoming visit on the old day goes (the app only allows this before the cutoff).
  delete from visits v where v.plan_id = p.id and v.date > local_today() and v.status in ('scheduled', 'confirmed')
    and not exists (select 1 from payments x where x.visit_id = v.id);
  if p.frequency = 'one_time' then
    insert into visits (plan_id, date, occurrence_date, price_cents)
    select p.id, p_first, p_first, price_cents from visits where plan_id = p.id order by date limit 1
    on conflict do nothing;
  else
    perform generate_plan_visits(p.id, local_today() + 60);
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

-- One-time standard clean → biweekly plan from the confirmation page upsell.
create function make_plan_recurring(p_plan_id uuid, p_price_cents integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update plans set frequency = 'biweekly', price_per_visit_cents = p_price_cents
  where id = p_plan_id and service = 'standard' and frequency = 'one_time' and status = 'active';
  if not found then return false; end if;
  perform generate_plan_visits(p_plan_id, local_today() + 60);
  return true;
end;
$$;

-- New bookings become recurring schedules as soon as they're paid.
create or replace function confirm_booking_generate() returns trigger language plpgsql as $$
begin
  if new.status = 'active' and old.status = 'pending' then
    perform generate_plan_visits(new.id, local_today() + 60);
  end if;
  return new;
end;
$$;

create trigger plans_generate_on_confirm after update of status on plans
for each row execute function confirm_booking_generate();

do $$
declare f text;
begin
  foreach f in array array[
    'generate_plan_visits(uuid, date)', 'reschedule_visit(uuid, date, arrival_window, integer)',
    'drop_visit(uuid, visit_status, integer)', 'restore_visit(uuid)', 'set_plan_paused(uuid, boolean, integer)',
    'end_plan(uuid, integer)', 'change_route_day(uuid, route_day, date)', 'make_plan_recurring(uuid, integer)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end;
$$;
