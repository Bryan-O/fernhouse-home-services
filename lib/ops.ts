import 'server-only';
import { createServiceClient } from './supabase/admin';
import { docStatus } from './job';
import { addDays, fmtLong, formatPhone, todayIso, weekday } from './booking';
import {
  atlantaParts, cleanServiceText, dayDate, money, monthDay, petFreqLabel, routeFull, shortName, untilText, windowShort,
} from './format';
import {
  ARRIVAL_WINDOWS, AUTOMATIONS, CAPACITY_DEFAULTS, OFFER, PRO_REQUIRED_DOCUMENTS, ROUTE_DAYS, SERVICE_ZIPS, dogsText,
  type ArrivalWindowId,
} from './config';

// What the owner dashboard shows. Owner pages call requireOwner() first; reads use the
// server key, so nothing here is reachable from the browser.

export type Tone = 'ok' | 'warn' | 'bad' | 'neutral';
const DAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const FREQ: Record<string, string> = { weekly: 'weekly', biweekly: 'biweekly', twice_weekly: 'twice weekly', one_time: 'one-time' };

export function ago(iso: string, now = new Date()): string {
  const mins = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 60_000));
  if (mins < 60) return mins <= 1 ? 'just now' : `${mins} minutes ago`;
  const hours = Math.round(mins / 60);
  if (todayIso(new Date(iso)) === todayIso(now)) return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
  if (todayIso(new Date(iso)) === addDays(todayIso(now), -1)) return 'yesterday';
  return monthDay(todayIso(new Date(iso)));
}

const refNo = (ref: string) => ref.split('-').pop()!;

// ───────── Today ─────────

export interface TodayView {
  dateLabel: string;
  greeting: string;
  kpis: { n: number; label: string; tone: 'warn' | 'bad' | null }[];
  unassigned: { ref: string; what: string; when: string; area: string; ago: string; price: string }[];
  today: { when: string; svc: string; area: string; pro: string; status: string; tone: Tone; note: string | null }[];
  openYardsToday: number;
  failed: { paymentId: string; title: string; what: string; sub: string }[];
  quotes: { id: string; what: string; phone: string; smsHref: string; ago: string }[];
  docs: { proId: string; title: string; sub: string; warn: boolean }[];
  waitlist: { people: number; top: string };
}

interface UnassignedRow { visit_id: string; date: string; window: ArrivalWindowId | null; city: string; plan_id: string; plan_created_at: string }

