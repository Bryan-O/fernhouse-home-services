-- Owner dashboard and pro job page (build step 9): pro links, assigning, marking visits done,
-- the yard cleanup-upgrade question, and pros' days off.

-- Links texted to pros, no login. Only a hash of each token is stored.
--   visit: one job page (/job/[token]), expires 24 hours after the visit day
--   route: a yard pro's day (every yard on it)
--   docs:  where a pro uploads insurance, bond and background-check documents
create table pro_links (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('visit', 'route', 'docs')),
  pro_id uuid not null references pros (id) on delete cascade,
  visit_id uuid references visits (id) on delete cascade,
  route_date date,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint pro_links_shape check (
    (kind = 'visit' and visit_id is not null and route_date is null)
    or (kind = 'route' and visit_id is null and route_date is not null)
    or (kind = 'docs' and visit_id is null and route_date is null)
  )
);
create index pro_links_expiry_idx on pro_links (expires_at);
alter table pro_links enable row level security;
alter table pro_links force row level security;
revoke all on table pro_links from anon;
create policy owner_all on pro_links for all to authenticated using (is_admin()) with check (is_admin());

-- Weekdays a pro doesn't work (0 = Sunday); they can't be assigned visits on those days.
alter table pros add column off_weekdays smallint[] not null default '{}'
  check (off_weekdays <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]);

alter table visits
  add column on_way_at timestamptz,
  add column pro_note text check (length(pro_note) <= 1000),
  -- Yard worse than booked: the customer approves the higher cleanup price by text (YES / NO).
  add column upgrade_status text check (upgrade_status in ('pending', 'approved', 'declined')),
  add column upgrade_cents integer check (upgrade_cents > 0),
  add constraint visits_upgrade_pair check ((upgrade_status is null) = (upgrade_cents is null));

create index visits_upgrade_pending_idx on visits (plan_id) where upgrade_status = 'pending';

-- Can this pro take a visit on this date? Documents verified and unexpired, working that weekday.
create or replace function pro_can_take(p_pro_id uuid, p_on date) returns boolean
language sql stable security definer set search_path = public as $$
  select pro_is_assignable(p_pro_id, p_on)
     and not ((select off_weekdays from pros where id = p_pro_id) @> array[extract(dow from p_on)::smallint]);
$$;

-- Assign a pro to a booking: every upcoming visit still without a pro, from p_from on, that the
-- pro can take. Visits they can't take (a day off, a document expiring first) stay unassigned
-- and show in "Needs a pro". Assigned visits become 'confirmed' (the customer's team is set).
create or replace function assign_plan(p_plan_id uuid, p_pro_id uuid, p_from date) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v record;
  n integer := 0;
  skipped integer := 0;
  first_id uuid;
begin
  perform 1 from plans where id = p_plan_id and status in ('active', 'ended') for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if not exists (select 1 from pros p join plans pl on pl.id = p_plan_id
                 where p.id = p_pro_id and p.active
                   and (case when pl.service = 'pet' then 'pet' else 'cleaning' end)::pro_service = any (p.service_types)) then
    return jsonb_build_object('ok', false, 'reason', 'wrong_service');
  end if;
  for v in
    select id, date from visits
    where plan_id = p_plan_id and pro_id is null and status = 'scheduled' and date >= p_from
    order by date
  loop
    if pro_can_take(p_pro_id, v.date) then
      update visits set pro_id = p_pro_id, assigned_at = now(), status = 'confirmed' where id = v.id;
      n := n + 1;
      first_id := coalesce(first_id, v.id);
    else
      skipped := skipped + 1;
    end if;
  end loop;
  if n = 0 then return jsonb_build_object('ok', false, 'reason', 'cannot_take', 'skipped', skipped); end if;
  return jsonb_build_object('ok', true, 'assigned', n, 'skipped', skipped, 'first_visit_id', first_id);
end;
$$;

-- The pro finishes a visit. Not before its day; a yard needs its gate photo (trigger).
-- p_upgrade_cents: the yard was worse than booked and the cleanup costs more — the charge
-- waits for the customer's YES.
create or replace function mark_visit_done(p_visit_id uuid, p_note text, p_upgrade_cents integer) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v record;
begin
  select * into v from visits where id = p_visit_id for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if v.status = 'done' then return jsonb_build_object('ok', true, 'already', true, 'completed_at', v.completed_at); end if;
  if v.status not in ('scheduled', 'confirmed') then return jsonb_build_object('ok', false, 'reason', 'not_open'); end if;
  if v.pro_id is null then return jsonb_build_object('ok', false, 'reason', 'no_pro'); end if;
  if v.date > local_today() then return jsonb_build_object('ok', false, 'reason', 'too_early'); end if;
  update visits set status = 'done', completed_at = now(), pro_note = nullif(trim(p_note), ''),
    upgrade_status = case when p_upgrade_cents > 0 then 'pending' end,
    upgrade_cents = case when p_upgrade_cents > 0 then p_upgrade_cents end
  where id = p_visit_id;
  return jsonb_build_object('ok', true, 'already', false, 'completed_at', now());
end;
$$;

-- The customer answers the upgrade question: YES charges the higher price, NO waives this visit.
create or replace function answer_upgrade(p_visit_id uuid, p_yes boolean) returns boolean
language sql security definer set search_path = public as $$
  with u as (
    update visits set upgrade_status = case when p_yes then 'approved' else 'declined' end,
      price_cents = case when p_yes then upgrade_cents else price_cents end
    where id = p_visit_id and upgrade_status = 'pending'
    returning 1
  ) select exists (select 1 from u);
$$;

do $$
declare f text;
begin
  foreach f in array array['pro_can_take(uuid, date)', 'assign_plan(uuid, uuid, date)', 'mark_visit_done(uuid, text, integer)', 'answer_upgrade(uuid, boolean)'] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end;
$$;

-- A label for a blocked day on the Capacity tab ("Thanksgiving").
alter table capacity add column note text check (length(note) <= 60);
