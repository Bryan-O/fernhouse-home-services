-- Payments: Stripe customer/card details, checkout sessions, webhook dedupe,
-- and the calls that confirm or abandon a pending booking.

alter table customers
  add column stripe_payment_method_id text,
  add column card_brand text,
  add column card_last4 text check (card_last4 ~ '^[0-9]{4}$');

alter table plans add column stripe_checkout_session_id text unique;

-- Every Stripe webhook event we've handled, so a retried delivery is a no-op.
create table stripe_events (
  id text primary key,
  type text not null,
  received_at timestamptz not null default now()
);

alter table stripe_events enable row level security;
alter table stripe_events force row level security;
revoke all on table stripe_events from anon;
create policy owner_read on stripe_events for select to authenticated using (is_admin());

-- Is there still room for this plan's first visit, not counting the plan itself?
create function plan_slot_free(p_plan plans) returns boolean
language plpgsql stable as $$
declare
  v visits%rowtype;
  v_left integer;
begin
  select * into v from visits where plan_id = p_plan.id order by date limit 1;
  if p_plan.service = 'pet' then
    select slots - taken into v_left from yard_availability() where route_day = p_plan.route_day;
  else
    select slots - taken into v_left from clean_availability(v.date, v.date) a where a."window" = v."window";
  end if;
  return coalesce(v_left, 0) > 0;
end;
$$;

-- Payment (or card save) succeeded: make the booking live. Idempotent.
-- p: { payment_intent, amount_cents, stripe_customer_id, payment_method_id, card_brand, card_last4 }
-- Returns { ok, ref, customer_id, already } or { ok: false, reason: 'not_found' | 'slot_taken' }.
create function confirm_booking(p_plan_id uuid, p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan plans%rowtype;
  v_visit visits%rowtype;
  v_live_hold boolean;
begin
  select * into v_plan from plans where id = p_plan_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  if v_plan.status <> 'pending' then
    return jsonb_build_object('ok', v_plan.status <> 'ended', 'already', true, 'ref', v_plan.ref,
      'customer_id', v_plan.customer_id, 'reason', case when v_plan.status = 'ended' then 'ended' end);
  end if;

  select * into v_visit from visits where plan_id = v_plan.id order by date limit 1;
  select exists (select 1 from slot_holds where plan_id = v_plan.id and expires_at > now()) into v_live_hold;

  -- Paid after the hold ran out: only confirm if the slot is still free.
  if not v_live_hold then
    if v_plan.service = 'pet' then
      perform pg_advisory_xact_lock(hashtext('yard:' || v_plan.route_day::text));
    else
      perform pg_advisory_xact_lock(hashtext('clean:' || v_visit.date::text || ':' || v_visit."window"::text));
    end if;
    if not plan_slot_free(v_plan) then
      update visits set status = 'cancelled' where plan_id = v_plan.id;
      update plans set status = 'ended', ended_at = now() where id = v_plan.id;
      delete from slot_holds where plan_id = v_plan.id;
      return jsonb_build_object('ok', false, 'reason', 'slot_taken', 'ref', v_plan.ref, 'customer_id', v_plan.customer_id);
    end if;
  end if;

  update plans set status = 'active' where id = v_plan.id;
  delete from slot_holds where plan_id = v_plan.id;

  update customers set
    stripe_customer_id = coalesce(nullif(p->>'stripe_customer_id', ''), stripe_customer_id),
    stripe_payment_method_id = coalesce(nullif(p->>'payment_method_id', ''), stripe_payment_method_id),
    card_brand = coalesce(nullif(p->>'card_brand', ''), card_brand),
    card_last4 = coalesce(nullif(p->>'card_last4', ''), card_last4),
    first_clean_offer_used_at = case when v_visit.discount_cents > 0 then coalesce(first_clean_offer_used_at, now()) else first_clean_offer_used_at end
  where id = v_plan.customer_id;

  if nullif(p->>'payment_intent', '') is not null then
    insert into payments (visit_id, stripe_payment_intent, amount_cents, kind, status)
    values (v_visit.id, p->>'payment_intent', (p->>'amount_cents')::integer, 'visit', 'succeeded')
    on conflict (stripe_payment_intent) do update set status = 'succeeded', updated_at = now();
  end if;

  return jsonb_build_object('ok', true, 'already', false, 'ref', v_plan.ref, 'customer_id', v_plan.customer_id);
end;
$$;

-- Checkout expired or was abandoned: free the slot and close the pending booking.
create function abandon_booking(p_plan_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  update visits set status = 'cancelled' where plan_id = p_plan_id
    and exists (select 1 from plans where id = p_plan_id and status = 'pending');
  update plans set status = 'ended', ended_at = now() where id = p_plan_id and status = 'pending';
  get diagnostics n = row_count;
  delete from slot_holds where plan_id = p_plan_id;
  return n > 0;
end;
$$;

revoke all on function confirm_booking(uuid, jsonb) from public, anon, authenticated;
revoke all on function abandon_booking(uuid) from public, anon, authenticated;
revoke all on function plan_slot_free(plans) from public, anon, authenticated;
grant execute on function confirm_booking(uuid, jsonb), abandon_booking(uuid) to service_role;

-- Never two live charges of the same kind for one visit (a retry after a failure is fine).
create unique index payments_one_live_charge_uidx on payments (visit_id, kind) where status in ('pending', 'succeeded');