export async function loadToday(now = new Date()): Promise<TodayView> {
  const db = createServiceClient();
  const today = todayIso(now);
  const hour = atlantaParts(now).hour;

  const [un, vis, fails, quotes, docs, wait] = await Promise.all([
    db.rpc('unassigned_visits', { p_today: today, p_days: AUTOMATIONS.unassignedLookaheadDays }),
    db.from('visits').select('id, window, status, on_way_at, pro_note, upgrade_status, pro:pros(name), plan:plans!inner(service, dogs, address:addresses(city))')
      .eq('date', today).in('status', ['scheduled', 'confirmed', 'done']).order('window')
      .returns<{ id: string; window: ArrivalWindowId | null; status: string; on_way_at: string | null; pro_note: string | null; upgrade_status: string | null; pro: { name: string } | null; plan: { service: string; dogs: number | null; address: { city: string } } }[]>(),
    db.rpc('open_failed_charges', { p_since: new Date(now.getTime() - AUTOMATIONS.failedChargeFollowUpDays * 86400_000).toISOString() }),
    db.from('quote_requests').select('id, phone, dogs, over_half_acre, created_at').eq('status', 'new').order('created_at', { ascending: false }),
    db.from('pro_documents').select('pro_id, kind, expires_on, verified_at, created_at, pro:pros!inner(name, active)').eq('pros.active', true)
      .returns<{ pro_id: string; kind: string; expires_on: string | null; verified_at: string | null; created_at: string; pro: { name: string } }[]>(),
    db.from('waitlist').select('phone, zip'),
  ]);

  // Needs a pro: one row per booking, its first visit without a pro.
  const rows = (un.data ?? []) as UnassignedRow[];
  const firstByPlan = new Map<string, UnassignedRow>();
  for (const r of rows) if (!firstByPlan.has(r.plan_id)) firstByPlan.set(r.plan_id, r);
  const planIds = [...firstByPlan.keys()];
  const { data: plans } = planIds.length
    ? await db.from('plans').select('id, ref, service, frequency, beds, baths, dogs, route_day, created_at, visits(id, price_cents, discount_cents)').in('id', planIds)
    : { data: [] as never[] };
  const unassigned = [...firstByPlan.values()].map((r) => {
    const p = (plans ?? []).find((x: { id: string }) => x.id === r.plan_id) as {
      ref: string; service: string; frequency: string; beds: number; baths: number; dogs: number | null; route_day: string | null; created_at: string;
      visits: { id: string; price_cents: number; discount_cents: number }[];
    };
    const v = p.visits.find((x) => x.id === r.visit_id)!;
    const pet = p.service === 'pet';
    return {
      ref: refNo(p.ref),
      what: pet ? `Pet waste · ${petFreqLabel(p.frequency).toLowerCase()} · ${dogsText(p.dogs ?? 1)}` : `${cleanServiceText(p.service)} · ${p.beds} bed, ${p.baths} bath`,
      when: pet ? `${routeFull(p.route_day)}s from ${monthDay(r.date)}` : `${dayDate(r.date)} · ${windowShort(r.window)}`,
      area: r.city,
      ago: ago(p.created_at, now),
      price: money(v.price_cents - v.discount_cents),
    };
  });

  // Today's visits: each clean, and each yard pro's route as one row.
  const today_: TodayView['today'] = [];
  const routes = new Map<string, { pro: string; total: number; done: number; cities: Set<string> }>();
  for (const v of vis.data ?? []) {
    if (v.plan.service === 'pet') {
      const key = v.pro?.name ?? '';
      const r = routes.get(key) ?? { pro: v.pro ? shortName(v.pro.name) : 'Needs a pro', total: 0, done: 0, cities: new Set<string>() };
      r.total++;
      if (v.status === 'done') r.done++;
      r.cities.add(v.plan.address.city);
      routes.set(key, r);
      continue;
    }
    const s = v.status === 'done' ? (['Done', 'ok'] as const) : !v.pro ? (['Needs a pro', 'bad'] as const) : v.on_way_at ? (['On the way', 'neutral'] as const) : (['Scheduled', 'neutral'] as const);
    today_.push({ when: windowShort(v.window), svc: cleanServiceText(v.plan.service), area: v.plan.address.city, pro: v.pro ? shortName(v.pro.name) : '—', status: s[0], tone: s[1], note: v.pro_note });
  }
  for (const r of routes.values()) {
    const all = r.done === r.total;
    today_.push({
      when: 'Route day', svc: `Pet waste · ${r.total} yard${r.total === 1 ? '' : 's'}`, area: [...r.cities].join(', '), pro: r.pro,
      status: all ? 'Done' : r.pro === 'Needs a pro' ? 'Needs a pro' : `${r.done} of ${r.total} done`, tone: all ? 'ok' : r.pro === 'Needs a pro' ? 'bad' : 'warn', note: null,
    });
  }
  today_.sort((a, b) => order(a.when) - order(b.when));

  // Failed payments.
  const failRows = (fails.data ?? []) as { payment_id: string; visit_id: string; customer_id: string; kind: string; amount_cents: number; failed_at: string; dunning_paused_at: string | null }[];
  const failVisits = failRows.length
    ? (await db.from('visits').select('id, date, plan:plans!inner(service, customer:customers(name))').in('id', failRows.map((f) => f.visit_id))
        .returns<{ id: string; date: string; plan: { service: string; customer: { name: string } } }[]>()).data ?? []
    : [];
  const failed = failRows.map((f) => {
    const v = failVisits.find((x) => x.id === f.visit_id)!;
    const failedAt = new Date(f.failed_at).getTime();
    const remindAt = new Date(failedAt + AUTOMATIONS.paymentFailedReminderHours * 3600_000);
    const pauseAt = new Date(failedAt + AUTOMATIONS.cardUpdateDeadlineHours * 3600_000);
    const sub = f.kind === 'late_fee' ? 'Late fee · customer not texted — follow up yourself'
      : f.dunning_paused_at ? 'Plan paused · waiting for a new card'
      : now < remindAt ? `Customer texted · reminder sends ${untilText(remindAt, now)}`
      : `Reminder sent · plan pauses ${untilText(pauseAt, now)}`;
    return {
      paymentId: f.payment_id,
      title: `${shortName(v.plan.customer.name)} · ${money(f.amount_cents)}`,
      what: `${monthDay(v.date)} ${f.kind === 'late_fee' ? 'late fee' : v.plan.service === 'pet' ? 'yard visit' : 'clean'} · card declined`,
      sub,
    };
  });

  // Pro documents: expiring within 30 days, or uploaded and waiting for a check.
  const docRows = docs.data ?? [];
  const byPro = new Map<string, typeof docRows>();
  for (const d of docRows) byPro.set(d.pro_id, [...(byPro.get(d.pro_id) ?? []), d]);
  const docAlerts: TodayView['docs'] = [];
  for (const [proId, list] of byPro) {
    const name = shortName(list[0].pro.name);
    for (const k of PRO_REQUIRED_DOCUMENTS) {
      const s = docStatus(k, list, today, AUTOMATIONS.proDocExpiryWarningDays);
      const label = DOC_LABEL[k];
      if (s.status === 'expiring') docAlerts.push({ proId, title: `${name} · ${label.toLowerCase()} expires ${monthDay(s.expiresOn!)}`, sub: 'They can’t be assigned visits after that date until a new one is verified.', warn: true });
      const pending = list.find((d) => d.kind === k && !d.verified_at);
      if (pending) docAlerts.push({ proId, title: `${name} · ${label.toLowerCase()}`, sub: `Uploaded ${ago(pending.created_at, now)} · needs your check`, warn: false });
    }
  }

  // Waitlist.
  const w = wait.data ?? [];
  const counts = new Map<string, number>();
  for (const x of w) counts.set(x.zip, (counts.get(x.zip) ?? 0) + 1);
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([z, n]) => `${z} (${n})`).join(', ');

  return {
    dateLabel: fmtLong(today),
    greeting: hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening',
    kpis: [
      { n: firstByPlan.size, label: 'need a pro', tone: firstByPlan.size ? 'warn' : null },
      { n: (vis.data ?? []).length, label: 'visits today', tone: null },
      { n: failed.length, label: failed.length === 1 ? 'failed payment' : 'failed payments', tone: failed.length ? 'bad' : null },
      { n: (quotes.data ?? []).length, label: (quotes.data ?? []).length === 1 ? 'quote request' : 'quote requests', tone: null },
    ],
    unassigned,
    today: today_,
    openYardsToday: (vis.data ?? []).filter((v) => v.plan.service === 'pet' && v.status !== 'done').length,
    failed,
    quotes: (quotes.data ?? []).map((q) => ({
      id: q.id,
      // Exact count here (the booking page's "5+ dogs" label stops at 5).
      what: `Pet waste · ${q.over_half_acre ? 'over ½-acre yard, ' : ''}${q.dogs ?? 1} dog${q.dogs === 1 ? '' : 's'}`,
      phone: formatPhone(q.phone),
      smsHref: `sms:${q.phone}`,
      ago: ago(q.created_at, now),
    })),
    docs: docAlerts,
    waitlist: { people: new Set(w.map((x) => x.phone)).size, top },
  };
}

