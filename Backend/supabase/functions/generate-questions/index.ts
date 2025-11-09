// Edge Function: generate-questions
// POST body: { event_id?: string, eventId?: string, event_code?: string, eventCode?: string, room_id?: string, roomId?: string, limit?: number, context?: string }
// If OPENAI_API_KEY available, uses it to enhance questions; else fallback simple generation.
import { getServiceClient } from '../_shared/supabaseClient.ts'
declare const Deno: any

type SB = ReturnType<typeof getServiceClient>

async function buildContextText(supabase: SB, eventId: string, roomId?: string): Promise<string> {
    // Evento (titulo/descripcion si existen)
    const parts: string[] = []
    try {
        const { data: ev } = await supabase
            .from('events')
            .select('id, code, title, name, description, location, starts_at')
            .eq('id', eventId)
            .maybeSingle()
        if (ev) {
            const title = ev.title || ev.name || ev.code || 'Evento'
            parts.push(`Evento: ${title}`)
            if (ev.description) parts.push(`Descripción del evento: ${ev.description}`)
            if (ev.location) parts.push(`Ubicación: ${ev.location}`)
            if (ev.starts_at) parts.push(`Fecha/Hora: ${ev.starts_at}`)
        }
    } catch (err) { console.error('event context error', err) }

    // Sala específica o listado de salas
    try {
        if (roomId) {
            const { data: room } = await supabase
                .from('rooms')
                .select('id, name, topic, conversation_topics, participants')
                .eq('id', roomId)
                .maybeSingle()
            if (room) {
                parts.push(`Sala: ${room.name || room.id}`)
                if (room.topic) parts.push(`Tema principal de la sala: ${room.topic}`)
                const topics = Array.isArray(room.conversation_topics) ? room.conversation_topics : []
                if (topics.length) parts.push(`Puntos de discusión de la sala: ${topics.join(', ')}`)
                const participants = Array.isArray(room.participants) ? room.participants : []
                if (participants.length) parts.push(`Participantes (nombres si disponibles): ${participants.join(', ')}`)
            }
        } else {
            const { data: rooms } = await supabase
                .from('rooms')
                .select('name, topic')
                .eq('event_id', eventId)
                .limit(10)
            if (rooms && rooms.length) {
                const summary = rooms
                    .map((r: { name?: string; topic?: string }) => `${r.name || 'Sala'}: ${r.topic || 'General'}`)
                    .join(' | ')
                parts.push(`Salas formadas: ${summary}`)
            }
        }
    } catch (err) { console.error('event context error', err) }

    // Intereses comunes de los asistentes (si existe la columna interests)
    try {
        const { data: guests } = await supabase
            .from('guests')
            .select('interests')
            .eq('event_id', eventId)
            .limit(200)
        const freq = new Map<string, number>()
        for (const g of guests || []) {
            let arr: string[] = []
            if (Array.isArray(g.interests)) {
                arr = (g.interests as unknown[]).filter((x): x is string => typeof x === 'string')
            } else if (typeof g.interests === 'string') {
                arr = (g.interests as string).split(',').map(s => s.trim())
            }
            for (const it of arr) {
                if (!it) continue
                freq.set(it, (freq.get(it) || 0) + 1)
            }
        }
        const common = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k]) => k)
        if (common.length) parts.push(`Intereses más comunes entre asistentes: ${common.join(', ')}`)
    } catch (err) { console.error('event context error', err) }

    return parts.join('\n')
}

