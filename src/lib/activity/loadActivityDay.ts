export const reportingZone = 'Asia/Kolkata';

type Visit = {
  id: string; opened: string; closed: string | null; inferred: boolean; seconds: number;
  starts: { id: string; at: string; title: string | null }[];
};
export type ActivityDay = {
  coverage: 'unavailable' | 'partial' | 'full';
  has_watch_history?: boolean;
  tracking_setup_required?: boolean;
  visits: Visit[];
  website: number;
  playback: number;
};

const isObject = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object';
const timestamp = (v: unknown) => typeof v === 'string' && Number.isFinite(Date.parse(v));
const seconds = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0;
function isDay(v: unknown): v is ActivityDay {
  return isObject(v) && ['unavailable','partial','full'].includes(String(v.coverage)) &&
    seconds(v.website) && seconds(v.playback) && Array.isArray(v.visits) &&
    (v.has_watch_history === undefined || typeof v.has_watch_history === 'boolean') &&
    v.visits.every(row => isObject(row) && typeof row.id === 'string' && timestamp(row.opened) &&
      (row.closed === null || timestamp(row.closed)) && typeof row.inferred === 'boolean' && seconds(row.seconds) &&
      Array.isArray(row.starts) && row.starts.every(start => isObject(start) && typeof start.id === 'string' &&
        timestamp(start.at) && (start.title === null || typeof start.title === 'string')));
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
    throw new ActivityLoadError('http',response.status,messages[response.status] || 'Activity could not be loaded.');
  }
  const value: unknown = await response.json().catch(() => null);
  if (!isDay(value)) throw new ActivityLoadError('invalid_response',response.status,'The activity service returned an unreadable timeline.');
  return value;
}