const order = (when: string) => (when === 'Route day' ? 0.5 : ARRIVAL_WINDOWS.findIndex((w) => w.short === when) + 1);

export const DOC_LABEL: Record<(typeof PRO_REQUIRED_DOCUMENTS)[number], string> = { insurance: 'Insurance', bond: 'Bond certificate', background_check: 'Background check' };

// ───────── Assign a pro ─────────

export interface AssignView {
  planId: string;
  ref: string;
  bookedAgo: string;
  from: string;
  details: { k: string; v: string }[];
  legend: string;
  pros: { id: string; name: string; detail: string; status: string; tone: Tone; blocked: boolean }[];
  assigned: { pro: string; count: number } | null;
  customerFirst: string;
  /** An open visit due today (or overdue): where "Couldn't get in" applies. */
  dueVisit: { id: string; isPet: boolean; label: string } | null;
}

export async function loadAssign(refNumber: string, now = new Date()): Promise<AssignView | null> {
  if (!/^\d{5}$/.test(refNumber)) return null;
  const db = createServiceClient();
  const { data: p } = await db.from('plans')
    .select(`id, ref, service, frequency, beds, baths, dogs, route_day, window, pets_note, requests, dog_names, dogs_friendly, created_at, status,
      customer:customers(name, mobile), address:addresses(city, zip),
      visits(id, date, window, status, pro_id, price_cents, discount_cents, pro:pros(name))`)
    .like('ref', `FH-__-${refNumber}`).order('created_at', { ascending: false }).limit(1).maybeSingle<{
      id: string; ref: string; service: string; frequency: string; beds: number; baths: number; dogs: number | null; route_day: string | null; window: ArrivalWindowId | null;
      pets_note: string | null; requests: string | null; dog_names: string | null; dogs_friendly: boolean | null; created_at: string; status: string;
      customer: { name: string; mobile: string }; address: { city: string; zip: string };
      visits: { id: string; date: string; window: ArrivalWindowId | null; status: string; pro_id: string | null; price_cents: number; discount_cents: number; pro: { name: string } | null }[];
    }>();
  if (!p) return null;
  const today = todayIso(now);
  const visits = [...p.visits].sort((a, b) => a.date.localeCompare(b.date));
  const open = visits.filter((v) => v.status === 'scheduled' && !v.pro_id && v.date >= today);
  const target = open[0] ?? visits.find((v) => v.date >= today && ['scheduled', 'confirmed'].includes(v.status)) ?? visits[0];
  const pet = p.service === 'pet';
  const firstVisit = visits[0];
  const assignedPros = visits.filter((v) => v.pro && v.date >= today && v.status === 'confirmed');

  const details = [
    { k: 'Service', v: pet ? `Pet waste · ${dogsText(p.dogs ?? 1)} · ${petFreqLabel(p.frequency).toLowerCase()}` : `${cleanServiceText(p.service)} · ${p.beds} bed, ${p.baths} bath · ${FREQ[p.frequency]}` },
    { k: 'When', v: pet ? `${routeFull(p.route_day)}s from ${monthDay(target.date)}` : `${dayDate(target.date)} · ${windowShort(target.window)} arrival` },
    { k: 'Where', v: `${p.address.city} ${p.address.zip} (full address shows to the pro once assigned)` },
    { k: 'Customer', v: `${shortName(p.customer.name)} · ${formatPhone(p.customer.mobile)}` },
    { k: 'Notes', v: (pet ? [p.dog_names, p.dogs_friendly === false ? 'kept inside' : p.dogs_friendly ? 'friendly' : null, p.requests] : [p.pets_note, p.requests]).filter(Boolean).join(' · ') || 'None' },
    { k: 'Pays', v: firstVisit.discount_cents > 0 && target.id === firstVisit.id ? `${money(firstVisit.price_cents - firstVisit.discount_cents)} (first clean, ${OFFER.firstCleanPct}% off)` : `${money(target.price_cents - target.discount_cents)}${p.frequency === 'one_time' ? '' : ' per visit'}` },
  ];

  // Pros for this service who cover the ZIP (a pro with no ZIPs listed covers everywhere).
  const svc = pet ? 'pet' : 'cleaning';
  const { data: pros } = await db.from('pros').select('id, name, service_types, zips, off_weekdays, pro_documents(kind, expires_on, verified_at)').eq('active', true).contains('service_types', [svc]);
  const { data: dayLoad } = await db.from('visits').select('pro_id').eq('date', target.date).not('pro_id', 'is', null).in('status', ['confirmed', 'done']);
  const dow = weekday(target.date);
  const list = (pros ?? [])
    .filter((x) => !x.zips?.length || x.zips.includes(p.address.zip))
    .map((x) => {
      const docs = PRO_REQUIRED_DOCUMENTS.map((k) => docStatus(k, x.pro_documents ?? [], target.date, AUTOMATIONS.proDocExpiryWarningDays));
      const bad = docs.find((d) => d.status === 'missing' || d.status === 'pending' || d.status === 'expired');
      const soon = docs.find((d) => d.status === 'expiring');
      const n = (dayLoad ?? []).filter((v) => v.pro_id === x.id).length;
      const services = (x.service_types as string[]).map((t) => (t === 'pet' ? 'yard' : 'Cleaning')).join(' + ').replace(/^yard/, 'Yard');
      const off = (x.off_weekdays as number[]).includes(dow);
      const docWhy = bad ? `${DOC_LABEL[bad.kind].toLowerCase()} ${bad.status === 'pending' ? 'not checked yet' : bad.status}` : '';
      const base = { id: x.id, name: shortName(x.name) };
      if (bad) return { ...base, detail: `${services} · ${docWhy}`, status: 'Can’t assign', tone: 'bad' as Tone, blocked: true };
      if (off) return { ...base, detail: `${services} · off on ${DAY_FULL[dow]}s`, status: 'Off that day', tone: 'neutral' as Tone, blocked: true };
      return {
        ...base,
        detail: `${services} · ${n} visit${n === 1 ? '' : 's'} that day${soon ? ` · ${DOC_LABEL[soon.kind].toLowerCase()} expires ${monthDay(soon.expiresOn!)}` : ''}`,
        status: 'Available', tone: (soon ? 'warn' : 'ok') as Tone, blocked: false,
      };
    })
    .sort((a, b) => Number(a.blocked) - Number(b.blocked));

  return {
    planId: p.id,
    ref: p.ref,
    bookedAgo: ago(p.created_at, now),
    from: today,
    details,
    legend: `Pros who cover ${p.address.zip} on ${DAY_FULL[dow]}s`,
    pros: open.length ? list : [],
    assigned: !open.length && assignedPros.length ? { pro: shortName(assignedPros[0].pro!.name), count: assignedPros.length } : null,
    customerFirst: p.customer.name.trim().split(/\s+/)[0],
    dueVisit: (() => {
      const d = visits.find((v) => v.date <= today && ['scheduled', 'confirmed'].includes(v.status) && v.pro_id);
      return d ? { id: d.id, isPet: pet, label: pet ? dayDate(d.date) : `${dayDate(d.date)} · ${windowShort(d.window)}` } : null;
    })(),
  };
}

