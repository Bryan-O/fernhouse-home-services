-- Fernhouse schema (HANDOFF.md → Data model).
-- Money is whole cents. Phones are E.164 (+1XXXXXXXXXX). Times are timestamptz.
-- Prices are computed from lib/config.ts and stored per plan/visit, so a later
-- price change never rewrites what a customer already booked.

create extension if not exists pgcrypto;

-- ───────── Enums ─────────

create type service_type as enum ('standard', 'deep', 'move', 'pet');
create type plan_frequency as enum ('one_time', 'weekly', 'biweekly', 'twice_weekly');
create type yard_condition as enum ('kept', 'weeks', 'month');
create type arrival_window as enum ('morning', 'midday', 'afternoon');
create type route_day as enum ('mon', 'tue', 'wed', 'thu', 'fri');
create type plan_status as enum ('active', 'paused', 'ended');
create type visit_status as enum ('scheduled', 'confirmed', 'done', 'skipped', 'cancelled', 'no_access');
create type payment_kind as enum ('visit', 'late_fee', 'cleanup_upgrade');
create type payment_status as enum ('pending', 'succeeded', 'failed', 'refunded');
create type pro_service as enum ('cleaning', 'pet');
create type pro_document_kind as enum ('insurance', 'bond', 'background_check');
create type capacity_kind as enum ('cleaning', 'yard');
create type consent_kind as enum ('booking', 'marketing', 'pro_jobs');
create type consent_form as enum ('booking', 'quote', 'waitlist', 'find_booking', 'pro_signup');
create type quote_status as enum ('new', 'quoted', 'booked', 'closed');
create type message_channel as enum ('sms', 'email');
create type message_status as enum ('queued', 'sent', 'delivered', 'failed', 'received');

-- ───────── Shared checks ─────────

create domain phone_e164 as text check (value ~ '^\+1[2-9][0-9]{9}$');
create domain us_zip as text check (value ~ '^[0-9]{5}$');
create domain cents as integer check (value >= 0);

-- ───────── Owner access ─────────

-- Users allowed into /admin. The owner signs up in Supabase Auth, then is added here.
create table admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ───────── Customers ─────────

create table customers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 120),
  mobile phone_e164 not null unique, -- "Find my booking" looks customers up by mobile
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  stripe_customer_id text unique,
  first_clean_offer_used_at timestamptz, -- 20% first clean, once per household
  created_at timestamptz not null default now()
);

create index customers_email_idx on customers (lower(email));

create table addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers (id) on delete cascade,
  street text not null check (length(trim(street)) > 0),
  unit text,
  city text not null,
  zip us_zip not null,
  -- Encrypted in the app (AES-GCM, key in env) before insert; removed when service ends.
  access_notes text,
  gate_code text,
  created_at timestamptz not null default now()
);

create index addresses_customer_idx on addresses (customer_id);

-- ───────── Pros ─────────

