import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qaojiegniarmaunutelh.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhb2ppZWduaWFybWF1bnV0ZWxoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI2NDA5MDUsImV4cCI6MjA3ODIxNjkwNX0.76dRokqEWZ1R0GVBabxC7X9Cr1pOJwO6zDSplaAUspY';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Database Types
export interface Event {
  id: string;
  code: string;
  name: string;
  description: string | null;
  date: string;
  location: string | null;
  luma_event_id: string | null;
  speaker_info: any | null;
  status: 'draft' | 'published' | 'ongoing' | 'completed';
  created_at: string;
  updated_at: string;
}

export interface Guest {
  id: string;
  event_id: string;
  email: string;
  name: string | null;
  badge_number: number | null;
  interests: string[] | null;
  preferences: any | null;
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

export interface Question {
  id: string;
  event_id: string;
  guest1_id: string;
  guest2_id: string;
  question_text: string;
  category: string;
  context: any | null;
  created_at: string;
}

// Auth helpers
export const signUp = async (email: string, password: string, metadata?: any) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: metadata,
      emailRedirectTo: window.location.origin + '/events'
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

export const createEvent = async (eventData: any) => {
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

export const updateGuestInterests = async (guestId: string, interests: string[], preferences: any) => {
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
export const callEdgeFunction = async (functionName: string, payload: any) => {
  const { data, error } = await supabase.functions.invoke(functionName, {
    body: payload
  });
  return { data, error };
};

// Specific Edge Function wrappers
export const assignBadges = async (eventId: string) => {
  return callEdgeFunction('assign-badges', { eventId });
};

export const searchGuest = async (eventId: string, badgeNumber: number) => {
  return callEdgeFunction('search-guest', { eventId, badgeNumber });
};

export const generateRooms = async (eventId: string) => {
  return callEdgeFunction('generate-rooms', { eventId });
};

export const generateQuestions = async (eventId: string, guest1Id: string, guest2Id: string) => {
  return callEdgeFunction('generate-questions', { eventId, guest1Id, guest2Id });
};

export const transcribeTalk = async (audioBase64: string, eventId: string) => {
  return callEdgeFunction('transcribe-talk', { audioBase64, eventId });
};

export const speakText = async (text: string, voiceId?: string) => {
  return callEdgeFunction('speak-text', { text, voiceId });
};

export const createVirtualPerson = async (eventId: string, guestId: string) => {
  return callEdgeFunction('create-virtual-person', { eventId, guestId });
};

export const notifyGuest = async (email: string, eventCode: string, type: 'welcome' | 'registration' | 'update') => {
  return callEdgeFunction('notify-guest', { email, eventCode, type });
};
