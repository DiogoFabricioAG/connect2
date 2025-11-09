// Edge Function: notify-guest
// POST body: { event_code?: string, event_id?: string, email: string, full_name?: string, extra?: object }
// Behavior:
//  - If guest with email exists for event: updates metadata (merge) and sends "Actualiza tus datos" email.
//  - Else: creates guest (with provided full_name) and sends "Regístrate" email.
// Requires RESEND_API_KEY. Uses Resend simple send endpoint.

import { getServiceClient } from '../_shared/supabaseClient.ts'

interface ResendEmailOptions {
  to: string
  subject: string
  html: string
}

async function sendEmail(apiKey: string, opts: ResendEmailOptions) {
  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: 'Connect2 <no-reply@connect2.app>',
      to: [opts.to],
      subject: opts.subject,
      html: opts.html
    })
  })
  if (!resp.ok) {
    const txt = await resp.text()
    throw new Error(`Resend error: ${resp.status} ${txt}`)
  }
}

Deno.serve(async (req: Request) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  }
  if (req.method === 'OPTIONS') {
    return new Response('', { status: 204, headers: corsHeaders })
  }
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: corsHeaders })
  try {
    const { event_code, event_id, email, full_name, extra } = await req.json()
    if (!email) return new Response('Missing email', { status: 400, headers: corsHeaders })
    const supabase = getServiceClient()

    let eid = event_id
    if (!eid && event_code) {
      const { data: ev } = await supabase.from('events').select('id').eq('code', event_code).single()
      eid = ev?.id
    }
    if (!eid) return new Response('Missing event reference', { status: 400, headers: corsHeaders })

    // Look for existing guest
    const { data: existing } = await supabase
      .from('guests')
      .select('*')
      .eq('event_id', eid)
      .eq('email', email)
      .maybeSingle()

    const resendKey = Deno.env.get('RESEND_API_KEY')
    if (!resendKey) return new Response('Missing RESEND_API_KEY', { status: 500, headers: corsHeaders })

    let mode: 'create' | 'update'
    let guest
    if (existing) {
      mode = 'update'
      const mergedMeta = { ...(existing.metadata || {}), ...(extra || {}) }
      const { data: upd, error: e2 } = await supabase
        .from('guests')
        .update({ metadata: mergedMeta })
        .eq('id', existing.id)
        .select('*')
        .single()
      if (e2) throw e2
      guest = upd

      await sendEmail(resendKey, {
        to: email,
        subject: 'Actualiza tus datos en Connect2',
        html: `<p>Hola ${guest.full_name || ''},</p><p>Actualizamos tu registro. Si necesitas cambiar información adicional, ingresa al evento con tu código.</p>`
      })
    } else {
      mode = 'create'
      const { data: ins, error: e3 } = await supabase
        .from('guests')
        .insert({ event_id: eid, email, full_name: full_name || email.split('@')[0], metadata: extra || {} })
        .select('*')
        .single()
      if (e3) throw e3
      guest = ins

      await sendEmail(resendKey, {
        to: email,
        subject: 'Regístrate en Connect2',
        html: `<p>Hola ${guest.full_name},</p><p>Ya estás pre-registrado para el evento. Completa tus datos al ingresar con el código del evento.</p>`
      })
    }

    return new Response(JSON.stringify({ mode, guest }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as any).message }), { status: 500, headers: corsHeaders })
  }
})
