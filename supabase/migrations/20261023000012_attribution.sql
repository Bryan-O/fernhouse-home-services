-- Ad measurement (build step 10). UTM fields, fbclid and gclid are already on plans and
-- quote_requests; add Meta's browser id (_fbp) and whether the visitor allowed ad tracking
-- (Global Privacy Control turns it off), so the server-side Conversions API can respect it.
alter table plans
  add column fbp text check (length(fbp) <= 100),
  add column ads_ok boolean not null default true;
alter table quote_requests
  add column fbp text check (length(fbp) <= 100),
  add column ads_ok boolean not null default true;
