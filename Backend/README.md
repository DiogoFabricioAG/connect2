# Backend (Supabase) - connect2

Este backend usa Supabase (Postgres + Edge Functions) para cubrir las capacidades del app:

- Crear Eventos (con lista de invitados)
- Crear Personas Virtuales (con preferencias)
- Formulario de Preferencias (json almacenado)
- Creación de Números para Fotochecks (asignación automática)
- Transcripción de Charla (ElevenLabs STT)
- Pestaña del Evento: buscar por Nº ("Busca al Nº5") y marcar encontrado
- Creación de Salas (Automático)
- Creación de Preguntas con el contexto obtenido + botón en el front
- Interfaz para ver tema de conversación entre salas (vista combinada)
- [Opcional] "que el app hable" (se haría desde el front consumiendo TTS)

## Estructura

- `supabase/schema.sql`: Tablas, índices, triggers y vista.
- `supabase/seed.sql`: Ejemplo de seed para copiar al SQL Editor (comentado para evitar linters).
- `supabase/functions/*`: Edge Functions (Deno) listas para desplegar en Supabase.
- `.env.example`: Variables de entorno requeridas.

## Tablas principales

- `events(id, code, title, description, status, preferences, created_at)`
- `virtual_people(id, event_id, display_name, persona_profile)`
- `guests(id, event_id, full_name, email, badge_number, found, metadata)`
- `rooms(id, event_id, name, topic, capacity)`
- `talks(id, event_id, speaker, source_audio_url, transcript, summary)`
- `questions(id, event_id, room_id, talk_id, content, context)`

La vista `room_conversation_topics` expone por sala el último resumen de charla.

## Edge Functions disponibles (contratos)

Todas reciben JSON por POST y devuelven JSON. Autorización: usan Service Role internamente (configurar secretos en Supabase).

- `create-event`: Crea un evento con invitados.
  - Request: `{ title: string, description?: string, preferences?: object, guests?: [{full_name: string, email?: string}] }`
  - Response: `{ event }`

- `assign-badges`: Asigna números secuenciales a invitados sin número.
  - Request: `{ event_id: string }`
  - Response: `{ assigned: number }`

- `search-guest`: Busca invitado por número y opcionalmente lo marca como encontrado.
  - Request: `{ event_code?: string, event_id?: string, number: number, markFound?: boolean }`
  - Response: `{ found: boolean, guest?: Guest }`

- `generate-rooms`: Crea n salas automáticamente.
  - Request: `{ event_id?: string, event_code?: string, count: number, prefix?: string }`
  - Response: `{ rooms: Room[] }`

 - `transcribe-talk`: Crea registro de charla y usa ElevenLabs STT si hay `ELEVENLABS_API_KEY`.
  - Request: `{ event_id?: string, event_code?: string, speaker?: string, audio_url?: string }`
  - Response: `{ talk }`

- `generate-questions`: Genera preguntas a partir de transcripción.
  - Request: `{ event_id?: string, event_code?: string, room_id?: string, limit?: number }`
  - Response: `{ questions: Question[] }`

- `create-virtual-person`: Crea una persona virtual con su perfil.
  - Request: `{ event_id?: string, event_code?: string, display_name: string, persona_profile?: object }`
  - Response: `{ virtual_person }`

- `speak-text` (ElevenLabs TTS): Genera audio (base64 MP3) a partir de texto.
  - Request: `{ text: string, voice_id?: string, model_id?: string, optimize_streaming_latency?: number }`
  - Response: `{ audio_base64: string, mime: 'audio/mpeg' }`

## Configuración (Windows)

1) Instalar Supabase CLI:
   - https://supabase.com/docs/guides/cli

2) Crear proyecto en Supabase y obtener:
   - `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

3) Variables de entorno (local y/o secrets en Supabase):
   - Copia `.env.example` a `.env` y completa los valores.
   - En Supabase Dashboard > Project Settings > Functions > Secrets añade las mismas claves.
  - Para TTS, añade:
    - `ELEVENLABS_API_KEY`
    - `ELEVENLABS_VOICE_ID` (opcional; por defecto se usa una voz de ejemplo)
    - Para STT (transcripción) añade opcionalmente:
      - `ELEVENLABS_STT_URL` (por defecto: https://api.elevenlabs.io/v1/speech-to-text)
      - `ELEVENLABS_STT_MODEL_ID` (por defecto: whisper-large-v3)

4) Aplicar el esquema en Supabase (2 opciones):
   - Opción A (SQL Editor): Copia el contenido de `supabase/schema.sql` en el SQL Editor y ejecútalo.
   - Opción B (CLI con migration): Inicializa un proyecto Supabase local y agrega este `schema.sql` como migración.

5) Desplegar Edge Functions (CLI):
   - Ubícate en `Backend/supabase/functions/<nombre-funcion>` y ejecuta:
     - `supabase functions deploy <nombre-funcion>`
   - Luego llama desde el Front con `fetch` a la URL del Function otorga en Supabase.

## Integración Frontend (resumen)

- Al iniciar la app, pide el `codigo` del evento (campo `events.code`).
- Desde el Front puedes:
  - Crear evento + invitados: POST a `create-event`.
  - Asignar fotochecks: POST a `assign-badges` con `event_id`.
  - Buscar por Nº ("Busca al Nº5"): POST a `search-guest` con `event_code` y `number`.
  - Generar salas: POST a `generate-rooms` con `event_code` y `count`.
  - Transcribir charla: POST a `transcribe-talk` con `event_code` y `audio_url`.
  - Generar preguntas: POST a `generate-questions` con `event_code`.
  - Crear persona virtual: POST a `create-virtual-person` con `event_code`.

## Notas de seguridad

- Las políticas RLS están abiertas para desarrollo (select/insert/update). Antes de producción, restringir por usuario/rol o por `events.code` mediante funciones `SECURITY DEFINER`.

## Próximos pasos sugeridos

- Añadir auth (Supabase Auth) y amarrar eventos a `organizer_id`.
- Integrar transcripción avanzada (resúmenes automáticos) y TTS para “que el app hable”.
- Añadir endpoints para "estado del evento - en curso" (status=live) con vistas en tiempo real (Realtime).