// ───────── Capacity ─────────

export interface CapacityView {
  clean: { weekday: number; day: string; slots: [number, number, number] }[];
  yard: { weekday: number; day: string; slots: number }[];
  blocked: { dates: string[]; label: string; note: string }[];
}

export async function loadCapacity(): Promise<CapacityView> {
  const db = createServiceClient();
  const { data } = await db.from('capacity').select('kind, weekday, date, window, slots, blocked, note');
  const rows = data ?? [];
  const clean = [1, 2, 3, 4, 5, 6].map((d) => ({
    weekday: d,
    day: DAY_FULL[d],
    slots: ARRIVAL_WINDOWS.map((w, i) => rows.find((r) => r.kind === 'cleaning' && r.weekday === d && r.window === w.id)?.slots ?? CAPACITY_DEFAULTS.cleaningPerWindow[d][i]) as [number, number, number],
  }));
  const yard = ROUTE_DAYS.map((r) => ({ weekday: r.day, day: r.full, slots: rows.find((x) => x.kind === 'yard' && x.weekday === r.day)?.slots ?? CAPACITY_DEFAULTS.yardsPerRouteDay[r.id] }));
  // Blocked days, consecutive dates with the same label shown as one line ("Dec 24–25 · Holidays").
  const dates = rows.filter((r) => r.kind === 'cleaning' && r.date && r.blocked && !r.window && r.date >= todayIso()).sort((a, b) => a.date!.localeCompare(b.date!));
  const blocked: CapacityView['blocked'] = [];
  for (const r of dates) {
    const last = blocked[blocked.length - 1];
    if (last && last.note === (r.note ?? '') && addDays(last.dates[last.dates.length - 1], 1) === r.date) last.dates.push(r.date!);
    else blocked.push({ dates: [r.date!], label: '', note: r.note ?? '' });
  }
  for (const b of blocked) {
    const a = b.dates[0], z = b.dates[b.dates.length - 1];
    const range = a === z ? dayDate(a) : a.slice(0, 7) === z.slice(0, 7) ? `${monthDay(a)}–${Number(z.slice(8))}` : `${monthDay(a)}–${monthDay(z)}`;
    b.label = `${range}${b.note ? ` · ${b.note}` : ''}`;
  }
  return { clean, yard, blocked };
}

