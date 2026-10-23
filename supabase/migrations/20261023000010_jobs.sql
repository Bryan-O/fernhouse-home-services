-- Scheduled jobs (build step 8): recurring charges, failed-payment follow-up, private ratings,
-- and clean-up. Every query here is safe to run again; the jobs catch up after a missed hour.

-- Private 1–5 rating after a customer's first visit. Never published.
create table ratings (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers (id) on delete cascade,
  visit_id uuid not null unique references visits (id) on delete cascade,
  score smallint not null check (score between 1 and 5),
  created_at timestamptz not null default now()
);
create index ratings_customer_idx on ratings (customer_id);
alter table ratings enable row level security;
alter table ratings force row level security;
revoke all on table ratings from anon;
create policy owner_all on ratings for all to authenticated using (is_admin()) with check (is_admin());

-- When a declined charge paused the plan (48 hours without a new card), so it happens once.
alter table payments add column dunning_paused_at timestamptz;

-- Cleaning visits to charge this morning (and the two days before, if a run was missed):
-- not pet waste (charged when done), not cancelled or skipped, and never charged before —
-- a first clean paid at booking already has its payment.
create or replace function clean_charges_due(p_today date, p_limit integer default 50) returns setof uuid
language sql stable security definer set search_path = public as $$
  select v.id
  from visits v join plans p on p.id = v.plan_id
  where p.service <> 'pet'
    and v.status in ('scheduled', 'confirmed', 'done')
    and v.date between p_today - 2 and p_today
    and v.price_cents - v.discount_cents > 0
    and not exists (select 1 from payments x where x.visit_id = v.id and x.kind = 'visit')
  order by v.date, v.id
  limit p_limit;
$$;

-- Declined charges still unpaid: the latest failed attempt per visit and kind, with no success since.
create or replace function open_failed_charges(p_since timestamptz) returns table (
  payment_id uuid, visit_id uuid, plan_id uuid, customer_id uuid, kind payment_kind, amount_cents integer, failed_at timestamptz, dunning_paused_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select distinct on (f.visit_id, f.kind) f.id, f.visit_id, v.plan_id, p.customer_id, f.kind, f.amount_cents::integer, f.created_at, f.dunning_paused_at
  from payments f join visits v on v.id = f.visit_id join plans p on p.id = v.plan_id
  where f.status = 'failed' and f.created_at >= p_since
    and not exists (select 1 from payments s where s.visit_id = f.visit_id and s.kind = f.kind and s.status in ('succeeded', 'pending'))
  order by f.visit_id, f.kind, f.created_at desc;
$$;

-- Access notes and gate codes are deleted once service ends (Privacy Policy): no live plan at
-- the address and no visit still to come or from yesterday.
create or replace function clear_ended_access() returns integer
language sql security definer set search_path = public as $$
  with done as (
    update addresses a set access_notes = null, gate_code = null
    where (a.access_notes is not null or a.gate_code is not null)
      and exists (select 1 from plans p where p.address_id = a.id)
      and not exists (select 1 from plans p where p.address_id = a.id and p.status in ('pending', 'active', 'paused'))
      and not exists (
        select 1 from visits v join plans p on p.id = v.plan_id
        where p.address_id = a.id and v.status in ('scheduled', 'confirmed') and v.date >= local_today() - 1
      )
    returning 1
  ) select count(*)::integer from done;
$$;

do $$
declare f text;
begin
  foreach f in array array['clean_charges_due(date, integer)', 'open_failed_charges(timestamptz)', 'clear_ended_access()'] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end;
$$;

-- The owner's "still needs a pro" reminder 12 hours after a booking goes once per booking.
alter table plans add column unassigned_reminded_at timestamptz;

-- Visits still waiting for a pro: everything in the next p_days, plus every visit of a booking
-- that has no pro on any visit yet (a new booking, however far out). Counted per booking.
create or replace function unassigned_visits(p_today date, p_days integer) returns table (
  visit_id uuid, date date, "window" arrival_window, city text, plan_id uuid, plan_created_at timestamptz, unassigned_reminded_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select v.id, v.date, v."window", a.city, p.id, p.created_at, p.unassigned_reminded_at
  from visits v join plans p on p.id = v.plan_id join addresses a on a.id = p.address_id
  where v.pro_id is null and v.status = 'scheduled' and v.date >= p_today and p.status in ('active', 'ended')
    and (v.date <= p_today + p_days or not exists (select 1 from visits w where w.plan_id = p.id and w.pro_id is not null))
  order by v.date, v."window";
$$;
revoke all on function unassigned_visits(date, integer) from public, anon, authenticated;
grant execute on function unassigned_visits(date, integer) to service_role;
