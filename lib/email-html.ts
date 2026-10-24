// Renders an EmailContent (lib/messages.ts) to HTML and plain text, laid out like the emails
// in design/Messages.dc.html. Email clients ignore most CSS, so styles are inline and the
// layout is tables; web fonts fall back to system fonts where unsupported.

import type { EmailContent } from './messages';

const C = { ink: '#343631', ink2: '#4A4C46', muted: '#5F625A', paper2: '#F5F1E9', accent: '#243E36', accentSoft: '#E3EAE5', line: '#C9A98A', rowLine: '#EDE6DA', onAccent: '#F5F1E9' };
const SANS = "'DM Sans', -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const DISPLAY = "Newsreader, Georgia, 'Times New Roman', serif";

// Escapes text for HTML, keeping times like "11 AM" on one line.
export const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
    .replace(/(\d) (AM|PM)\b/g, '$1&nbsp;$2');

export function renderEmail(e: EmailContent, origin: string): { html: string; text: string } {
  const p = (s: string, size = 16, line = 25, color = C.ink2) =>
    `<p style="margin:0 0 16px;font-size:${size}px;line-height:${line}px;color:${color}">${s}</p>`;

  const rows = e.rows?.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 16px">${e.rows
        .map((r, i) => {
          const last = i === e.rows!.length - 1;
          const border = r.strong && last ? '0' : `1px solid ${C.rowLine}`;
          return `<tr><td style="padding:6px 0;border-bottom:${border};font-size:15px;line-height:22px;color:${r.strong ? C.ink : C.muted};font-weight:${r.strong ? 600 : 400};vertical-align:top">${esc(r.label)}</td><td align="right" style="padding:6px 0 6px 12px;border-bottom:${border};font-size:15px;line-height:22px;color:${C.ink};font-weight:600;text-align:right;vertical-align:top">${esc(r.value)}</td></tr>`;
        })
        .join('')}</table>`
    : '';

  const callout = e.callout
    ? `<div style="background:${C.accentSoft};border-radius:12px;padding:14px 16px;font-size:15px;line-height:23px;color:${C.ink};margin:0 0 16px">${esc(e.callout.before)}${e.callout.strong ? `<strong>${esc(e.callout.strong)}</strong>` : ''}${esc(e.callout.after ?? '')}</div>`
    : '';

  const button = e.button
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 16px"><tr><td style="border-radius:999px;background:${C.accent}"><a href="${esc(e.button.url)}" style="display:inline-block;padding:13px 22px;border-radius:999px;background:${C.accent};color:${C.onAccent};font-weight:600;font-size:15px;line-height:22px;text-decoration:none;font-family:${SANS}">${esc(e.button.label)}</a></td></tr></table>`
    : '';

  // The rating row: five round number links, with what 1 and 5 mean underneath.
  const scale = e.scale
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 8px"><tr>${e.scale.links
        .map((url, i) => `<td style="padding:0 8px 0 0"><a href="${esc(url)}" aria-label="${i + 1} out of 5" style="display:inline-block;width:48px;height:48px;line-height:48px;border-radius:999px;background:${C.accentSoft};color:${C.accent};font-weight:700;font-size:18px;text-align:center;text-decoration:none;font-family:${SANS}">${i + 1}</a></td>`)
        .join('')}</tr></table>${p(`${esc(e.scale.low)} · ${esc(e.scale.high)}`, 13, 20, C.muted)}`
    : '';

  const legal = e.legalLinks
    ? ` · <a href="${origin}/privacy" style="color:${C.muted};text-decoration:underline">Privacy</a> · <a href="${origin}/terms" style="color:${C.muted};text-decoration:underline">Terms</a>`
    : '';

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(e.subject)}</title></head>
<body style="margin:0;padding:0;background:${C.paper2};-webkit-font-smoothing:antialiased">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(e.preview)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.paper2}"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:616px;background:#FFFFFF;border:1px solid ${C.line};border-radius:16px"><tr><td style="padding:28px;font-family:${SANS};color:${C.ink}">
<div style="font-family:${SANS};font-weight:700;font-size:16px;line-height:24px;letter-spacing:2px;color:${C.accent};margin:0 0 16px">FERNHOUSE</div>
<h1 style="margin:0 0 16px;font-family:${DISPLAY};font-weight:600;font-size:26px;line-height:32px;color:${C.ink}">${esc(e.heading)}</h1>
${e.intro ? p(esc(e.intro)) : ''}${rows}${callout}${button}${scale}${e.note ? p(esc(e.note), 14, 21, C.muted) : ''}
<p style="margin:0;font-size:13px;line-height:20px;color:${C.muted};border-top:1px solid ${C.rowLine};padding-top:14px">${esc(e.footer)}${legal}</p>
</td></tr></table>
</td></tr></table>
</body></html>`;

  const text = [
    e.heading,
    e.intro,
    e.rows?.map((r) => `${r.label}: ${r.value}`).join('\n'),
    e.callout ? `${e.callout.before}${e.callout.strong ?? ''}${e.callout.after ?? ''}` : '',
    e.button ? `${e.button.label}: ${e.button.url}` : '',
    e.scale ? e.scale.links.map((u, i) => `${i + 1}: ${u}`).join('\n') + `\n(${e.scale.low} · ${e.scale.high})` : '',
    e.note,
    `${e.footer}${e.legalLinks ? `\nPrivacy: ${origin}/privacy · Terms: ${origin}/terms` : ''}`,
  ].filter(Boolean).join('\n\n');

  return { html, text };
}
