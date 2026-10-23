import { KEYWORDS } from './messages';

export type Keyword = 'stop' | 'help' | 'start' | null;

/** The carrier keyword a reply is, if any: the whole message, ignoring case, spaces and punctuation. */
export function keywordOf(body: string, optedOut: boolean): Keyword {
  const w = body.trim().toUpperCase().replace(/[^A-Z]/g, '');
  if ((KEYWORDS.stop as readonly string[]).includes(w)) return 'stop';
  if ((KEYWORDS.help as readonly string[]).includes(w)) return 'help';
  if ((KEYWORDS.start as readonly string[]).includes(w)) return 'start';
  if (optedOut && (KEYWORDS.startIfOptedOut as readonly string[]).includes(w)) return 'start';
  return null;
}
