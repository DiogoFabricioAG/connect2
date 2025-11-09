// Edge Function: create-event
// Creates an event with optional guests list and preferences
// POST body: { title: string, description?: string, preferences?: object, guests?: [{full_name:string,email?:string}] }
import { getServiceClient } from '../_shared/supabaseClient.ts'

Deno.serve(async (req) => {
    try {
        if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })
        const body = await req.json()
        const { title, description, preferences, guests } = body
        if (!title) return new Response('Missing title', { status: 400 })
        const supabase = getServiceClient()

        const { data: event, error: e1 } = await supabase
            .from('events')
            .insert({ title, description, preferences })
            .select('*')
            .single()
        if (e1) throw e1

        if (Array.isArray(guests) && guests.length) {
            const rows = guests.map((g: any) => ({ event_id: event.id, full_name: g.full_name, email: g.email }))
            const { error: e2 } = await supabase.from('guests').insert(rows)
            if (e2) throw e2
        }

        return new Response(JSON.stringify({ event }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    } catch (err) {
        return new Response(JSON.stringify({ error: (err as any).message }), { status: 500 })
    }
})
