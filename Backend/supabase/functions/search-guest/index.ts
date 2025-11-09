// Edge Function: search-guest
// POST body: { event_code?: string, eventCode?: string, event_id?: string, eventId?: string, number?: number, badgeNumber?: number, searchNumber?: string|number, markFound?: boolean }
import { getServiceClient } from '../_shared/supabaseClient.ts'

Deno.serve(async (req: Request) => {
    const cors = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, Authorization, apikey, Apikey, x-client-info, X-Client-Info, content-type, Content-Type, accept, Accept',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    }
    if (req.method === 'OPTIONS') {
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...cors, 'Access-Control-Max-Age': '86400', 'Content-Type': 'application/json' } })
    }
    if (req.method === 'GET') return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } })
    if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: cors })
    const body = await req.json()
    const event_code = body.event_code || body.eventCode
    const event_id = body.event_id || body.eventId
    let number: number | undefined = body.number ?? body.badgeNumber
    if (number === undefined && body.searchNumber !== undefined) {
        const n = typeof body.searchNumber === 'string' ? Number.parseInt(body.searchNumber, 10) : body.searchNumber
        if (!Number.isNaN(n)) number = n
    }
    const markFound: boolean = !!body.markFound
    const supabase = getServiceClient()

    let eid = event_id
    if (!eid && event_code) {
        const { data: ev } = await supabase.from('events').select('id').eq('code', event_code).single()
        eid = ev?.id
    }
    if (!eid || typeof number !== 'number') return new Response('Missing event and number', { status: 400, headers: cors })

    const { data: guest, error } = await supabase
        .from('guests')
        .select('*')
        .eq('event_id', eid)
        .eq('badge_number', number)
        .maybeSingle()

    if (error) return new Response(error.message, { status: 500, headers: cors })
    if (!guest) return new Response(JSON.stringify({ found: false }), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } })

    let resultGuest = guest
    // Si existe partner_id en metadata, devolver la contraparte como resultado principal
    try {
        const partnerId = (guest?.metadata && typeof guest.metadata === 'object') ? (guest.metadata as any).partner_id : undefined
        if (partnerId) {
            const { data: partner } = await supabase.from('guests').select('*').eq('id', partnerId).maybeSingle()
            if (partner) {
                resultGuest = partner
            }
        }
    } catch { /* ignore */ }

    if (markFound) {
        await supabase.from('guests').update({ found: true }).eq('id', guest.id)
    }

    return new Response(JSON.stringify({ found: true, guest: resultGuest }), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } })
})
