import 'server-only';
import { createServiceClient } from './supabase/admin';
import { decryptField } from './crypto';
import { resolveProLink, type ProLink } from './pro-links';
import { addDays, todayIso } from './booking';
import { atlantaParts, clockText, cleanServiceText, dayDate, routeFull, windowShort } from './format';
import { LINKS, PRO_REQUIRED_DOCUMENTS, YARD_CONDITIONS, dogsText, type ArrivalWindowId } from './config';

// What a pro sees on /job/[token]. The full address and access details show only from 6 AM on
// the visit day until the visit is done; before and after, just the area.

export type JobStatus = 'assigned' | 'today' | 'on_way' | 'done';

export interface JobView {
  kind: 'visit';
  visitId: string;
  refLine: string;
  title: string;
  when: string;
  status: JobStatus;
  isPet: boolean;
  unlocked: boolean;
  address: string;
  mapsUrl: string;
  access: string;
  area: string;
  details: { k: string; v: string }[];
  photoUrl: string | null;
  doneAt: string | null;
  upgradePending: boolean;
  routeBack: string | null;
}

export interface RouteView {
  kind: 'route';
  title: string;
  when: string;
  stops: { visitId: string; label: string; done: boolean }[];
}

export interface DocsView {
  kind: 'docs';
  firstName: string;
  docs: { kind: (typeof PRO_REQUIRED_DOCUMENTS)[number]; status: 'verified' | 'pending' | 'missing' | 'expired' | 'expiring'; expiresOn: string | null }[];
}

interface VisitRow {
  id: string; date: string; window: ArrivalWindowId | null; status: string; pro_id: string | null; occurrence_date: string;
  on_way_at: string | null; completed_at: string | null; gate_photo_url: string | null; upgrade_status: string | null;
  plan: {
    id: string; ref: string; service: string; frequency: string; beds: number | null; baths: number | null; dogs: number | null;
    yard_condition: string | null; route_day: string | null; pets_note: string | null; requests: string | null; dog_names: string | null; dogs_friendly: boolean | null;
    address: { street: string; unit: string | null; city: string; zip: string; access_notes: string | null; gate_code: string | null };
  };
}

const FREQ_TEXT: Record<string, string> = { weekly: 'weekly', biweekly: 'biweekly', twice_weekly: 'twice-weekly', one_time: 'one-time' };

/** The visit a link opens: its own visit, or (route links) a visit on that pro's route that day. */
export async function linkVisit(link: ProLink, visitId?: string): Promise<VisitRow | null> {
  const id = link.kind === 'visit' ? link.visit_id : visitId;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data: v } = await createServiceClient().from('visits')
    .select(`id, date, window, status, pro_id, occurrence_date, on_way_at, completed_at, gate_photo_url, upgrade_status,
      plan:plans!inner(id, ref, service, frequency, beds, baths, dogs, yard_condition, route_day, pets_note, requests, dog_names, dogs_friendly,
        address:addresses(street, unit, city, zip, access_notes, gate_code))`)
    .eq('id', id).single<VisitRow>();
  // A link stops working if the visit was given to another pro, or isn't on this route.
  if (!v || v.pro_id !== link.pro_id) return null;
  if (link.kind === 'route' && v.date !== link.route_date) return null;
  if (!['scheduled', 'confirmed', 'done'].includes(v.status)) return null;
  return v;
}

