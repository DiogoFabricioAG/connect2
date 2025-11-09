// Edge Function: speak-text (ElevenLabs TTS)
// POST body: { text: string, voice_id?: string, model_id?: string, optimize_streaming_latency?: number }
// Returns: { audio_base64: string, mime: string } or { url } if later stored in storage

Deno.serve(async (req) => {
    try {
        if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })
        const { text, voice_id, model_id, optimize_streaming_latency } = await req.json()
        if (!text || typeof text !== 'string') return new Response('Missing text', { status: 400 })

        const apiKey = Deno.env.get('ELEVENLABS_API_KEY')
        const defaultVoice = Deno.env.get('ELEVENLABS_VOICE_ID') || '21m00Tcm4TlvDq8ikWAM'
        if (!apiKey) return new Response('Missing ELEVENLABS_API_KEY', { status: 500 })

        const vid = voice_id || defaultVoice
        const url = `https://api.elevenlabs.io/v1/text-to-speech/${vid}`

        const payload = {
            text,
            model_id: model_id || 'eleven_multilingual_v2',
            optimize_streaming_latency: optimize_streaming_latency ?? 0,
            voice_settings: { stability: 0.5, similarity_boost: 0.8 }
        }

        const resp = await fetch(url, {
            method: 'POST',
            headers: {
                'xi-api-key': apiKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        })

        if (!resp.ok) {
            const errTxt = await resp.text()
            return new Response(`ElevenLabs error: ${resp.status} ${errTxt}`, { status: 502 })
        }

        const buf = new Uint8Array(await resp.arrayBuffer())
        const b64 = btoa(String.fromCharCode(...buf))
        return new Response(JSON.stringify({ audio_base64: b64, mime: 'audio/mpeg' }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    } catch (err) {
        return new Response(JSON.stringify({ error: (err as any).message }), { status: 500 })
    }
})
