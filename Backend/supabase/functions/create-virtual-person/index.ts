// Edge Function: create-virtual-person
// POST body: { event_id?: string, eventId?: string, event_code?: string, eventCode?: string, display_name?: string, name?: string, persona_profile?: object }
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
    const display_name = body.display_name || body.name
    const persona_profile = body.persona_profile
    if (!display_name) return new Response('Missing display_name', { status: 400, headers: cors })
    const supabase = getServiceClient()
    let eid = event_id
    if (!eid && event_code) {
        const { data: ev } = await supabase.from('events').select('id').eq('code', event_code).single()
        eid = ev?.id
    }
    if (!eid) return new Response('Missing event reference', { status: 400, headers: cors })

    const { data, error } = await supabase
        .from('virtual_people')
        .insert({ event_id: eid, display_name, persona_profile })
        .select('*')
        .single()
    if (error) return new Response(error.message, { status: 500, headers: cors })
    return new Response(JSON.stringify({ virtual_person: data }), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } })
})
