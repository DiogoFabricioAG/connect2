// Edge Function: import-guests-csv
// POST body: { event_code?: string, eventCode?: string, csv?: string }
// Requires organizer to be authenticated (Bearer token whose sub matches events.organizer_id)
// Parses CSV with header and inserts guests (full_name, email, metadata fields) if not existing.
// Returns { inserted: number, skipped: number, guests: [...] }
import { getServiceClient } from '../_shared/supabaseClient.ts'
// @ts-ignore
declare const Deno: any;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, Authorization, apikey, Apikey, x-client-info, X-Client-Info, content-type, Content-Type, accept, Accept',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};

interface ParsedRow {
  full_name: string;
  email?: string;
  metadata: Record<string, unknown>;
}

function parseCsv(text: string): ParsedRow[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (!lines.length) return [];
  const header = lines[0].split(/,\s*/).map(h => h.trim());
  const rows: ParsedRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    // Split on commas not enclosed in double quotes (basic CSV parsing).
    const cols = lines[i]
      .split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/) // commas outside quotes
      .map(c => {
        let s = c.trim();
        if (s.startsWith('"') && s.endsWith('"')) {
          s = s.slice(1, -1);
        }
        return s;
      });
    if (cols.length === 1 && cols[0] === '') continue;
    const map: Record<string, string> = {};
    for (const [idx, h] of header.entries()) {
      map[h] = cols[idx] ?? '';
    }
    const fullName = map['name'] || [map['first_name'], map['last_name']].filter(Boolean).join(' ').trim();
    if (!fullName) continue;
    const email = map['email'] || undefined;
    const metadata: Record<string, unknown> = {
      first_name: map['first_name'] || undefined,
      last_name: map['last_name'] || undefined,
      first_seen: map['first_seen'] || undefined,
      user_api_id: map['user_api_id'] || undefined,
      tags: map['tags'] || undefined,
      revenue: map['revenue'] || undefined,
      event_approved_count: map['event_approved_count'] || undefined,
      event_checked_in_count: map['event_checked_in_count'] || undefined,
      membership_name: map['membership_name'] || undefined,
      membership_status: map['membership_status'] || undefined
    };
    rows.push({ full_name: fullName, email, metadata });
  }
  return rows;
}

function getUserIdFromAuth(req: Request): string | undefined {
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) return undefined;
  const token = authHeader.substring(7).trim();
  const parts = token.split('.');
  if (parts.length !== 3) return undefined;
  try {
  const payloadJson = atob(parts[1].replaceAll('-', '+').replaceAll('_', '/'));
    const payload = JSON.parse(payloadJson);
    return typeof payload.sub === 'string' ? payload.sub : undefined;
  } catch {
    return undefined;
  }
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight explicitly with 200 JSON and a max-age so browsers can cache it
  if (req.method === 'OPTIONS') {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...cors, 'Access-Control-Max-Age': '86400', 'Content-Type': 'application/json' }
    });
  }
  // Simple healthcheck
  if (req.method === 'GET') return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } });
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: cors });
  try {
    const body = await req.json();
    const event_code = body.event_code || body.eventCode;
    const csv = body.csv as string;
    if (!event_code) return new Response('Missing event_code', { status: 400, headers: cors });
    if (!csv || typeof csv !== 'string') return new Response('Missing csv', { status: 400, headers: cors });

    const supabase = getServiceClient();
    // Lookup event
    const { data: ev, error: e1 } = await supabase.from('events').select('id, organizer_id').eq('code', event_code).single();
    if (e1 || !ev) return new Response('Event not found', { status: 404, headers: cors });

    // Auth & organizer check
    const userId = getUserIdFromAuth(req);
    if (!userId || ev.organizer_id !== userId) {
      return new Response('Not authorized (organizer mismatch)', { status: 403, headers: cors });
    }

    const parsed = parseCsv(csv);
    if (!parsed.length) return new Response(JSON.stringify({ inserted: 0, skipped: 0, guests: [] }), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } });

    // Existing emails to avoid duplicates
    const emails = parsed.map(r => r.email).filter(Boolean) as string[];
    let existing: { email: string }[] = [];
    if (emails.length) {
      const { data: ex } = await supabase.from('guests').select('email').in('email', emails).eq('event_id', ev.id);
      existing = ex || [];
    }
    const existingSet = new Set(existing.map(e => e.email));

    const rowsToInsert = parsed.filter(r => !r.email || !existingSet.has(r.email)).map(r => ({
      event_id: ev.id,
      full_name: r.full_name,
      email: r.email,
      metadata: r.metadata
    }));

    let inserted: any[] = [];
    if (rowsToInsert.length) {
      const { data: ins, error: e2 } = await supabase.from('guests').insert(rowsToInsert).select('*');
      if (e2) return new Response(e2.message, { status: 500, headers: cors });
      inserted = ins || [];
    }

    return new Response(JSON.stringify({ inserted: inserted.length, skipped: parsed.length - inserted.length, guests: inserted }), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as any).message }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
});