async function openaiGenerate(contextText: string, limit: number): Promise<string[]> {
    const apiKey = Deno.env.get('OPENAI_API_KEY')
    const model = Deno.env.get('OPENAI_MODEL') || 'gpt-4o-mini'
    if (!apiKey) throw new Error('Missing OPENAI_API_KEY')

    const system = `Eres un generador de preguntas experto para networking de eventos.
Produce exactamente ${limit} preguntas claras y abiertas para iniciar conversación.
Usa el mismo idioma predominante del contexto. Varía categorías y enfoques.
Devuelve exclusivamente JSON: [{"question": string, "category": string}] sin texto adicional.`

    const user = `Contexto:
${contextText}

Instrucciones:
- Genera ${limit} preguntas distintas, útiles y accionables.
- Categoriza cada pregunta (por ejemplo: "Intereses Comunes", "Tema de Sala", "Experiencia", "Opinión").
- Evita duplicados; no repitas estructuras.
- No incluyas números de orden ni emojis en el JSON.`

    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model,
            temperature: 0.7,
            messages: [
                { role: 'system', content: system },
                { role: 'user', content: user }
            ]
        })
    })
    if (!resp.ok) {
        const t = await resp.text().catch(() => '')
        throw new Error(`OpenAI error: ${resp.status} ${t}`)
    }
    const data = await resp.json()
    const content: string = data?.choices?.[0]?.message?.content || ''
    // Intentar extraer JSON
    const jsonMatch = content.match(/\[[\s\S]*\]/)
    const raw = jsonMatch ? jsonMatch[0] : content
    const arr = JSON.parse(raw)
    if (!Array.isArray(arr)) throw new Error('Invalid JSON from OpenAI')
    const qs: string[] = []
    for (const item of arr) {
        if (typeof item?.question === 'string') qs.push(item.question)
    }
    // Si el modelo no devolvió suficientes, recortamos o completamos luego
    return qs.slice(0, limit)
}

async function simpleGenerate(baseText: string, limit: number): Promise<string[]> {
    const raw = baseText.split(/(?<=[.?!])\s+/).filter(s => s.length > 20)
    const qs: string[] = []
    for (let i = 0; i < raw.length && qs.length < limit; i++) {
        qs.push(`¿Podrías profundizar en: ${raw[i].slice(0, 80)}?`)
    }
    while (qs.length < limit) qs.push('¿Cuál es el punto más importante hasta ahora?')
    return qs
}

Deno.serve(async (req: Request) => {
    const cors = {
        // Allow local dev and general usage. If you prefer to restrict, replace * with your origin.
        'Access-Control-Allow-Origin': '*',
        // Supabase-js sends these headers; include them to satisfy preflight.
        'Access-Control-Allow-Headers': 'content-type, authorization, apikey, x-client-info, x-supabase-authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        // Explicitly allow credentials off by default (no cookies). Toggle to 'true' if needed.
        'Access-Control-Allow-Credentials': 'false'
    } as Record<string, string>
    if (req.method === 'OPTIONS') return new Response('', { status: 204, headers: cors })
    if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: cors })
    const body = await req.json()
    const event_id = body.event_id || body.eventId
    const event_code = body.event_code || body.eventCode
    const room_id = body.room_id || body.roomId
    const limit = (typeof body.limit === 'number' && body.limit > 0) ? body.limit : 5
    const providedContext: string | undefined = body.context

    const supabase = getServiceClient()
    let eid = event_id
    if (!eid && event_code) {
        const { data: ev } = await supabase.from('events').select('id').eq('code', event_code).single()
        eid = ev?.id
    }
    if (!eid) return new Response('Missing event reference', { status: 400, headers: cors })

    // Acquire transcript context if none provided
    let baseText = providedContext
    if (!baseText) {
        const { data: talks } = await supabase
            .from('talks')
            .select('transcript')
            .eq('event_id', eid)
            .order('created_at', { ascending: false })
            .limit(1)
        baseText = talks?.[0]?.transcript || 'No hay transcripción todavía.'
    }

    // Build enriched context using event, rooms and common interests
    const enriched = await buildContextText(supabase, eid, room_id)
    const fullContext = [baseText, enriched].filter(Boolean).join('\n---\n') || 'Sin contexto.'

    // Try OpenAI first if key is present
    let source: 'openai' | 'simple' | 'ad-hoc' = providedContext ? 'ad-hoc' : 'simple'
    let questions: string[]
    try {
        if (Deno.env.get('OPENAI_API_KEY')) {
            questions = await openaiGenerate(fullContext, limit)
            source = 'openai'
            // If OpenAI returns empty, fallback below
            if (!questions.length) throw new Error('OpenAI returned no questions')
        } else {
            throw new Error('OPENAI_API_KEY not set')
        }
    } catch (err) {
        console.error('event context error', err)
        const safeText = fullContext || 'Sin contexto.'
        questions = await simpleGenerate(safeText, limit)
        // keep source from earlier (ad-hoc/simple)
    }

    const inserts = questions.map(q => ({ event_id: eid, room_id, content: q, context: { source } }))
    const { data, error } = await supabase.from('questions').insert(inserts).select('*')
    if (error) return new Response(error.message, { status: 500, headers: cors })
    return new Response(JSON.stringify({ questions: data }), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } })
})
