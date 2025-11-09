// Edge Function: create-event
// Creates an event with optional guests list and preferences
// POST body: { title: string, description?: string, preferences?: object, guests?: [{full_name:string,email?:string}] }
import { getServiceClient } from '../_shared/supabaseClient.ts'
// @ts-ignore - Deno is provided in the Edge runtime
declare const Deno: any;

// Basic CORS headers for browser invocation
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};

Deno.serve(async (req: Request): Promise<Response> => {
    try {
        if (req.method === 'OPTIONS') {
            return new Response('ok', { headers: corsHeaders });
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

        // Insert event. Code may be null; trigger will auto-generate. Status defaults to draft if not provided.
        const insertPayload: Record<string, unknown> = { title, description, preferences: preferences || {}, status: status || 'draft' };
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
