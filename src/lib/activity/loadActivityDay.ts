export const reportingZone = 'Asia/Kolkata';

export type ActivityCard = {
  target: string; title: string; thumbnail: string; channel: string; percent: number | null; resume: number;
};
export type ActivityOccurrence = { id: string; at: string; title: string | null; card?: ActivityCard | null };
type Visit = {
  id: string; opened: string; closed: string | null; inferred: boolean; seconds: number;
  starts: ActivityOccurrence[];
};
export type ActivityDay = {
  coverage: 'unavailable' | 'partial' | 'full';
  has_watch_history?: boolean;
  tracking_setup_required?: boolean;
  history?: ActivityOccurrence[];
  visits: Visit[];
  website: number;
  playback: number;
};

const isObject = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object';
const timestamp = (v: unknown) => typeof v === 'string' && Number.isFinite(Date.parse(v));
const seconds = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0;
function isOccurrence(row: unknown): boolean {
  if (!isObject(row) || typeof row.id !== 'string' || !timestamp(row.at)) return false;
  const card = row.card;
  return card == null || (isObject(card) && typeof card.target === 'string' && card.target.length > 0 &&
    [card.title,card.thumbnail,card.channel].every(field => typeof field === 'string') &&
    seconds(card.resume) && (card.percent === null || (seconds(card.percent) && Number(card.percent) <= 100)));
}
function isDay(v: unknown): v is ActivityDay {
  return isObject(v) && ['unavailable','partial','full'].includes(String(v.coverage)) &&
    seconds(v.website) && seconds(v.playback) && Array.isArray(v.visits) &&
    (v.has_watch_history === undefined || typeof v.has_watch_history === 'boolean') &&
    (v.history === undefined || (Array.isArray(v.history) && v.history.every(isOccurrence))) &&
    v.visits.every(row => isObject(row) && typeof row.id === 'string' && timestamp(row.opened) &&
      (row.closed === null || timestamp(row.closed)) && typeof row.inferred === 'boolean' && seconds(row.seconds) &&
      Array.isArray(row.starts) && row.starts.every(isOccurrence));
}

export class ActivityLoadError extends Error {
  readonly reason: string;
  readonly status: number;
  constructor(reason: string, status: number, message: string) {
    super(message);
    this.reason = reason;
    this.status = status;
  }
}

export async function loadActivityDay(childId: string, date: string, token: string, signal: AbortSignal): Promise<ActivityDay> {
  const response = await fetch('/api/child-activity', {
    method: 'POST', cache: 'no-store', signal,
    headers: { 'Content-Type':'application/json', 
      Authorization:'Bearer ' + token },
    body:JSON.stringify({kind:'day',child_id:childId,date,timezone:reportingZone})
  });
  if (!response.ok) {
    const messages: Record<number,string> = {
      401:'Your session expired. Sign in again to view activity.',
      403:'This account does not have access to this activity.',
      404:'The activity service is unavailable.',
      503:'The activity service is temporarily unavailable.'
    };
    const code = (await response.json().catch(() => null))?.code;
    const knownCodes = ['SERVICE_CONFIGURATION','ACTIVITY_ROUTE_MISSING','DAY_QUERY_FAILED',
      'WATCH_LOOKUP_FAILED','FAMILY_LOOKUP_FAILED','INVALID_DAY_RESPONSE','ACTIVITY_SERVICE_UNAVAILABLE'];
    throw new ActivityLoadError(knownCodes.includes(code) ? code : 'http',response.status,
      messages[response.status] || 'Activity could not be loaded.');
  }
  const value: unknown = await response.json().catch(() => null);
  if (!isDay(value)) throw new ActivityLoadError('invalid_response',response.status,'The activity service returned an unreadable timeline.');
  return value;
}