export async function loadJob(token: string, visitId?: string, now = new Date()): Promise<JobView | RouteView | DocsView | null> {
  const link = await resolveProLink(token);
  if (!link) return null;
  if (link.kind === 'docs') return loadDocs(link.pro_id);
  if (link.kind === 'route' && !visitId) return loadRoute(link);
  const v = await linkVisit(link, visitId);
  if (!v) return null;

  const db = createServiceClient();
  const p = v.plan;
  const isPet = p.service === 'pet';
  const today = todayIso(now);
  const done = v.status === 'done';
  const unlocked = !done && (v.date < today || (v.date === today && atlantaParts(now).hour >= LINKS.jobAccessUnlockHour));
  const a = p.address;
  const address = `${a.street}${a.unit ? `, ${a.unit}` : ''}, ${a.city}, GA ${a.zip}`;

  let n = 1;
  if (!isPet) {
    const { count } = await db.from('visits').select('id', { count: 'exact', head: true }).eq('plan_id', p.id).lt('occurrence_date', v.occurrence_date);
    n = (count ?? 0) + 1;
  }
  const first = n === 1;
  const cond = YARD_CONDITIONS.find((y) => y.id === p.yard_condition);
  const details = isPet
    ? [
        { k: 'Dogs', v: `${p.dog_names || dogsText(p.dogs ?? 1)} — ${p.dogs_friendly === false ? 'kept inside' : 'friendly, may be in the yard'}` },
        { k: 'Booked as', v: first && cond ? `${cond.label} · first visit` : `${FREQ_TEXT[p.frequency] ?? ''} visit`.replace(/^./, (c) => c.toUpperCase()) },
        { k: 'Add-ons', v: 'None' },
        { k: 'Haul away', v: 'Bag all waste and take it with you' },
      ]
    : [
        { k: 'Home', v: `${p.beds} bed, ${p.baths} bath` },
        { k: 'Type', v: p.frequency === 'one_time' ? `One-time ${cleanServiceText(p.service).toLowerCase()}` : first ? `First clean of a ${FREQ_TEXT[p.frequency]} plan` : `${FREQ_TEXT[p.frequency].replace(/^./, (c) => c.toUpperCase())} plan visit` },
        { k: 'Pets', v: p.pets_note || 'None' },
        { k: 'Requests', v: p.requests || 'None' },
      ];

  let photoUrl: string | null = null;
  if (v.gate_photo_url && !done) {
    const s = await db.storage.from('gate-photos').createSignedUrl(v.gate_photo_url, 3600);
    photoUrl = s.data?.signedUrl ?? null;
  }

  return {
    kind: 'visit',
    visitId: v.id,
    refLine: isPet ? `Job ${p.ref} · ${routeFull(p.route_day)} route` : `Job ${p.ref} · visit ${n}`,
    title: isPet ? `Yard service · ${dogsText(p.dogs ?? 1)}` : cleanServiceText(p.service),
    when: isPet ? `${dayDate(v.date)} · any time${v.date === today ? ' today' : ''}` : `${dayDate(v.date)} · arrive ${windowShort(v.window)}`,
    status: done ? 'done' : v.date > today ? 'assigned' : v.on_way_at ? 'on_way' : 'today',
    isPet,
    unlocked,
    address: unlocked ? address : '',
    mapsUrl: unlocked ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : '',
    access: unlocked ? readAccess(isPet ? a.gate_code : a.access_notes) : '',
    area: `${a.city} ${a.zip}`,
    details,
    photoUrl,
    doneAt: v.completed_at ? clockText(new Date(v.completed_at)) : null,
    upgradePending: v.upgrade_status === 'pending',
    routeBack: link.kind === 'route' ? token : null,
  };
}

/** Access notes are encrypted; if one can't be read, the pro is told to call rather than the page failing. */
function readAccess(stored: string | null): string {
  try {
    return decryptField(stored) || 'No access notes — knock or ring.';
  } catch (err) {
    console.error('access note unreadable', (err as Error).message);
    return 'The access notes couldn’t be shown — please call Fernhouse before you go.';
  }
}

async function loadRoute(link: ProLink): Promise<RouteView> {
  const { data } = await createServiceClient().from('visits')
    .select('id, status, plan:plans!inner(service, dogs, address:addresses(street, city))')
    .eq('pro_id', link.pro_id).eq('date', link.route_date!).in('status', ['confirmed', 'scheduled', 'done']).order('created_at')
    .returns<{ id: string; status: string; plan: { service: string; dogs: number | null; address: { street: string; city: string } } }[]>();
  const stops = (data ?? []).filter((v) => v.plan.service === 'pet');
  return {
    kind: 'route',
    title: `${routeFull(['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][new Date(`${link.route_date}T12:00:00Z`).getUTCDay()])} route · ${stops.length} yard${stops.length === 1 ? '' : 's'}`,
    when: dayDate(link.route_date!),
    stops: stops.map((v) => ({ visitId: v.id, label: `${v.plan.address.city} · ${dogsText(v.plan.dogs ?? 1)}`, done: v.status === 'done' })),
  };
}

async function loadDocs(proId: string): Promise<DocsView | null> {
  const db = createServiceClient();
  const { data: pro } = await db.from('pros').select('name, active').eq('id', proId).single();
  if (!pro?.active) return null;
  const { data: rows } = await db.from('pro_documents').select('kind, expires_on, verified_at, created_at').eq('pro_id', proId).order('created_at', { ascending: false });
  return { kind: 'docs', firstName: pro.name.trim().split(/\s+/)[0], docs: PRO_REQUIRED_DOCUMENTS.map((k) => docStatus(k, rows ?? [])) };
}

/** The best document of a kind: a verified, unexpired one, else the newest upload. */
export function docStatus(kind: (typeof PRO_REQUIRED_DOCUMENTS)[number], rows: { kind: string; expires_on: string | null; verified_at: string | null }[], today = todayIso(), warnDays = 30) {
  const mine = rows.filter((r) => r.kind === kind);
  const live = mine.filter((r) => r.verified_at && (!r.expires_on || r.expires_on >= today)).sort((a, b) => (b.expires_on ?? '9999').localeCompare(a.expires_on ?? '9999'))[0];
  const pending = mine.find((r) => !r.verified_at && (!r.expires_on || r.expires_on >= today));
  if (pending && !live) return { kind, status: 'pending' as const, expiresOn: pending.expires_on };
  if (live) {
    const soon = live.expires_on && live.expires_on <= addDays(today, warnDays);
    return { kind, status: soon && !pending ? ('expiring' as const) : ('verified' as const), expiresOn: live.expires_on };
  }
  if (mine.length) return { kind, status: 'expired' as const, expiresOn: mine[0].expires_on };
  return { kind, status: 'missing' as const, expiresOn: null };
}

