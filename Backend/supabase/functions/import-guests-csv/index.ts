// Edge Function: import-guests-csv
// POST body: { event_id?: string, eventId?: string, event_code?: string, eventCode?: string, csv?: string }
// Requires organizer to be authenticated (Bearer token whose sub matches events.organizer_id)
// Parses CSV with header and inserts guests (full_name, email, metadata fields) if not existing.
// Returns { inserted: number, skipped: number, guests: [...], emails_sent?: number }
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

function slugifyHeader(h: string): string {
  return h
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function parseCsv(text: string): ParsedRow[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (!lines.length) return [];
  // Header split using quote-aware regex like rows
  const header = lines[0]
    .split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)
    .map(h => {
      let s = h.trim();
      if (s.startsWith('"') && s.endsWith('"')) s = s.slice(1, -1);
      return slugifyHeader(s);
    });
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
    const fullNameRaw = map['name'] || [map['first_name'], map['last_name']].filter(Boolean).join(' ').trim();
    const emailRaw = map['email'] || '';
    const fullName = (fullNameRaw || emailRaw.split('@')[0] || '').trim();
    if (!fullName) continue;
    const email = emailRaw || undefined;
    const metadata: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(map)) {
      if (!v || v.trim() === '') continue;
      if (k === 'name' || k === 'first_name' || k === 'last_name' || k === 'email') continue;
      // Keep raw; if looks like comma-list for custom skills, store as array
      if (/[,;]/.test(v) && (k.includes('aptitude') || k.includes('interes') || k.includes('skills') || k.includes('tags'))) {
        metadata[k] = v.split(/[;,]/).map(s => s.trim()).filter(Boolean);
      } else {
        metadata[k] = v;
      }
    }
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

interface ResendEmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

async function sendEmailWithResend(apiKey: string, opts: ResendEmailOptions) {
  const fromAddress = opts.from || (Deno.env.get('RESEND_FROM') || 'onboarding@resend.dev');
  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: fromAddress,
      to: [opts.to],
      subject: opts.subject,
      html: opts.html
    })
  });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`Resend error: ${resp.status} ${txt}`);
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
    const raw_id = body.event_id || body.eventId;
    const event_id = typeof raw_id === 'string' ? raw_id.trim() : '';
    const raw_code = body.event_code || body.eventCode;
    const event_code = typeof raw_code === 'string' ? raw_code.trim() : '';
    const csv = body.csv as string;
    if (!event_id && !event_code) return new Response(JSON.stringify({ error: 'missing_event_ref' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
    if (!csv || typeof csv !== 'string') return new Response('Missing csv', { status: 400, headers: cors });

    const supabase = getServiceClient();
    // Lookup event (include name for email content)
    interface EventRow { id: string; organizer_id: string; title?: string | null; code?: string | null }
    let eventRow: EventRow | null = null;
    if (event_id) {
  const { data } = await supabase.from('events').select('id, organizer_id, title, code').eq('id', event_id).single();
      eventRow = data as EventRow | null;
    } else if (event_code) {
      const normalized = event_code.toLowerCase();
  const { data } = await supabase.from('events').select('id, organizer_id, title, code').ilike('code', normalized).single();
      eventRow = data as EventRow | null;
    }
    if (!eventRow) return new Response(JSON.stringify({ error: 'event_not_found' }), { status: 404, headers: { ...cors, 'Content-Type': 'application/json' } });

    // Auth & organizer check
    const userId = getUserIdFromAuth(req);
    if (!userId || !eventRow || (eventRow.organizer_id !== userId)) {
      return new Response('Not authorized (organizer mismatch)', { status: 403, headers: cors });
    }

    const parsed = parseCsv(csv);
    if (!parsed.length) return new Response(JSON.stringify({ inserted: 0, skipped: 0, guests: [] }), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } });

    // Existing emails to avoid duplicates
  const emails = parsed.map(r => r.email).filter((e): e is string => typeof e === 'string' && e.length > 0) as string[];
    let existing: { email: string }[] = [];
    if (emails.length) {
      const { data: ex } = await supabase.from('guests').select('email').in('email', emails).eq('event_id', eventRow.id);
      existing = ex || [];
    }
    const existingSet = new Set(existing.map(e => e.email));

    const rowsToInsert = parsed.filter(r => !r.email || !existingSet.has(r.email)).map(r => ({
      event_id: eventRow.id,
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

    // Send onboarding email to every row that has an email (deduplicated), regardless of inserted/skipped
    const allEmails = Array.from(new Set(parsed.map(r => (r.email || '').trim().toLowerCase()).filter(Boolean)));
    let emailsSent = 0;
    let emailsAttempted = 0;
    let emailsFailed = 0;
    let emailWarning: string | undefined;
    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (!resendKey) {
      emailWarning = 'missing_resend_apikey';
    }
    if (resendKey && allEmails.length) {
      // Basic email template
  const evName = eventRow.title || 'Tu Evento';
  const evCode = eventRow.code || event_code;
      for (const email of allEmails) {
        try {
          emailsAttempted++;
          const subject = `Bienvenido a ${evName}`;
          const html = `
            <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;">
              <h2>¡Hola!</h2>
              <p>Te hemos registrado para el evento <strong>${evName}</strong>.</p>
              <p>Usa este código de evento para ingresar: <strong>${evCode}</strong>.</p>
              <p>En el lugar, tu fotocheck tendrá un número de badge para facilitar el networking.</p>
              <p>¡Nos vemos pronto!</p>
              <hr />
              <small>Si recibiste este correo por error, puedes ignorarlo.</small>
            </div>
          `;
          await sendEmailWithResend(resendKey, { to: email, subject, html });
          emailsSent++;
        } catch (error_) {
          // Swallow individual email errors; could log via supabase.from('logs') in future
          emailsFailed++;
        }
      }
    }

    return new Response(
      JSON.stringify({ inserted: inserted.length, skipped: parsed.length - inserted.length, guests: inserted, emails_sent: emailsSent, emails_attempted: emailsAttempted, emails_failed: emailsFailed, email_warning: emailWarning }),
      { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as any).message }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
});