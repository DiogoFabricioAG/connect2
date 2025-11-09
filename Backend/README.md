# Backend (Supabase) - connect2

Este backend usa Supabase (Postgres + Edge Functions) para soportar el flujo completo del app Connect2: creación de eventos e invitados, salas, transcripción, generación de preguntas, TTS y notificaciones por email.

- Eventos con preferencias y código de acceso
- Invitados (fotocheck: números secuenciales, “Busca al Nºx”, marcar encontrado)
- Salas automáticas y vista de temas por sala
- Transcripción de charlas (ElevenLabs STT)
- Generación de preguntas desde la transcripción
- Personas virtuales (perfiles JSON)
- TTS (ElevenLabs) para “que el app hable”
- Notificaciones por email (Resend) para registro/actualización

## Arquitectura y estructura

Carpeta: `Backend/`

- `supabase/schema.sql` → Tablas, índices, triggers y vista (`room_conversation_topics`).
- `supabase/seed.sql` → Ejemplo de seed (listo para copiar al SQL Editor de Supabase).
- `supabase/functions/*` → Edge Functions (Deno) desplegables.
- `.env.example` → Variables de entorno (completar y copiar a `.env`).

Base de datos principal:

- `events(id, code, title, description, status, preferences, created_at)`
- `virtual_people(id, event_id, display_name, persona_profile)`
- `guests(id, event_id, full_name, email, badge_number, found, metadata)`
- `rooms(id, event_id, name, topic, capacity)`
- `talks(id, event_id, speaker, source_audio_url, transcript, summary)`
- `questions(id, event_id, room_id, talk_id, content, context)`

La vista `room_conversation_topics` expone por sala el último `summary` de charla (placeholder listo para ampliar).

## Variables de entorno (Backend/.env.example)

Obligatorias del proyecto Supabase:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Opcionales / características:
- `OPENAI_API_KEY` (reservado para usos futuros)
- `ELEVENLABS_API_KEY` (TTS/STT)
- `ELEVENLABS_VOICE_ID` (por defecto incluye una voz de ejemplo)
- `ELEVENLABS_STT_URL` (default: https://api.elevenlabs.io/v1/speech-to-text)
- `ELEVENLABS_STT_MODEL_ID` (default: whisper-large-v3)
- `RESEND_API_KEY` (envío de correos)

Recomendación: añade estos valores como “Project Secrets” en Supabase Dashboard > Project Settings > Functions > Secrets.

## Edge Functions: endpoints y propósito

Todas son POST con JSON y devuelven JSON. Base URL:
`https://<PROJECT_REF>.supabase.co/functions/v1/<nombre>`

- `create-event` → Crea evento (y opcionalmente invitados).
  - Por qué: bootstrap rápido del evento y su lista inicial.
  - Request: `{ title, description?, preferences?, guests?: [{ full_name, email? }] }`
  - Response: `{ event }`

- `assign-badges` → Asigna números secuenciales a invitados sin número.
  - Por qué: generar fotochecks y orden para control de acceso.
  - Request: `{ event_id }`
  - Response: `{ assigned: number }`

- `search-guest` → Busca por Nº (badge) y opcionalmente marca `found=true`.
  - Por qué: “Busca al Nº5” en la pestaña del evento, control de hallazgo.
  - Request: `{ event_code? | event_id?, number, markFound? }`
  - Response: `{ found: boolean, guest? }`

- `generate-rooms` → Crea N salas automáticamente.
  - Por qué: preparación rápida de espacios de conversación.
  - Request: `{ event_code? | event_id?, count, prefix? }`
  - Response: `{ rooms: Room[] }`

- `transcribe-talk` → Transcribe audio con ElevenLabs STT y guarda en `talks`.
  - Por qué: convertir charlas en texto para análisis/preguntas.
  - Request: `{ event_code? | event_id?, speaker?, audio_url }`
  - Response: `{ talk }`

- `generate-questions` → Genera preguntas desde la última transcripción del evento.
  - Por qué: crear prompts de conversación y Q&A rápido.
  - Request: `{ event_code? | event_id?, room_id?, limit?=5 }`
  - Response: `{ questions: Question[] }`

- `create-virtual-person` → Crea personas virtuales con su `persona_profile`.
  - Por qué: perfiles/avatares para dinámicas o agentes virtuales.
  - Request: `{ event_code? | event_id?, display_name, persona_profile? }`
  - Response: `{ virtual_person }`

- `speak-text` (ElevenLabs TTS) → Devuelve audio MP3 en base64 desde texto.
  - Por qué: “que el app hable” en el front.
  - Request: `{ text, voice_id?, model_id?, optimize_streaming_latency? }`
  - Response: `{ audio_base64, mime: 'audio/mpeg' }`

- `notify-guest` (Resend) → Crea/actualiza invitado por email y envía notificación.
  - Por qué: flujo de registro simple: si existe, actualiza dato(s) y avisa; si no, lo crea e invita.
  - Request: `{ event_code? | event_id?, email, full_name?, extra? }`
  - Response: `{ mode: 'create'|'update', guest }`

## Setup y despliegue (Windows PowerShell)

1) Instala Supabase CLI y haz login:
- https://supabase.com/docs/guides/cli