create table pros (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 120),
  mobile phone_e164 not null unique,
  service_types pro_service[] not null check (cardinality(service_types) > 0),
  zips text[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table pro_documents (
  id uuid primary key default gen_random_uuid(),
  pro_id uuid not null references pros (id) on delete cascade,
  kind pro_document_kind not null,
  file_url text not null, -- path in the private "pro-documents" bucket
  expires_on date,
  verified_by uuid references auth.users (id),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  -- Insurance and bond certificates always carry an expiry date.
  constraint pro_documents_expiry check (kind = 'background_check' or expires_on is not null),
  constraint pro_documents_verified_pair check ((verified_by is null) = (verified_at is null))
);

create index pro_documents_pro_idx on pro_documents (pro_id, kind);

-- A pro can be assigned only with every document verified and unexpired on that date.
create function pro_is_assignable(p_pro_id uuid, p_on date)
returns boolean
language sql
stable
as $$
  select exists (select 1 from pros where id = p_pro_id and active)
     and (
       select count(distinct kind) = 3
       from pro_documents
       where pro_id = p_pro_id
         and verified_at is not null
         and (expires_on is null or expires_on >= p_on)
     );
$$;

-- ───────── Plans and visits ─────────

create table plans (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique check (ref ~ '^FH-[0-9]{2}-[0-9]{5}$'), -- e.g. FH-26-04817
  customer_id uuid not null references customers (id) on delete restrict,
  address_id uuid not null references addresses (id) on delete restrict,
  service service_type not null,
  frequency plan_frequency not null,
  beds smallint check (beds between 1 and 5),
  baths smallint check (baths between 1 and 4),
  dogs smallint check (dogs between 1 and 4),
  yard_condition yard_condition,
  price_per_visit_cents cents not null,
  route_day route_day,
  "window" arrival_window,
  status plan_status not null default 'active',
  pets_note text,
  requests text,
  -- Ad attribution (stored on every booking and quote)
  utm_source text, utm_medium text, utm_campaign text, utm_content text, utm_term text,
  fbclid text, gclid text,
  created_at timestamptz not null default now(),
  ended_at timestamptz,
  constraint plans_shape check (
    case when service = 'pet'
      then dogs is not null and yard_condition is not null and route_day is not null
           and beds is null and baths is null and "window" is null
      else beds is not null and baths is not null and "window" is not null
           and dogs is null and yard_condition is null and route_day is null
           and frequency <> 'twice_weekly'
    end
  ),
  -- Deep and Move-In/Out cleans are one-time visits.
  constraint plans_one_time_services check (service not in ('deep', 'move') or frequency = 'one_time'),
  constraint plans_ended check ((status = 'ended') = (ended_at is not null))
);

create index plans_customer_idx on plans (customer_id);
create index plans_address_idx on plans (address_id);
create index plans_active_idx on plans (status) where status = 'active';

create table visits (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references plans (id) on delete restrict,
  date date not null,
  "window" arrival_window, -- null for yard visits (route day, not an arrival window)
  status visit_status not null default 'scheduled',
  price_cents cents not null,
  discount_cents cents not null default 0, -- first-clean offer
  fee_cents cents not null default 0, -- late-cancellation fee
  pro_id uuid references pros (id) on delete restrict,
  assigned_at timestamptz,
  completed_at timestamptz,
  gate_photo_url text, -- private "gate-photos" bucket; required before a yard visit is done
  created_at timestamptz not null default now(),
  constraint visits_discount check (discount_cents <= price_cents),
  constraint visits_done check ((status = 'done') = (completed_at is not null)),
  constraint visits_done_has_pro check (status <> 'done' or pro_id is not null),
  constraint visits_assigned_pair check ((pro_id is null) = (assigned_at is null))
);

-- Twice-weekly yards get two visits a week, never two on one day.
create unique index visits_plan_date_uidx on visits (plan_id, date);
create index visits_date_idx on visits (date);
create index visits_pro_date_idx on visits (pro_id, date) where pro_id is not null;
create index visits_unassigned_idx on visits (date) where pro_id is null and status in ('scheduled', 'confirmed');

-- Yard visits must have a gate photo before they're marked done.
create function visits_check_gate_photo()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'done' and new.gate_photo_url is null
     and (select service from plans where id = new.plan_id) = 'pet' then
    raise exception 'A yard visit needs a gate photo before it is marked done'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger visits_gate_photo
before insert or update of status, gate_photo_url on visits
for each row execute function visits_check_gate_photo();

-- Only assignable pros (verified, unexpired documents) can be put on a visit.
create function visits_check_pro()
returns trigger
language plpgsql
as $$
begin
  if new.pro_id is not null
     and (tg_op = 'INSERT' or new.pro_id is distinct from old.pro_id)
     and not pro_is_assignable(new.pro_id, new.date) then
    raise exception 'Pro % is not assignable on % (documents missing, unverified or expired)', new.pro_id, new.date
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger visits_pro_assignable
before insert or update of pro_id on visits
for each row execute function visits_check_pro();

-- ───────── Payments ─────────

create table payments (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references visits (id) on delete restrict,
  stripe_payment_intent text unique,
  amount_cents cents not null check (amount_cents > 0),
  kind payment_kind not null,
  status payment_status not null default 'pending',
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index payments_visit_idx on payments (visit_id);
create index payments_failed_idx on payments (created_at) where status = 'failed';

-- ───────── Capacity ─────────

-- Visits per arrival window (cleaning) or yards per route day, set by hand on the dashboard.
-- A weekday row is the standing default; a date row overrides it (or blocks the day).
create table capacity (
  id uuid primary key default gen_random_uuid(),
  kind capacity_kind not null,
  weekday smallint check (weekday between 0 and 6), -- 0 = Sunday
  date date,
  "window" arrival_window,
  slots smallint not null default 0 check (slots >= 0),
  blocked boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint capacity_when check ((weekday is null) <> (date is null)),
  -- Yards have no window. Cleaning rows name a window, except a whole blocked date.
  constraint capacity_window check (
    (kind = 'yard' and "window" is null)
    or (kind = 'cleaning' and ("window" is not null or (date is not null and blocked)))
  ),
  -- Yard route days are Monday–Friday.
  constraint capacity_yard_days check (kind <> 'yard' or weekday is null or weekday between 1 and 5)
);

create unique index capacity_uidx on capacity (kind, weekday, date, "window") nulls not distinct;

-- ───────── Leads ─────────

create table quote_requests (
  id uuid primary key default gen_random_uuid(),
  phone phone_e164 not null,
  service service_type not null,
  dogs smallint check (dogs >= 1),
  over_half_acre boolean not null default false,
  beds smallint, baths smallint,
  status quote_status not null default 'new',
  utm_source text, utm_medium text, utm_campaign text, utm_content text, utm_term text,
  fbclid text, gclid text,
  created_at timestamptz not null default now()
);

create index quote_requests_open_idx on quote_requests (created_at) where status = 'new';

create table waitlist (
  id uuid primary key default gen_random_uuid(),
  phone phone_e164 not null,
  zip us_zip not null,
  created_at timestamptz not null default now(),
  unique (phone, zip)
);

-- ───────── Consent ─────────

-- Every text-message consent, with the exact wording shown (A2P 10DLC record).
create table sms_consent (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers (id) on delete set null,
  pro_id uuid references pros (id) on delete set null,
  phone phone_e164 not null,
  kind consent_kind not null,
  form consent_form not null,
  consent_text_version text not null,
  consent_text text not null,
  ip inet,
  user_agent text,
  given_at timestamptz not null default now(),
  revoked_at timestamptz,
  constraint sms_consent_owner check (customer_id is null or pro_id is null),
  constraint sms_consent_revoked check (revoked_at is null or revoked_at >= given_at)
);

create index sms_consent_phone_idx on sms_consent (phone) where revoked_at is null;

-- ───────── Messages ─────────

create table messages (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers (id) on delete set null,
  pro_id uuid references pros (id) on delete set null,
  to_address text not null, -- phone or email it went to (or came from, for inbound)
  channel message_channel not null,
  template text not null, -- key in lib/messages.ts, or 'inbound'
  body text not null,
  provider_id text unique, -- Twilio SID / Resend id
  status message_status not null default 'queued',
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index messages_customer_idx on messages (customer_id, created_at desc);
create index messages_pro_idx on messages (pro_id, created_at desc);

-- ───────── Manage links ─────────

-- /b/[token]: only a hash of the token is stored; links expire after 7 days.
create table manage_tokens (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers (id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint manage_tokens_expiry check (expires_at > created_at)
);

create index manage_tokens_customer_idx on manage_tokens (customer_id);
create index manage_tokens_expiry_idx on manage_tokens (expires_at);
