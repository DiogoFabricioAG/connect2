// Edge Function: transcribe-talk (ElevenLabs STT)
// POST body: { event_id?: string, event_code?: string, speaker?: string, audio_url?: string }
// If ELEVENLABS_API_KEY is present and audio_url provided, transcribes using ElevenLabs; otherwise guarda placeholder.
import { getServiceClient } from '../_shared/supabaseClient.ts'

async function transcribeWithElevenLabs(audioUrl: string, apiKey: string): Promise<string> {
    const sttUrl = Deno.env.get('ELEVENLABS_STT_URL') || 'https://api.elevenlabs.io/v1/speech-to-text'
    const modelId = Deno.env.get('ELEVENLABS_STT_MODEL_ID') || 'whisper-large-v3'

    const audioResp = await fetch(audioUrl)
    if (!audioResp.ok) throw new Error(`No se pudo descargar el audio: ${audioResp.status}`)
    const contentType = audioResp.headers.get('content-type') ?? 'audio/mpeg'
    const buf = await audioResp.arrayBuffer()

    // Construir multipart/form-data
    const form = new FormData()
    form.append('file', new Blob([buf], { type: contentType }), 'audio')
    form.append('model_id', modelId)

    const resp = await fetch(sttUrl, {
        method: 'POST',
        headers: {
            'xi-api-key': apiKey
            // NOTA: no fijar Content-Type manualmente para mantener el boundary de FormData
        },
        body: form
    })
    if (!resp.ok) {
        const txt = await resp.text()
        throw new Error(`ElevenLabs STT error: ${resp.status} ${txt}`)
    }
    const data = await resp.json()
    // Intentar varias formas comunes de campo de texto
    const transcript = data?.text || data?.transcription || data?.data?.text
    if (!transcript || typeof transcript !== 'string') {
        throw new Error('Respuesta STT sin campo de texto reconocible')
    }
    return transcript
}

Deno.serve(async (req) => {
    if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })
    const { event_id, event_code, speaker, audio_url } = await req.json()
    const supabase = getServiceClient()

    let eid = event_id
    if (!eid && event_code) {
        const { data: ev } = await supabase.from('events').select('id').eq('code', event_code).single()
        eid = ev?.id
    }
    if (!eid) return new Response('Missing event reference', { status: 400 })

    const elKey = Deno.env.get('ELEVENLABS_API_KEY')
    let transcript = 'Transcripción no disponible.'

    if (elKey && audio_url) {
        try {
            transcript = await transcribeWithElevenLabs(audio_url, elKey)
        } catch (err) {
            console.error('Fallo STT ElevenLabs:', err)
        }
    }

    const { data, error } = await supabase
        .from('talks')
        .insert({ event_id: eid, speaker, source_audio_url: audio_url, transcript })
        .select('*')
        .single()
    if (error) return new Response(error.message, { status: 500 })
    return new Response(JSON.stringify({ talk: data }), { status: 200 })
})
