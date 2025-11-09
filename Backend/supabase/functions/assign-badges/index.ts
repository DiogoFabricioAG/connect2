// Edge Function: assign-badges
// POST body: { event_id?: string, eventId?: string }
// Assigns sequential badge numbers to guests without a badge for the event
import { getServiceClient } from '../_shared/supabaseClient.ts'

Deno.serve(async (req) => {
    const cors = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, Authorization, apikey, Apikey, x-client-info, X-Client-Info, content-type, Content-Type, accept, Accept',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    }
    // Preflight with 200 JSON and cache
    if (req.method === 'OPTIONS') {
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...cors, 'Access-Control-Max-Age': '86400', 'Content-Type': 'application/json' } })
    }
    // Healthcheck
    if (req.method === 'GET') return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } })
    if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: cors })

    const body = await req.json()
    const event_id = body.event_id || body.eventId
    if (!event_id) return new Response('Missing event_id', { status: 400, headers: cors })
    const supabase = getServiceClient()

    const { data: guests, error: e1 } = await supabase
        .from('guests')
        .select('*')
        .eq('event_id', event_id)
        .is('badge_number', null)
    if (e1) return new Response(e1.message, { status: 500, headers: cors })

    // Get current max badge
    const { data: existing, error: e2 } = await supabase
        .from('guests')
        .select('badge_number')
        .eq('event_id', event_id)
        .not('badge_number', 'is', null)
        .order('badge_number', { ascending: false })
        .limit(1)
    if (e2) return new Response(e2.message, { status: 500, headers: cors })
    let start = existing?.[0]?.badge_number || 0

    const updates = guests.map((g: any) => ({ id: g.id, badge_number: ++start }))
    for (const u of updates) {
        await supabase.from('guests').update({ badge_number: u.badge_number }).eq('id', u.id)
    }
    return new Response(JSON.stringify({ assigned: updates.length }), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } })
})
