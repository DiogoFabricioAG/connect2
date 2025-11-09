// Edge Function: generate-rooms
// POST body: { event_id?: string, eventId?: string, event_code?: string, eventCode?: string, count?: number, prefix?: string }
// If count omitted defaults to 5. Adds basic CORS.
import { getServiceClient } from '../_shared/supabaseClient.ts'

Deno.serve(async (req: Request) => {
    const cors = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    }
    if (req.method === 'OPTIONS') return new Response('', { status: 204, headers: cors })
    if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: cors })
    const body = await req.json()
    const event_id = body.event_id || body.eventId
    const event_code = body.event_code || body.eventCode
    const count = body.count && body.count > 0 ? body.count : 5
    const prefix = body.prefix
    const supabase = getServiceClient()

    let eid = event_id
    if (!eid && event_code) {
        const { data: ev } = await supabase.from('events').select('id').eq('code', event_code).single()
        eid = ev?.id
    }
    if (!eid) return new Response('Missing event reference', { status: 400, headers: cors })

    const names = Array.from({ length: count }, (_, i) => `${prefix ?? 'Sala'} ${i + 1}`)
    const rows = names.map((name) => ({ event_id: eid, name }))
    const { data, error } = await supabase.from('rooms').insert(rows).select('*')
    if (error) return new Response(error.message, { status: 500, headers: cors })
    return new Response(JSON.stringify({ rooms: data }), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } })
})
