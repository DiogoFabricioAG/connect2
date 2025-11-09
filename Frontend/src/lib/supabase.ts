import { createClient } from '@supabase/supabase-js';
import { config } from '../config';

export const supabase = createClient(config.supabase.url, config.supabase.anonKey);

// Database Types
export interface SpeakerInfo {
  bio?: string;
  topics?: string[];
  [key: string]: unknown;
}

export interface Event {
  id: string;
  code: string;
  name: string;
  description: string | null;
  date: string;
  location: string | null;
  luma_event_id: string | null;
  speaker_info: SpeakerInfo | null;
  status: 'draft' | 'published' | 'ongoing' | 'completed';
  created_at: string;
  updated_at: string;
}

export interface GuestPreferences {
  networking_style?: string;
  availability?: string[];
  [key: string]: unknown;
}

export interface Guest {
  id: string;
  event_id: string;
  email: string;
  name: string | null;
  badge_number: number | null;
  interests: string[] | null;
  preferences: GuestPreferences | null;
  luma_registered: boolean;
  checked_in: boolean;
  created_at: string;
  updated_at: string;
}

export interface Room {
  id: string;
  event_id: string;
  name: string;
  topics: string[];
  guest_ids: string[];
  created_at: string;
}

export interface QuestionContext {
  source?: string;
  [key: string]: unknown;
}

export interface Question {
  id: string;
  event_id: string;
  guest1_id: string;
  guest2_id: string;
  question_text: string;
  category: string;
  context: QuestionContext | null;
  created_at: string;
}

// Auth helpers
export const signUp = async (email: string, password: string, metadata?: Record<string, unknown>) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: metadata,
  emailRedirectTo: globalThis.location.origin + '/events'
    }
  });
  return { data, error };
};

export const signIn = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });
  return { data, error };
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  return { error };
};

export const getCurrentUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser();
  return { user, error };
};

// Event functions
export const getEvents = async () => {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('status', 'published')
    .order('date', { ascending: true });
  return { data, error };
};

export const getEventByCode = async (code: string) => {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('code', code)
    .single();
  return { data, error };
};

export const createEvent = async (eventData: Partial<Event>) => {
  const { data, error } = await supabase
    .from('events')
    .insert(eventData)
    .select()
    .single();
  return { data, error };
};

// Guest functions
export const getGuestByEmail = async (email: string, eventId: string) => {
  const { data, error } = await supabase
    .from('guests')
    .select('*')
    .eq('email', email)
    .eq('event_id', eventId)
    .single();
  return { data, error };
};

export const getGuestByBadge = async (badgeNumber: number, eventId: string) => {
  const { data, error } = await supabase
    .from('guests')
    .select('*')
    .eq('badge_number', badgeNumber)
    .eq('event_id', eventId)
    .single();
  return { data, error };
};

export const updateGuestInterests = async (guestId: string, interests: string[], preferences: GuestPreferences) => {
  const { data, error } = await supabase
    .from('guests')
    .update({ interests, preferences, updated_at: new Date().toISOString() })
    .eq('id', guestId)
    .select()
    .single();
  return { data, error };
};

export const checkInGuest = async (guestId: string) => {
  const { data, error } = await supabase
    .from('guests')
    .update({ checked_in: true, updated_at: new Date().toISOString() })
    .eq('id', guestId)
    .select()
    .single();
  return { data, error };
};

// Edge Functions calls
export const callEdgeFunction = async <T = unknown>(functionName: string, payload: Record<string, unknown>) => {
  const { data, error } = await supabase.functions.invoke(functionName, {
    body: payload
  });
  return { data: data as T, error };
};

// Specific Edge Function wrappers
export const assignBadges = async (eventId: string) => callEdgeFunction<{ assigned: number }>('assign-badges', { eventId });

type EventRef = { eventId?: string; eventCode?: string };

export const searchGuest = async (ref: EventRef, badgeNumber: number, markFound = false) => callEdgeFunction<{ found: boolean; guest?: Guest }>('search-guest', { ...ref, badgeNumber, markFound });

export const generateRooms = async (ref: EventRef, count = 5, prefix?: string) => callEdgeFunction<{ rooms: Room[] }>('generate-rooms', { ...ref, count, prefix });

export const generateQuestions = async (ref: EventRef, roomId?: string, limit = 5, context?: string) => callEdgeFunction<{ questions: { id: string; content: string; context: QuestionContext }[] }>('generate-questions', { ...ref, roomId, limit, context });

export const transcribeTalk = async (ref: EventRef, audioBase64?: string, audioUrl?: string, speaker?: string, contentType?: string) => callEdgeFunction<{ talk: { id: string; transcript: string } }>('transcribe-talk', { ...ref, audio_base64: audioBase64, audio_url: audioUrl, speaker, content_type: contentType });

export const speakText = async (text: string, voiceId?: string) => callEdgeFunction<{ audio_base64: string; mime: string }>('speak-text', { text, voice_id: voiceId });

export const createVirtualPerson = async (ref: EventRef, displayName: string, personaProfile?: Record<string, unknown>) => callEdgeFunction<{ virtual_person: { id: string; display_name: string } }>('create-virtual-person', { ...ref, display_name: displayName, persona_profile: personaProfile });

export const notifyGuest = async (email: string, eventCode: string, fullName?: string, extra?: Record<string, unknown>) => callEdgeFunction<{ mode: string; guest: Guest }>('notify-guest', { email, eventCode, full_name: fullName, extra });
