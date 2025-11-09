// Edge Function: update-guest-profile
// POST body: { event_code: string, email: string, full_name?: string, motivations?: string, goals?: string, expectations?: string, interests?: string|string[] }
// If guest exists (by event_id+email) update metadata merging provided fields; else create guest row.
// Returns { guest }
import { getServiceClient } from '../_shared/supabaseClient.ts'
// @ts-ignore
declare const Deno: any;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, Authorization, apikey, Apikey, x-client-info, X-Client-Info, content-type, Content-Type, accept, Accept',
  'Access-Control-Allow-Methods': 'POST, OPTIONS, GET'
};

function normalizeInterests(raw: unknown): string[] | undefined {
  if (!raw) return undefined;
  if (Array.isArray(raw)) return raw.filter((v): v is string => typeof v === 'string').map(s => s.trim()).filter(Boolean);
  if (typeof raw === 'string') {
    return raw.split(/[,;]\s*/).map(s => s.trim()).filter(Boolean);
  }
  return undefined;
}

function buildAdditions(body: any): { additions: Record<string, unknown>; interests?: string[] } {
  const interests = normalizeInterests(body.interests);
  const additions: Record<string, unknown> = {};
  if (body.motivations) additions.motivations = body.motivations;
  if (body.goals) additions.goals = body.goals;
  if (body.expectations) additions.expectations = body.expectations;
  if (interests) additions.interests = interests;
  return { additions, interests };
}

async function getEventId(supabase: any, code: string): Promise<string | undefined> {
  const { data: ev } = await supabase.from('events').select('id').eq('code', code).maybeSingle();
  return ev?.id as string | undefined;
}

async function upsertGuest(supabase: any, payload: { event_id: string; email: string; full_name?: string; additions: Record<string, unknown>; interests?: string[] }) {
  const { data: existing } = await supabase.from('guests').select('*').eq('event_id', payload.event_id).eq('email', payload.email).maybeSingle();
  if (existing) {
  const baseMeta = existing.metadata ? existing.metadata : {};
  const mergedMeta = { ...baseMeta, ...payload.additions };
    const updatePayload: Record<string, unknown> = { metadata: mergedMeta, updated_at: new Date().toISOString() };
    if (payload.interests) updatePayload.interests = payload.interests;
    if (payload.full_name) updatePayload.full_name = payload.full_name;
    const { data: updated, error } = await supabase.from('guests').update(updatePayload).eq('id', existing.id).select('*').single();
    if (error) throw new Error(error.message);
    return updated;
  }
  const insertPayload: Record<string, unknown> = {
    event_id: payload.event_id,
    email: payload.email,
    full_name: payload.full_name || null,
    metadata: payload.additions,
    interests: payload.interests || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  const { data: inserted, error } = await supabase.from('guests').insert(insertPayload).select('*').single();
  if (error) throw new Error(error.message);
  return inserted;
}

async function handlePost(req: Request): Promise<Response> {
  const body = await req.json();
  const event_code: string | undefined = body.event_code || body.eventCode;
  const email: string | undefined = body.email;
  if (!event_code) return new Response('Missing event_code', { status: 400, headers: cors });
  if (!email) return new Response('Missing email', { status: 400, headers: cors });

  const supabase = getServiceClient();
  const eventId = await getEventId(supabase, event_code);
  if (!eventId) return new Response('Event not found', { status: 404, headers: cors });

  const { additions, interests } = buildAdditions(body);
  const guest = await upsertGuest(supabase, { event_id: eventId, email, full_name: body.full_name, additions, interests });
  return new Response(JSON.stringify({ guest }), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('', { status: 204, headers: cors });
  if (req.method === 'GET') return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } });
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: cors });
  try {
    return await handlePost(req);
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as any).message }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
});