// ───────── Pros ─────────

export interface ProRow {
  id: string; name: string; services: string; areas: string; active: boolean;
  docs: Record<(typeof PRO_REQUIRED_DOCUMENTS)[number], { label: string; tone: Tone }>;
}

const CITY_OF = (zip: string) => SERVICE_ZIPS[zip] ?? zip;

export function areasText(zips: string[] | null): string {
  if (!zips?.length) return 'All areas';
  return [...new Set(zips.map(CITY_OF))].join(', ');
}

export function docCell(s: ReturnType<typeof docStatus>, background: boolean): { label: string; tone: Tone } {
  if (s.status === 'missing') return { label: 'Missing', tone: 'bad' };
  if (s.status === 'pending') return { label: 'Needs check', tone: 'bad' };
  if (s.status === 'expired') return { label: `Expired ${monthDay(s.expiresOn!)}`, tone: 'bad' };
  if (s.status === 'expiring') return { label: `Expires ${monthDay(s.expiresOn!)}`, tone: 'warn' };
  if (background) return { label: 'Clear', tone: 'ok' };
  const [y, m] = s.expiresOn!.split('-').map(Number);
  return { label: `Verified · ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1]} ${y}`, tone: 'ok' };
}

export async function loadPros(): Promise<ProRow[]> {
  const { data } = await createServiceClient().from('pros').select('id, name, service_types, zips, active, pro_documents(kind, expires_on, verified_at)').order('active', { ascending: false }).order('name');
  return (data ?? []).map((p) => ({
    id: p.id,
    name: shortName(p.name),
    services: (p.service_types as string[]).map((t) => (t === 'pet' ? 'yard' : 'cleaning')).join(', ').replace(/^./, (c) => c.toUpperCase()),
    areas: areasText(p.zips),
    active: p.active,
    docs: Object.fromEntries(PRO_REQUIRED_DOCUMENTS.map((k) => [k, docCell(docStatus(k, p.pro_documents ?? [], todayIso(), AUTOMATIONS.proDocExpiryWarningDays), k === 'background_check')])) as ProRow['docs'],
  }));
}

