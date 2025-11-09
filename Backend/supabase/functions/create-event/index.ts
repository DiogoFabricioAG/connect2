// Edge Function: create-event
// Creates an event with optional guests list and preferences
// POST body: { title: string, description?: string, preferences?: object, guests?: [{full_name:string,email?:string}] }
import { getServiceClient } from '../_shared/supabaseClient.ts'
// @ts-ignore - Deno is provided in the Edge runtime
declare const Deno: any;

// Basic CORS headers for browser invocation
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, Authorization, apikey, Apikey, x-client-info, X-Client-Info, content-type, Content-Type, accept, Accept',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};

Deno.serve(async (req: Request): Promise<Response> => {
    try {
            if (req.method === 'OPTIONS') {
                return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders, 'Access-Control-Max-Age': '86400', 'Content-Type': 'application/json' } });
            }
            if (req.method === 'GET') {
                return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }
            if (req.method !== 'POST') {
            return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
        }

        const body = await req.json();
        const { title, description, preferences, guests, status, code } = body;
        if (!title) {
            return new Response(JSON.stringify({ error: 'Missing title' }), { status: 400, headers: corsHeaders });
        }

        const supabase = getServiceClient();

        // Try to extract organizer user id from Authorization header (Bearer access token)
        let organizerId: string | undefined;
        try {
            const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
            if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
                const accessToken = authHeader.substring(7).trim();
                // Minimal validation: decode JWT payload (base64url) to read 'sub'
                const parts = accessToken.split('.');
                if (parts.length === 3) {
                    const payloadJson = atob(parts[1].replaceAll('-', '+').replaceAll('_', '/'));
                    const payload = JSON.parse(payloadJson);
                    if (typeof payload.sub === 'string') organizerId = payload.sub;
                }
            }
        } catch (error_) {
            console.warn('[create-event] Unable to read organizer from token:', error_);
        }

        // Insert event. Code may be null; trigger may auto-generate. Status defaults to draft if not provided.
        const insertPayload: Record<string, unknown> = {
            title,
            description: description ?? null,
            preferences: preferences || {},
            status: status || 'draft',
            organizer_id: organizerId || null
        };
        if (code) insertPayload.code = code; // allow custom code if provided

        const { data: event, error: e1 } = await supabase
            .from('events')
            .insert(insertPayload)
            .select('*')
            .single();
        if (e1) throw e1;

        if (Array.isArray(guests) && guests.length) {
            const rows = guests.map((g: any) => ({ event_id: event.id, full_name: g.full_name, email: g.email }));
            const { error: e2 } = await supabase.from('guests').insert(rows);
            if (e2) throw e2;
        }

        return new Response(JSON.stringify({ event }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    } catch (err) {
        return new Response(JSON.stringify({ error: (err as any).message }), { status: 500, headers: corsHeaders });
    }
});