2) Ubícate en `Backend` (donde existe `supabase/`) y vincula el proyecto:
```powershell
cd D:\Proyectos2025\connect2\Backend
supabase login
supabase link --project-ref <TU_PROJECT_REF>
```

3) Carga secrets (usa tus valores reales):
```powershell
supabase secrets set SUPABASE_URL="<...>" SUPABASE_ANON_KEY="<...>" SUPABASE_SERVICE_ROLE_KEY="<...>" `
  ELEVENLABS_API_KEY="<...>" ELEVENLABS_VOICE_ID="<opcional>" `
  ELEVENLABS_STT_URL="https://api.elevenlabs.io/v1/speech-to-text" ELEVENLABS_STT_MODEL_ID="whisper-large-v3" `
  RESEND_API_KEY="<...>"
```

4) Aplica el esquema (una vez):
- Dashboard > SQL Editor → pegar y ejecutar `supabase/schema.sql`.

5) Despliega funciones (siempre desde `Backend/`, no entres a la subcarpeta de la función):
```powershell
supabase functions deploy create-event
supabase functions deploy assign-badges
supabase functions deploy search-guest
supabase functions deploy generate-rooms
supabase functions deploy transcribe-talk
supabase functions deploy generate-questions
supabase functions deploy create-virtual-person
supabase functions deploy speak-text
supabase functions deploy notify-guest
```

Base de invocación: `https://<PROJECT_REF>.supabase.co/functions/v1/<nombre>`

6) Probar rápido (PowerShell) — ejemplos opcionales
- Crear evento:
```powershell
$body = @{ title = "Evento Demo"; description = "Demo"; guests = @(@{ full_name = "Alice" }, @{ full_name = "Bob" }) } | ConvertTo-Json -Depth 6
Invoke-RestMethod -Method Post -Uri "https://<REF>.supabase.co/functions/v1/create-event" -Headers @{ "Content-Type"="application/json" } -Body $body
```

- Notificar invitado:
```powershell
$body = @{ event_code = "<CODIGO>"; email = "usuario@example.com"; full_name = "Usuario"; extra = @{ empresa = "Acme" } } | ConvertTo-Json -Depth 6
Invoke-RestMethod -Method Post -Uri "https://<REF>.supabase.co/functions/v1/notify-guest" -Headers @{ "Content-Type"="application/json" } -Body $body
```

## Integración Frontend (resumen)

- Flujo típico: el usuario ingresa el código del evento (`events.code`).
- Acciones desde el Front:
  - Crear evento / invitados → `create-event`
  - Asignar números (fotocheck) → `assign-badges`
  - “Busca al Nºx” → `search-guest` (y opcional `markFound`)
  - Generar salas → `generate-rooms`
  - Transcribir charla → `transcribe-talk`
  - Generar preguntas → `generate-questions`
  - Persona virtual → `create-virtual-person`
  - TTS “que el app hable” → `speak-text` (crear Blob con base64 en el front)
  - Email registro/actualización → `notify-guest`

## CORS y seguridad

- CORS: si llamas desde un front local, añade headers CORS (ya incluidos en `notify-guest`; se pueden replicar en otras funciones).
- RLS: las políticas están abiertas para desarrollo. Antes de producción, restringe por usuario/rol y/o por `events.organizer_id`.
- Service Role: estas funciones usan `SERVICE_ROLE_KEY` (poderoso). Mantén las funciones privadas en Supabase o valida inputs estrictamente.

## Observabilidad y troubleshooting

- Logs: Supabase Dashboard > Observability > Logs > Edge Functions.
- Error común de deploy (ruta de entrada): ejecuta `supabase functions deploy` desde `Backend/`, no desde la carpeta interna. La CLI busca `supabase/functions/<name>/index.ts` relativo al dir actual.
- 401/403: revisa secrets y permisos en el dashboard.
- 400/500: valida el body JSON y que `event_code`/`event_id` apunten a registros existentes.

## Próximos pasos

- Resumir charlas automáticamente al transcribir y reflejar en `room_conversation_topics`.
- Guardar audios TTS en Supabase Storage y devolver URLs.
- Integrar Supabase Auth y ownership por `organizer_id`.
