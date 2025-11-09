// Edge Function: start-event
// Orquesta el inicio del evento: asigna badge_number secuencial a todos los guests sin badge,
// genera salas aleatorias (room_size opcional, mínimo 2 por sala) y crea pareos guest<->guest
// POST body: { event_id?: string, eventId?: string, min_room_size?: number, max_room_size?: number }
// Respuesta: { assigned_badges: number, rooms_created: number, pairs_created: number }
import { getServiceClient } from '../_shared/supabaseClient.ts'

interface GuestRow { id: string; full_name: string | null; badge_number: number | null }

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, Authorization, apikey, Apikey, x-client-info, X-Client-Info, content-type, Content-Type, accept, Accept',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

async function assignBadges(supabase: any, eventId: string): Promise<number> {
  // Obtener todos los guests ordenados por created_at para que el badge sea estable si se re-ejecuta
  const { data: guestsAll, error: gErr } = await supabase
    .from('guests')
    .select('id, full_name, badge_number')
    .eq('event_id', eventId)
    .order('created_at', { ascending: true })
  if (gErr) throw new Error(gErr.message)
  if (!guestsAll) return 0
  let next = 0
  for (const g of guestsAll as GuestRow[]) {
    if (g.badge_number && g.badge_number > next) next = g.badge_number
  }
  let assigned = 0
  for (const g of guestsAll as GuestRow[]) {
    if (g.badge_number == null) {
      next += 1
      const { error } = await supabase.from('guests').update({ badge_number: next }).eq('id', g.id)
      if (error) throw new Error(error.message)
      assigned++
    }
  }
  return assigned
}

async function createRandomRooms(supabase: any, eventId: string, minSize = 2, maxSize = 6) {
  if (minSize < 2) minSize = 2
  if (maxSize < minSize) maxSize = minSize
  // Traer todos los guest IDs
  const { data: guests, error } = await supabase
    .from('guests')
    .select('id, full_name, badge_number')
    .eq('event_id', eventId)
    .order('badge_number', { ascending: true })
  if (error) throw new Error(error.message)
  const list: { id: string; full_name: string | null; badge_number: number | null }[] = ((guests || []) as { id: string; full_name: string | null; badge_number: number | null }[]).filter((g) => g.badge_number != null)
  shuffle(list)
  const rooms: { name: string; guest_ids: string[]; topics: string[] }[] = []
  let index = 0
  let roomCounter = 0
  while (index < list.length) {
    const remaining = list.length - index
    const size = Math.min(Math.max(minSize, Math.floor(Math.random() * (maxSize - minSize + 1)) + minSize), remaining)
    if (remaining < minSize && rooms.length > 0) {
      // Añadir remanentes a la última sala para no dejar a alguien solo
      const last = rooms[rooms.length - 1]
      for (let r = 0; r < remaining; r++) {
        last.guest_ids.push(list[index + r].id)
      }
  break
    }
      const chunk: { id: string; full_name: string | null; badge_number: number | null }[] = list.slice(index, index + size)
    index += size
    roomCounter++
    rooms.push({
      name: `Room ${roomCounter}`,
        guest_ids: chunk.map((c: { id: string }) => c.id),
      topics: ['Networking', 'Random']
    })
  }
  // Insert rooms (DB may not have guest_ids/topics columns, keep minimal shape) and obtain ids
  const insertsMinimal = rooms.map(r => ({ event_id: eventId, name: r.name }))
  let createdRooms: { id: string; name: string }[] = []
  if (insertsMinimal.length) {
    const { data: created, error: rErr } = await supabase.from('rooms').insert(insertsMinimal).select('id, name')
    if (rErr) throw new Error(rErr.message)
    createdRooms = created || []
  }

  // Build participants rows for bridge table room_participants
  const nameToId = new Map(createdRooms.map(r => [r.name, r.id] as const))
  const participantRows: { room_id: string; guest_id: string; event_id: string }[] = []
  for (const r of rooms) {
    const roomId = nameToId.get(r.name)
    if (!roomId) continue
    for (const gid of r.guest_ids) {
      participantRows.push({ room_id: roomId, guest_id: gid, event_id: eventId })
    }
  }
  if (participantRows.length) {
    // Upsert to avoid duplicates if function is re-run
    const { error: pErr } = await supabase.from('room_participants').upsert(participantRows, { onConflict: 'room_id,guest_id' })
    if (pErr) throw new Error(pErr.message)
  }

  return rooms
}

async function createPairs(supabase: any, eventId: string) {
  // Emparejar aleatoriamente (estilo random walk) para simulación
  const { data: guests, error } = await supabase
    .from('guests')
    .select('id')
    .eq('event_id', eventId)
    .order('badge_number', { ascending: true })
  if (error) throw new Error(error.message)
  const ids: string[] = ((guests || []) as { id: string }[]).map((g) => g.id)
  shuffle(ids)
  const pairs: { guest1_id: string; guest2_id: string }[] = []
  for (let i = 0; i < ids.length - 1; i += 2) {
    pairs.push({ guest1_id: ids[i], guest2_id: ids[i + 1] })
  }
  // Guardar en una tabla auxiliar si existe: pairs; si no, guardamos en questions como placeholder
  // Para simplicidad: almacenamos en metadata de guests (append partner_id)
  for (const p of pairs) {
    await supabase.from('guests').update({ metadata: { partner_id: p.guest2_id } }).eq('id', p.guest1_id)
    await supabase.from('guests').update({ metadata: { partner_id: p.guest1_id } }).eq('id', p.guest2_id)
  }
  return pairs.length
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...cors, 'Access-Control-Max-Age': '86400', 'Content-Type': 'application/json' } })
  if (req.method === 'GET') return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } })
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: cors })
  try {
    const body = await req.json()
    const eventId: string | undefined = body.event_id || body.eventId
    if (!eventId) return new Response('Missing event_id', { status: 400, headers: cors })
    const minSize = typeof body.min_room_size === 'number' ? body.min_room_size : 2
    const maxSize = typeof body.max_room_size === 'number' ? body.max_room_size : 6

    const supabase = getServiceClient()
    const assigned = await assignBadges(supabase, eventId)
    const rooms = await createRandomRooms(supabase, eventId, minSize, maxSize)
    const pairCount = await createPairs(supabase, eventId)
    // Actualizar status del evento a live
    await supabase.from('events').update({ status: 'live' }).eq('id', eventId)

    return new Response(JSON.stringify({ assigned_badges: assigned, rooms_created: rooms.length, pairs_created: pairCount }), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } })
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as any).message }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } })
  }
})
        // index se ajusta al final para salir del bucle
