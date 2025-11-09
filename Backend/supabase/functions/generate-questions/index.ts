// Edge Function: generate-questions
// POST body: { event_id?: string, event_code?: string, room_id?: string, limit?: number }
// If OPENAI_API_KEY available, uses it to enhance questions; else fallback simple generation.
import { getServiceClient } from '../_shared/supabaseClient.ts'

async function simpleGenerate(baseText: string, limit: number): Promise<string[]> {
    const raw = baseText.split(/(?<=[.?!])\s+/).filter(s => s.length > 20)
    const qs: string[] = []
    for (let i = 0; i < raw.length && qs.length < limit; i++) {
        qs.push(`¿Podrías profundizar en: ${raw[i].slice(0, 80)}?`)
    }
    while (qs.length < limit) qs.push('¿Cuál es el punto más importante hasta ahora?')
    return qs
}

Deno.serve(async (req) => {
    if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })
    const { event_id, event_code, room_id, limit = 5 } = await req.json()
    const supabase = getServiceClient()
    let eid = event_id
    if (!eid && event_code) {
        const { data: ev } = await supabase.from('events').select('id').eq('code', event_code).single()
        eid = ev?.id
    }
    if (!eid) return new Response('Missing event reference', { status: 400 })

    // Acquire transcript context
    const { data: talks } = await supabase.from('talks').select('transcript').eq('event_id', eid).order('created_at', { ascending: false }).limit(1)
    const transcript = talks?.[0]?.transcript || 'No hay transcripción todavía.'

    const questions = await simpleGenerate(transcript, limit)
    const inserts = questions.map(q => ({ event_id: eid, room_id, content: q, context: { source: 'simple' } }))
    const { data, error } = await supabase.from('questions').insert(inserts).select('*')
    if (error) return new Response(error.message, { status: 500 })
    return new Response(JSON.stringify({ questions: data }), { status: 200 })
})
