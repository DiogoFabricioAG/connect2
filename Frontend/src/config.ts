// Configuración de APIs y servicios usando variables de entorno.
// IMPORTANTE: No expongas claves secretas en el Frontend. Solo deben ir claves públicas (anon) o tokens temporales.
// Para Vite usar prefijo VITE_, para Next.js usar NEXT_PUBLIC_. Aquí asumimos Vite/esbuild con prefijo VITE_.

function getEnv(name: string, required = false): string {
  // Soporta import.meta.env (Vite) y evita depender de process.env si no existe
  const meta: unknown = import.meta as unknown
  const envRaw = (meta && (meta as { env?: Record<string, string> }).env) || {}
  const env: Record<string, string | undefined> = { ...envRaw }
  const value = env[name]
  if (!value && required) {
    console.warn(`[config] Variable de entorno faltante: ${name}`)
  }
  return value || ''
}

export const config = {
  supabase: {
    url: getEnv('VITE_SUPABASE_URL', true),
    anonKey: getEnv('VITE_SUPABASE_ANON_KEY', true)
  },
  // Claves sensibles como OPENAI_API_KEY, ELEVENLABS_API_KEY, RESEND_API_KEY se deben usar SOLO vía backend.
  // Si realmente necesitas una clave en el cliente (no recomendado), añade su prefijo público y asume riesgo.
  openai: {
    apiKey: getEnv('VITE_OPENAI_API_KEY') // opcional, debería permanecer vacío en producción
  },
  elevenlabs: {
    // Solo la voz podría ser pública; la apiKey mejor manejarla en el backend para TTS/STT.
    voiceId: getEnv('VITE_ELEVENLABS_VOICE_ID') || '21m00Tcm4TlvDq8ikWAM'
  },
  endpoints: {
    // Facilidad para construir URLs a Edge Functions
    functionsBase: getEnv('VITE_FUNCTIONS_BASE') || `${getEnv('VITE_SUPABASE_URL')}/functions/v1`
  }
}

// Mock data para pruebas
export const mockUser = {
  id: '1',
  email: 'test@connect2.com',
  name: 'John Doe',
  badgeNumber: 42,
  interests: ['AI', 'Networking', 'Startups'],
  registeredEvents: ['TECH2025']
};

export const mockEvent = {
  id: '1',
  code: 'TECH2025',
  title: 'Tech Summit 2025',
  description: 'Annual technology conference',
  date: '2025-11-15T09:00:00',
  status: 'live',
  attendees: 250
};