export interface ProDetail {
  id: string; name: string; mobile: string; services: string[]; zips: string[]; offWeekdays: number[]; active: boolean; consent: boolean;
  docs: { id: string; kind: string; label: string; expiresOn: string | null; verified: boolean; uploaded: string; url: string | null }[];
}

export async function loadPro(id: string): Promise<ProDetail | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const db = createServiceClient();
  const { data: p } = await db.from('pros').select('id, name, mobile, service_types, zips, off_weekdays, active, pro_documents(id, kind, file_url, expires_on, verified_at, created_at)').eq('id', id).maybeSingle();
  if (!p) return null;
  const { data: consent } = await db.rpc('sms_allowed', { p_phone: p.mobile, p_kind: 'pro_jobs' });
  const docs = await Promise.all([...(p.pro_documents ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at)).map(async (d) => ({
    id: d.id, kind: d.kind, label: DOC_LABEL[d.kind as keyof typeof DOC_LABEL], expiresOn: d.expires_on, verified: !!d.verified_at, uploaded: monthDay(todayIso(new Date(d.created_at))),
    url: (await db.storage.from('pro-documents').createSignedUrl(d.file_url, 600)).data?.signedUrl ?? null,
  })));
  return { id: p.id, name: p.name, mobile: p.mobile, services: p.service_types, zips: p.zips ?? [], offWeekdays: p.off_weekdays ?? [], active: p.active, consent: !!consent, docs };
}

