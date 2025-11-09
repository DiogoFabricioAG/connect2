// Edge Function: create-virtual-person
// POST body: { event_id?: string, event_code?: string, display_name: string, persona_profile?: object }
import { getServiceClient } from '../_shared/supabaseClient.ts'

Deno.serve(async (req) => {
    if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })
    const { event_id, event_code, display_name, persona_profile } = await req.json()
    if (!display_name) return new Response('Missing display_name', { status: 400 })
    const supabase = getServiceClient()
    let eid = event_id
    if (!eid && event_code) {
        const { data: ev } = await supabase.from('events').select('id').eq('code', event_code).single()
        eid = ev?.id
    }
    if (!eid) return new Response('Missing event reference', { status: 400 })

    const { data, error } = await supabase
        .from('virtual_people')
        .insert({ event_id: eid, display_name, persona_profile })
        .select('*')
        .single()
    if (error) return new Response(error.message, { status: 500 })
    return new Response(JSON.stringify({ virtual_person: data }), { status: 200 })
})
