// Edge Function: search-guest
// POST body: { event_code?: string, event_id?: string, number: number, markFound?: boolean }
import { getServiceClient } from '../_shared/supabaseClient.ts'

Deno.serve(async (req) => {
    if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })
    const { event_code, event_id, number, markFound } = await req.json()
    const supabase = getServiceClient()

    let eid = event_id
    if (!eid && event_code) {
        const { data: ev } = await supabase.from('events').select('id').eq('code', event_code).single()
        eid = ev?.id
    }
    if (!eid || typeof number !== 'number') return new Response('Missing event and number', { status: 400 })

    const { data: guest, error } = await supabase
        .from('guests')
        .select('*')
        .eq('event_id', eid)
        .eq('badge_number', number)
        .maybeSingle()

    if (error) return new Response(error.message, { status: 500 })
    if (!guest) return new Response(JSON.stringify({ found: false }), { status: 200 })

    if (markFound) {
        await supabase.from('guests').update({ found: true }).eq('id', guest.id)
    }

    return new Response(JSON.stringify({ found: true, guest }), { status: 200 })
})
