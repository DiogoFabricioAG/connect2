// Edge Function: generate-rooms
// POST body: { event_id?: string, event_code?: string, count: number, prefix?: string }
import { getServiceClient } from '../_shared/supabaseClient.ts'

Deno.serve(async (req) => {
    if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })
    const { event_id, event_code, count, prefix } = await req.json()
    const supabase = getServiceClient()
    if (!count || count < 1) return new Response('count must be >= 1', { status: 400 })

    let eid = event_id
    if (!eid && event_code) {
        const { data: ev } = await supabase.from('events').select('id').eq('code', event_code).single()
        eid = ev?.id
    }
    if (!eid) return new Response('Missing event reference', { status: 400 })

    const names = Array.from({ length: count }, (_, i) => `${prefix ?? 'Sala'} ${i + 1}`)
    const rows = names.map((name) => ({ event_id: eid, name }))
    const { data, error } = await supabase.from('rooms').insert(rows).select('*')
    if (error) return new Response(error.message, { status: 500 })
    return new Response(JSON.stringify({ rooms: data }), { status: 200 })
})
