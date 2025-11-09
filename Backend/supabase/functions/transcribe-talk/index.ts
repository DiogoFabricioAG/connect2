// Edge Function: transcribe-talk (ElevenLabs STT)
// POST body: { event_id?: string, eventId?: string, event_code?: string, eventCode?: string, speaker?: string, audio_url?: string, audio_base64?: string, content_type?: string }
// Si ELEVENLABS_API_KEY está presente, transcribe con ElevenLabs. Soporta audio_url o audio_base64.
import { getServiceClient } from '../_shared/supabaseClient.ts'

async function sttFromBlob(blob: Blob, apiKey: string): Promise<string> {
    const sttUrl = Deno.env.get('ELEVENLABS_STT_URL') || 'https://api.elevenlabs.io/v1/speech-to-text'
    const modelId = Deno.env.get('ELEVENLABS_STT_MODEL_ID') || 'whisper-large-v3'
    const form = new FormData()
    form.append('file', blob, 'audio')
    form.append('model_id', modelId)
    const resp = await fetch(sttUrl, {
        method: 'POST',
        headers: { 'xi-api-key': apiKey },
        body: form
    })
    if (!resp.ok) {
        const txt = await resp.text()
        throw new Error(`ElevenLabs STT error: ${resp.status} ${txt}`)
    }
    const data = await resp.json()
    const transcript = data?.text || data?.transcription || data?.data?.text
    if (!transcript || typeof transcript !== 'string') throw new Error('Respuesta STT sin texto')
    return transcript
}

Deno.serve(async (req: Request) => {
    const cors = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    }
    if (req.method === 'OPTIONS') return new Response('', { status: 204, headers: cors })
    if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: cors })
    const { event_id, eventId, event_code, eventCode, speaker, audio_url, audio_base64, content_type } = await req.json()
    const supabase = getServiceClient()

    let eid = event_id || eventId
    const code = event_code || eventCode
    if (!eid && code) {
        const { data: ev } = await supabase.from('events').select('id').eq('code', code).single()
        eid = ev?.id
    }
    if (!eid) return new Response('Missing event reference', { status: 400, headers: cors })

    const elKey = Deno.env.get('ELEVENLABS_API_KEY')
    let transcript = 'Transcripción no disponible.'

    if (elKey && (audio_url || audio_base64)) {
        try {
            if (audio_url) {
                const audioResp = await fetch(audio_url)
                if (!audioResp.ok) throw new Error(`No se pudo descargar el audio: ${audioResp.status}`)
                const ct = audioResp.headers.get('content-type') ?? 'audio/mpeg'
                const buf = await audioResp.arrayBuffer()
                transcript = await sttFromBlob(new Blob([buf], { type: ct }), elKey)
            } else if (audio_base64) {
                const bytes = Uint8Array.from(atob(audio_base64), c => c.charCodeAt(0))
                const ct = content_type || 'audio/mpeg'
                transcript = await sttFromBlob(new Blob([bytes], { type: ct }), elKey)
            }
        } catch (err) {
            console.error('Fallo STT ElevenLabs:', err)
        }
    }

    const { data, error } = await supabase
        .from('talks')
        .insert({ event_id: eid, speaker, source_audio_url: audio_url, transcript })
        .select('*')
        .single()
    if (error) return new Response(error.message, { status: 500, headers: cors })
    return new Response(JSON.stringify({ talk: data }), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } })
})
