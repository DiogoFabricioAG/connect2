// Edge Function: speak-text (ElevenLabs TTS)
// POST body: { text: string, voice_id?: string, model_id?: string, optimize_streaming_latency?: number }
// Returns: { audio_base64: string, mime: string } or { url } if later stored in storage

// @ts-ignore - Deno global available in Edge runtime
declare const Deno: any;
Deno.serve(async (req: Request) => {
    try {
        const cors = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'authorization, Authorization, apikey, Apikey, x-client-info, X-Client-Info, content-type, Content-Type, accept, Accept',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
        }
        if (req.method === 'OPTIONS') return new Response('', { status: 204, headers: cors })
        if (req.method === 'GET') return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } })
        if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: cors })
        const { text, voice_id, model_id, optimize_streaming_latency } = await req.json()
        if (!text || typeof text !== 'string') return new Response('Missing text', { status: 400, headers: cors })

        // @ts-ignore Deno provided in edge runtime
        const apiKey = Deno.env.get('ELEVENLABS_API_KEY')
        // @ts-ignore
        const defaultVoice = Deno.env.get('ELEVENLABS_VOICE_ID') || '21m00Tcm4TlvDq8ikWAM'
        if (!apiKey) return new Response('Missing ELEVENLABS_API_KEY', { status: 500, headers: cors })

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
            return new Response(`ElevenLabs error: ${resp.status} ${errTxt}`, { status: 502, headers: cors })
        }

        const buf = new Uint8Array(await resp.arrayBuffer())
    // Use fromCodePoint for linter preference
    const b64 = btoa(Array.from(buf).map(b => String.fromCodePoint(b)).join(''))
        return new Response(JSON.stringify({ audio_base64: b64, mime: 'audio/mpeg' }), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } })
    } catch (err) {
        const cors = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'authorization, Authorization, apikey, Apikey, x-client-info, X-Client-Info, content-type, Content-Type, accept, Accept',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
        }
        return new Response(JSON.stringify({ error: (err as any).message }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } })
    }
})
