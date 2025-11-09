import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import logoImage from '../assets/logo.png';
import { useLanguage } from '../lib/LanguageContext';
import { speakText as speakTextEdge, searchGuest as searchGuestEdge, generateQuestions as generateQuestionsEdge, transcribeTalk as transcribeTalkEdge, getEventByCode, getCurrentUser, importGuestsCsv, startEvent as startEventEdge, supabase as sbClient, type Event as UiEvent } from '../lib/supabase';
import { config } from '../config';

// Interfaz UI de sala (simplificada para visual)
interface UiRoom {
  id: string;
  name: string;
  topic: string;
  participants: string[];
  conversationTopics: string[];
}

interface Question {
  id: string;
  text: string;
  category: string;
}

interface Badge {
  number: number;
  name: string;
  interests: string[];
  matched: boolean;
}


export function EventPage() {
  const { eventCode } = useParams();
  const navigate = useNavigate();
  const { language, toggleLanguage } = useLanguage();
  const [searchNumber, setSearchNumber] = useState('');
  const [rooms, setRooms] = useState<UiRoom[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [matchFound, setMatchFound] = useState(false);
  const [matchedPerson, setMatchedPerson] = useState<Badge | null>(null);
  const [transcription, setTranscription] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [myBadgeNumber] = useState(42); // Usuario de prueba
  const [generatingQuestions, setGeneratingQuestions] = useState(false);
  const [activeTab, setActiveTab] = useState<'search' | 'rooms' | 'questions'>('search');
  const [currentRoom, setCurrentRoom] = useState<UiRoom | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState<string[]>([]);
  // Fullscreen Questions Overlay
  const [showQsOverlay, setShowQsOverlay] = useState(false);
  const [qsClickCount, setQsClickCount] = useState(0);
  const [overlayInfo, setOverlayInfo] = useState<string | null>(null);
  const [overlayLastQuestion, setOverlayLastQuestion] = useState<Question | null>(null);
  // Queue for prefetching questions in batches
  const [qsQueue, setQsQueue] = useState<Question[]>([]);
  const [qsPrefetching, setQsPrefetching] = useState(false);
  const [eventInfo, setEventInfo] = useState<UiEvent | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [csvBusy, setCsvBusy] = useState(false);
  interface CsvResultState { inserted: number; skipped: number; emails_sent?: number; emails_attempted?: number; emails_failed?: number; email_warning?: string }
  const [csvResult, setCsvResult] = useState<CsvResultState | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [startingEvent, setStartingEvent] = useState(false);
  const [startMsg, setStartMsg] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  // Auto match & room mates
  const [autoLoading, setAutoLoading] = useState(false);
  const [roomMates, setRoomMates] = useState<Array<{ id: string; name: string; badge?: number; found?: boolean }>>([]);

  useEffect(() => {
    // Cargar salas existentes al montar el componente
    fetchRooms();
    // Cargar info del evento
    (async () => {
      if (!eventCode) return;
      const { data } = await getEventByCode(eventCode);
      if (data) setEventInfo(data);
    })();
    // Obtener usuario actual (para controles de organizador)
    (async () => {
      const { user } = await getCurrentUser();
      setUserId(user?.id || null);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventCode]);

  const fetchRooms = async () => {
    // Mostrar salas creadas para el evento y sus participantes por número de fotocheck
    if (!eventInfo?.id) return;
    try {
      // 1) Salas del evento
      const { data: roomsRes, error: roomsErr } = await sbClient
        .from('rooms')
        .select('id, name, topic')
        .eq('event_id', eventInfo.id);
      if (roomsErr) throw roomsErr;
      const roomList = (roomsRes as Array<{ id: string; name?: string; topic?: string }> | null) || [];
      if (roomList.length === 0) { setRooms([]); return; }

      const roomIds = roomList.map(r => r.id);

      // 2) Relaciones room-participants
      const { data: rels, error: relsErr } = await sbClient
        .from('room_participants')
        .select('room_id, guest_id')
        .in('room_id', roomIds);
      if (relsErr) throw relsErr;
      const relsTyped = (rels as Array<{ room_id: string; guest_id: string }> | null) || [];
      const guestIds = Array.from(new Set(relsTyped.map(r => r.guest_id)));

      // 3) Invitados con sus números
  const guestMap = new Map<string, number | null>();
      if (guestIds.length > 0) {
        const { data: guests, error: guestsErr } = await sbClient
          .from('guests')
          .select('id, badge_number')
          .in('id', guestIds);
        if (guestsErr) throw guestsErr;
        const guestsTyped = (guests as Array<{ id: string; badge_number: number | null }> | null) || [];
        guestsTyped.forEach(g => guestMap.set(g.id, typeof g.badge_number === 'number' ? g.badge_number : null));
      }

      // 4) Construir UI
      const uiRooms: UiRoom[] = roomList.map((r, idx) => {
        const participantsIds = relsTyped.filter(rel => rel.room_id === r.id).map(rel => rel.guest_id);
        const formatted = participantsIds.map(pid => {
          const n = guestMap.get(pid);
          return typeof n === 'number' ? `n°${n}` : 's/n';
        });
        return {
          id: r.id,
          name: r.name || `Sala ${idx + 1}`,
          topic: r.topic || 'General',
          participants: formatted,
          conversationTopics: []
        };
      });
      setRooms(uiRooms);
    } catch (error) {
      console.error('Error fetching rooms:', error);
    }
  };

  // formatRoom eliminado: la construcción de salas ahora sucede en fetchRooms desde la BD persistida

  const handleSearchGuest = async () => {
    try {
      if (!eventCode || !searchNumber) return;
      const number = Number.parseInt(searchNumber, 10);
      const { data, error } = await searchGuestEdge({ eventCode }, number, false);
      if (error) throw error;
      setMatchFound(!!data?.found);
      if (data?.found && data?.guest) {
        const guestObj = data.guest as unknown as { full_name?: string; name?: string; interests?: unknown };
        const interestsArr = Array.isArray(guestObj.interests)
          ? guestObj.interests.filter((i): i is string => typeof i === 'string')
          : ['Networking', 'Tech'];
        setMatchedPerson({
          number,
          name: guestObj.full_name || guestObj.name || `Person #${number}`,
          interests: interestsArr,
          matched: true
        });
        // Generar preguntas automáticamente (sin contexto específico por ahora)
        await generateQuestions();
      }
    } catch (error) {
      console.error('Error searching for guest:', error);
    }
  };

  // generateRooms (Edge) eliminado: usamos fetchRooms para mostrar salas reales

  // Fetch other participants in the same room as a given guestId (top-level helper)
  async function fetchRoomMatesForGuest(guestId: string) {
    if (!eventInfo?.id) return [] as Array<{ id: string; name: string; badge?: number }>;
    const { data: rel } = await sbClient
      .from('room_participants')
      .select('room_id')
      .eq('guest_id', guestId)
      .eq('event_id', eventInfo.id)
      .limit(1)
      .maybeSingle();
  type RoomRel = { room_id?: string } | null;
  const relTyped = rel as RoomRel;
  const roomId = relTyped?.room_id;
    if (!roomId) return [];
    const { data: rels } = await sbClient
      .from('room_participants')
      .select('guest_id')
      .eq('room_id', roomId);
    const relsTyped = (rels as Array<{ guest_id: string }> | null) || [];
    const otherIds = relsTyped
      .map((r) => r.guest_id)
      .filter((id: string) => id !== guestId);
    if (!otherIds.length) return [];
    const { data: mates } = await sbClient
      .from('guests')
      .select('id, full_name, badge_number, found')
      .in('id', otherIds);
    const matesTyped = (mates as Array<{ id: string; full_name?: string; badge_number?: number; found?: boolean }> | null) || [];
    return matesTyped.map((g) => ({ id: g.id, name: g.full_name || 'Guest', badge: g.badge_number, found: g.found }));
  }

  // Auto find recommended partner from my badge number
  async function autoFindPartner() {
    if (!eventInfo?.id || !myBadgeNumber) return;
    try {
      setAutoLoading(true);
      const { data, error } = await searchGuestEdge({ eventId: eventInfo.id }, myBadgeNumber, false);
      if (error) throw error;
      if (data?.found && data?.guest) {
  const g = data.guest as { id: string; full_name?: string; name?: string; interests?: unknown; badge_number?: number; found?: boolean };
        const number = typeof g.badge_number === 'number' ? g.badge_number : myBadgeNumber;
        setMatchFound(true);
        setMatchedPerson({
          number,
          name: (g.full_name as string) || (g.name as string) || `Person #${number}`,
          interests: Array.isArray(g.interests) ? g.interests.filter((i: unknown): i is string => typeof i === 'string') : ['Networking'],
          matched: true
        });
  // partnerFound eliminado; cada compañero contiene su propio estado 'found'
  const mates = await fetchRoomMatesForGuest(g.id);
        setRoomMates(mates);
      }
    } catch (e) {
      console.error('autoFindPartner error:', e);
    } finally {
      setAutoLoading(false);
    }
  }

  // Actualiza el estado "found" de un compañero de sala
  async function toggleFoundForMate(mateBadge?: number, current?: boolean) {
    if (!eventInfo?.id) return;
    // Buscamos por badge (si existe), actualizamos por id cuando ya lo tengamos en estado
    try {
      const desired = !current;
      // Si tenemos el id en nuestro estado, actualizamos directo en DB por id
      const target = roomMates.find(m => m.badge === mateBadge);
      if (target) {
        const { error } = await sbClient
          .from('guests')
          .update({ found: desired })
          .eq('id', target.id)
          .eq('event_id', eventInfo.id);
        if (error) throw error;
        setRoomMates(prev => prev.map(m => m.id === target.id ? { ...m, found: desired } : m));
      }
    } catch (e) {
      console.error('toggleFoundForMate error:', e);
      alert(language === 'es' ? 'Error al actualizar estado' : 'Error updating status');
    }
  }

  // Eliminado markPartnerAsFound: ahora cada compañero tendrá su propio toggle.

  // Trigger auto suggestion when entering search tab
  useEffect(() => {
    if (activeTab === 'search') autoFindPartner();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, eventInfo?.id, myBadgeNumber]);

  // Auto open fullscreen Questions overlay and start transcription when entering Questions tab
  useEffect(() => {
    if (activeTab === 'questions') {
      setShowQsOverlay(true);
      setOverlayInfo(language === 'es' ? '🎤 Transcripción activada. Toca la pantalla para generar una pregunta.' : '🎤 Transcription enabled. Tap anywhere to generate a question.');
      // Intentar activar micrófono automáticamente (puede requerir gesto del usuario según navegador)
      setTimeout(() => {
        try { startLiveTranscription(); } catch { /* no-op */ }
      }, 150);
      // Prefetch first batch so the first tap is instant
      prefetchQuestionsBatch(5).catch(() => {});
    } else {
      setShowQsOverlay(false);
      setOverlayInfo(null);
      setQsQueue([]);
      setQsPrefetching(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);


  const startRecording = async () => {
    setIsRecording(true);
    try {
      if (!eventCode) return;
      const { data, error } = await transcribeTalkEdge({ eventCode });
      if (error) throw error;
      const text = data?.talk?.transcript || '';
      setTranscription(text);
      await generateQuestions(text);
    } catch (error) {
      console.error('Error recording:', error);
    } finally {
      setIsRecording(false);
    }
  };

  const generateQuestions = async (context: string = '') => {
    setGeneratingQuestions(true);
    try {
      if (!eventCode) return;
      const { data, error } = await generateQuestionsEdge({ eventCode }, currentRoom?.id, 5, context || transcription);
      if (error) throw error;
      // La función devuelve { questions: rows } con campo 'content'
  interface RawQuestion { id: string; content: string; context?: { source?: string }; }
  const mapped = (data?.questions || []).map((q: RawQuestion) => ({ id: q.id, text: q.content, category: q.context?.source || 'AI' }));
      if (mapped.length === 0) {
        setQuestions(buildSeedQuestions(12));
      } else {
        setQuestions(mapped);
      }
    } catch (error) {
      console.error('Error generating questions:', error);
      // Fallback: sembrar preguntas por defecto para simular la interacción
      setQuestions(buildSeedQuestions(12));
    } finally {
      setGeneratingQuestions(false);
    }
  };

  // Preguntas semilla por defecto (bilingües) para simular interacción cuando el backend no responde
  function buildSeedQuestions(count = 12): Question[] {
    const topic = currentRoom?.topic || (language === 'es' ? 'Networking' : 'Networking');
    const seedsEs = [
      `¿Qué te trajo hoy a este evento?`,
      `¿Qué proyecto te emociona ahora mismo?`,
      `¿En qué estás trabajando últimamente?`,
      `¿Qué tendencia te intriga más en ${topic}?`,
      `¿Cuál fue un aprendizaje reciente que te sorprendió?`,
      `¿Qué desafío estás intentando resolver este mes?`,
      `Si pudieras colaborar con alguien aquí, ¿en qué sería?`,
      `¿Qué herramienta o idea te ha ahorrado tiempo últimamente?`,
      `¿Qué te gustaría explorar más después de este evento?`,
      `¿Qué te motivó a unirte a esta sala?`,
      `¿Qué te gustaría enseñar o compartir hoy?`,
      `¿Qué búsqueda o pregunta abierta tienes ahora mismo?`
    ];
    const seedsEn = [
      `What brought you to this event today?`,
      `What project excites you right now?`,
      `What have you been working on lately?`,
      `Which trend intrigues you most in ${topic}?`,
      `What recent learning surprised you?`,
      `What challenge are you trying to solve this month?`,
      `If you could collaborate with someone here, on what would it be?`,
      `What tool or idea saved you time recently?`,
      `What would you like to explore more after this event?`,
      `What motivated you to join this room?`,
      `What would you like to teach or share today?`,
      `What open question are you exploring right now?`
    ];
    const base = language === 'es' ? seedsEs : seedsEn;
    const out: Question[] = [];
    for (let i = 0; i < Math.max(count, base.length); i++) {
      const text = base[i % base.length];
      out.push({ id: `seed-${Date.now()}-${i}`, text, category: '🤖 AI' } as Question);
    }
    return out.slice(0, count);
  }

  // Helper: prefetch a batch of questions into queue
  const prefetchQuestionsBatch = async (count = 5) => {
    if (!eventCode || qsPrefetching) return;
    setQsPrefetching(true);
    try {
      const lastLines = liveTranscript.slice(-3).map(l => l.split('] ')[1] || l).join(' ');
      const context = [
        'ROL: Facilitador de networking. Genera preguntas breves y abiertas para romper el hielo.',
        'TONO: cercano, curioso y positivo. Evita clichés.',
        'REGLAS: ≤ 18 palabras, sin repetir preguntas. Evita: ¿Qué opinas? ¿Cómo estás? ¿A qué te dedicas?'
      ,
        `Tema de sala: ${currentRoom?.topic || 'General'}`,
        `Último fragmento transcrito: "${lastLines || (transcription || '').slice(-160)}"`
      ].join('\n');
      const { data, error } = await generateQuestionsEdge({ eventCode }, currentRoom?.id, count, context);
      if (error) throw error;
      const arr = (data?.questions || []) as Array<{ id: string; content: string; context?: { source?: string } }>;
      if (arr.length > 0) {
        const batch: Question[] = arr.map(q => ({ id: q.id, text: q.content, category: q.context?.source || '🤖 AI' } as Question));
        setQsQueue(prev => [...prev, ...batch]);
      } else {
        // Sin resultados: usar semillas para simular
        setQsQueue(prev => [...prev, ...buildSeedQuestions(count)]);
      }
    } catch {
      // Error llamando al backend: también usar semillas
      setQsQueue(prev => [...prev, ...buildSeedQuestions(count)]);
    } finally {
      setQsPrefetching(false);
    }
  };

  // On each tap: consume one from the queue; if low, prefetch in background
  const generateOneQuestionOnClick = async () => {
    try {
      // If queue is empty, prefetch and then use first
      if (qsQueue.length === 0) {
        await prefetchQuestionsBatch(5);
      }
      const next = qsQueue[0];
      if (next) {
        // consume one
        setQsQueue(prev => prev.slice(1));
        setOverlayLastQuestion(next);
        setQuestions(prev => [next, ...prev]);
        setQsClickCount(prev => prev + 1);
        // top up when running low
        if (!qsPrefetching && qsQueue.length - 1 < 2) {
          prefetchQuestionsBatch(5).catch(() => {});
        }
      } else {
        // Still nothing? fallback
        const fallback: Question = { id: `fallback-${Date.now()}`, text: language === 'es' ? '¿Qué proyecto te emociona ahora mismo?' : 'What project excites you right now?', category: '🤖 AI' };
        setOverlayLastQuestion(fallback);
        setQuestions(prev => [fallback, ...prev]);
        setQsClickCount(prev => prev + 1);
      }
      setOverlayInfo(null);
    } catch (e) {
      console.error('generateOneQuestionOnClick error:', e);
      const fallback: Question = { id: `err-${Date.now()}`, text: language === 'es' ? 'Cuéntame algo que hayas aprendido esta semana.' : 'Tell me something you learned this week.', category: '🤖 AI' };
      setOverlayLastQuestion(fallback);
      setQuestions(prev => [fallback, ...prev]);
      setQsClickCount(prev => prev + 1);
    }
  };

  const joinRoom = (room: UiRoom) => {
    setCurrentRoom(room);
    setActiveTab('questions'); // Switch to questions tab
    // Auto-generar preguntas cuando entras a la sala
    setTimeout(() => {
      generateRoomQuestions(room);
    }, 500);
  };

  const leaveRoom = () => {
    setCurrentRoom(null);
    setLiveTranscript([]);
    setIsListening(false);
  };

  const generateRoomQuestions = (room: UiRoom) => {
    // Generar preguntas basadas en los temas de la sala
    const roomQuestions = room.conversationTopics.map((topic, idx) => ({
      id: `room-q-${idx}`,
      text: language === 'es' 
        ? `¿Qué piensas sobre ${topic}?`
        : `What do you think about ${topic}?`,
      category: topic
    }));
    
    // Agregar preguntas generales
    const generalQuestions = language === 'es' ? [
      { id: 'gen-1', text: '¿Cuál es tu experiencia con este tema?', category: 'General' },
      { id: 'gen-2', text: '¿Qué te motivó a unirte a esta sala?', category: 'General' },
      { id: 'gen-3', text: '¿En qué proyecto estás trabajando actualmente?', category: 'General' }
    ] : [
      { id: 'gen-1', text: 'What\'s your experience with this topic?', category: 'General' },
      { id: 'gen-2', text: 'What motivated you to join this room?', category: 'General' },
      { id: 'gen-3', text: 'What project are you currently working on?', category: 'General' }
    ];

    setQuestions([...roomQuestions, ...generalQuestions]);
  };

  const startLiveTranscription = async () => {
    if (!('webkitSpeechRecognition' in globalThis) && !('SpeechRecognition' in globalThis)) {
      alert(language === 'es' 
        ? '⚠️ Tu navegador no soporta reconocimiento de voz. Usa Chrome o Edge.'
        : '⚠️ Your browser doesn\'t support speech recognition. Use Chrome or Edge.');
      return;
    }

    // Tipos mínimos para evitar any
    type RecognitionCtor = new () => ISpeechRecognition;
    interface ISpeechRecognition {
      start: () => void;
      stop: () => void;
      continuous: boolean;
      interimResults: boolean;
      lang: string;
      onstart: (() => void) | null;
      onresult: ((event: ISpeechRecognitionEvent) => void) | null;
      onerror: ((event: unknown) => void) | null;
      onend: (() => void) | null;
    }
    interface ISpeechRecognitionAlternative { transcript: string }
    interface ISpeechRecognitionResult { isFinal: boolean; 0: ISpeechRecognitionAlternative }
    interface ISpeechRecognitionEvent { resultIndex: number; results: ISpeechRecognitionResult[] }

  const w = globalThis as unknown as { webkitSpeechRecognition?: RecognitionCtor; SpeechRecognition?: RecognitionCtor };
    const Ctor = w.webkitSpeechRecognition || w.SpeechRecognition;
    if (!Ctor) return;
    const recognition = new Ctor();
    
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = language === 'es' ? 'es-ES' : 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
      console.log('🎤 Listening...');
    };

    recognition.onresult = (event: ISpeechRecognitionEvent) => {
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' ';
        }
      }

      if (finalTranscript) {
        const timestamp = new Date().toLocaleTimeString(language === 'es' ? 'es-ES' : 'en-US', { 
          hour: '2-digit', 
          minute: '2-digit',
          second: '2-digit'
        });
        const cleanTranscript = finalTranscript.trim();
        setLiveTranscript(prev => [...prev, `[${timestamp}] ${cleanTranscript}`]);
        
        // Generar preguntas basadas en la transcripción
        // Umbral más bajo para generar más preguntas
        if (cleanTranscript.length > 10) {
          console.log('🤖 Generando preguntas para:', cleanTranscript);
          generateQuestionFromTranscript(cleanTranscript);
        }

        // Actualizar transcription principal también
        setTranscription(prev => prev + ' ' + cleanTranscript);
      }
    };

    recognition.onerror = (err: unknown) => {
      console.error('Speech recognition error:', err);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      console.log('🎤 Stopped listening');
    };

    try {
      recognition.start();
    } catch (error) {
      console.error('Error starting recognition:', error);
    }
  };

  const stopLiveTranscription = () => {
    setIsListening(false);
    // El recognition se detendrá automáticamente
  };

  const generateQuestionFromTranscript = (transcript: string) => {
    // Generar preguntas inteligentes basadas en lo que se dijo
    const text = transcript.toLowerCase();
    const words = text.split(' ').filter(w => w.length > 4);
    
    // Palabras clave técnicas para detectar temas
    const techKeywords = ['machine', 'learning', 'artificial', 'intelligence', 'neural', 'network', 
                          'blockchain', 'startup', 'business', 'tecnología', 'inteligencia', 'proyecto'];
    
    const foundKeywords = words.filter(w => 
      techKeywords.some(key => w.includes(key) || key.includes(w))
    );

    // Generar múltiples preguntas basadas en el contexto
    const newQuestions: Question[] = [];

    // 1. Pregunta sobre la palabra clave más importante
    if (foundKeywords.length > 0) {
      const mainKeyword = foundKeywords[0];
      newQuestions.push({
        id: `ai-${Date.now()}-1`,
        text: language === 'es'
          ? `¿Cuál es tu experiencia con ${mainKeyword}?`
          : `What's your experience with ${mainKeyword}?`,
        category: '🤖 AI'
      });
    }

    // 2. Pregunta de profundización
    if (words.length > 5) {
      const lastWords = words.slice(-3).join(' ');
      newQuestions.push({
        id: `ai-${Date.now()}-2`,
        text: language === 'es'
          ? `Me interesa saber más sobre lo que mencionaste de "${lastWords}"`
          : `I'm interested to know more about what you mentioned about "${lastWords}"`,
        category: '🤖 AI'
      });
    }

    // 3. Pregunta sobre proyectos si menciona "trabajo", "proyecto", "building"
    if (text.includes('trabajo') || text.includes('proyecto') || text.includes('building') || 
        text.includes('working') || text.includes('desarrollando')) {
      newQuestions.push({
        id: `ai-${Date.now()}-3`,
        text: language === 'es'
          ? '¿En qué proyectos específicos estás trabajando actualmente?'
          : 'What specific projects are you currently working on?',
        category: '🤖 AI'
      });
    }

    // 4. Pregunta sobre desafíos si menciona problemas
    if (text.includes('problema') || text.includes('desafío') || text.includes('challenge') || 
        text.includes('difícil') || text.includes('difficult')) {
      newQuestions.push({
        id: `ai-${Date.now()}-4`,
        text: language === 'es'
          ? '¿Qué desafíos has enfrentado y cómo los resolviste?'
          : 'What challenges have you faced and how did you solve them?',
        category: '🤖 AI'
      });
    }

    // 5. Pregunta de opinión general
    if (words.length > 3) {
      newQuestions.push({
        id: `ai-${Date.now()}-5`,
        text: language === 'es'
          ? '¿Cuál es tu opinión sobre las tendencias actuales en este campo?'
          : 'What\'s your opinion on current trends in this field?',
        category: '🤖 AI'
      });
    }

    // Agregar las nuevas preguntas al inicio de la lista
    if (newQuestions.length > 0) {
      setQuestions(prev => {
        // Filtrar preguntas duplicadas
        const existingTexts = new Set(prev.map(q => q.text));
        const uniqueNew = newQuestions.filter(q => !existingTexts.has(q.text));
        return [...uniqueNew, ...prev];
      });
    }
  };

  const speakText = async (text: string) => {
    try {
      const { data, error } = await speakTextEdge(text, config.elevenlabs.voiceId);
      if (error) throw error;
      const b64 = data?.audio_base64;
      if (!b64) throw new Error('Audio vacío');
      const byteArray = Uint8Array.from(atob(b64), c => c.codePointAt(0) ?? 0);
      const blob = new Blob([byteArray], { type: data?.mime || 'audio/mpeg' });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => URL.revokeObjectURL(url);
      await audio.play();
    } catch (error) {
      console.error('Error speaking text:', error);
      alert(language === 'es'
        ? '⚠️ Error al reproducir audio. Intenta de nuevo.'
        : '⚠️ Error playing audio. Try again.');
    }
  };

  const isOrganizer = !!(eventInfo?.organizer_id && userId && eventInfo.organizer_id === userId);

  type CsvImportResponse = { inserted?: number; skipped?: number; guests?: unknown[]; emails_sent?: number; emails_attempted?: number; emails_failed?: number; email_warning?: string } | null;
  async function handleCsvSelected(file: File) {
    if (!eventCode) return;
    setCsvBusy(true);
    setCsvError(null);
    setCsvResult(null);
    try {
      const text = await file.text();
  const { data, error } = await importGuestsCsv({ eventCode, eventId: eventInfo?.id }, text);
      if (error) throw error;
  const typed: CsvImportResponse = data as CsvImportResponse;
  const inserted = typed?.inserted ?? 0;
  const skipped = typed?.skipped ?? 0;
  const emailsSent = typed?.emails_sent ?? undefined;
  const emailsAttempted = typed?.emails_attempted ?? undefined;
  const emailsFailed = typed?.emails_failed ?? undefined;
  const emailWarning = typed?.email_warning;
  setCsvResult({ inserted, skipped, emails_sent: emailsSent, emails_attempted: emailsAttempted, emails_failed: emailsFailed, email_warning: emailWarning });
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      console.error('CSV import error:', err);
      setCsvError(err.message || 'Error al importar CSV');
    } finally {
      setCsvBusy(false);
    }
  }

  async function handleStartEvent() {
    if (!eventInfo?.id) return;
    setStartingEvent(true);
    setStartMsg(null);
    setStartError(null);
    try {
      // Orquestar inicio completo (badges + rooms + pairing)
      const { data, error } = await startEventEdge(eventInfo.id, 2, 6);
      if (error) throw error;
      const assigned = data?.assigned_badges ?? 0;
      const roomsCreated = data?.rooms_created ?? 0;
      const pairs = data?.pairs_created ?? 0;
      // Refrescar estado local del evento
      setEventInfo(prev => prev ? { ...prev, status: 'published' } : prev);
  const badgesLabel = 'Badges';
  const roomsLabel = language === 'es' ? 'Salas' : 'Rooms';
  const pairsLabel = language === 'es' ? 'Pareos' : 'Pairs';
  setStartMsg(`🎫 ${badgesLabel}: ${assigned} · 🚪 ${roomsLabel}: ${roomsCreated} · 🤝 ${pairsLabel}: ${pairs}`);
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      console.error('start event error:', err);
      setStartError(err.message || 'Error al iniciar evento');
    } finally {
      setStartingEvent(false);
    }
  }

  return (
    <div className="app-container">
      {/* Language Toggle */}
      <button onClick={toggleLanguage} className="language-toggle">
        {language === 'es' ? '🇺🇸 EN' : '🇪🇸 ES'}
      </button>

      {/* Navbar */}
      <nav className="navbar glass-effect">
        <div className="nav-content">
          <div className="nav-logo">
            <img src={logoImage} alt="Connect2" className="logo-img" />
          </div>
          <div className="nav-info">
            <span className="badge badge-primary">{language === 'es' ? 'Fotocheck' : 'Badge'} #{myBadgeNumber}</span>
            <span className="event-code-badge">{eventCode}</span>
          </div>
          <div className="nav-actions">
            <button onClick={() => navigate('/')} className="btn btn-outline">
              {language === 'es' ? 'Salir del Evento' : 'Exit Event'}
            </button>
          </div>
        </div>
      </nav>

      <div className="event-page">
        {/* Header del Evento */}
        <div className="event-header glass-effect">
          <div className="event-header-content">
            {(() => {
              const base = eventInfo?.name || eventCode;
              const suffix = eventInfo ? '' : `- ${language === 'es' ? 'Networking en Vivo' : 'Live Networking'}`;
              return <h1>🎉 {base} {suffix}</h1>;
            })()}
            {eventInfo?.description && (
              <p className="event-description" style={{ margin: '0.25rem 0 0.5rem', color: 'var(--text-secondary)' }}>
                {eventInfo.description}
              </p>
            )}
            <div className="event-meta-bar">
              <div className="event-status">
                <span className="status-dot status-online"></span>
                {(() => {
                  let statusLabel = language === 'es' ? 'Borrador' : 'Draft';
                  if (eventInfo?.status === 'published') statusLabel = language === 'es' ? 'Publicado' : 'Published';
                  else if (eventInfo?.status === 'completed') statusLabel = language === 'es' ? 'Finalizado' : 'Completed';
                  return <span>{statusLabel}</span>;
                })()}
              </div>
              <div className="event-meta-extra" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <span title="Event code">🧾 {eventInfo?.code || eventCode}</span>
                {eventInfo?.date && (
                  <span title="Created at">
                    📅 {new Date(eventInfo.date).toLocaleString(language === 'es' ? 'es-ES' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' })}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="container">
          {/* Organizer-only: CSV Upload */}
          {isOrganizer && (
            <section className="glass-effect" style={{ marginBottom: '1.5rem', padding: '1rem' }}>
              <div className="section-header" style={{ marginBottom: '0.75rem' }}>
                <h2>📥 {language === 'es' ? 'Importar Invitados (CSV)' : 'Import Guests (CSV)'}</h2>
                <p style={{ color: 'var(--text-secondary)' }}>
                  {language === 'es' ? 'Sube un CSV con columnas como name, first_name, last_name, email, tags, etc.' : 'Upload a CSV with columns like name, first_name, last_name, email, tags, etc.'}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  disabled={csvBusy}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleCsvSelected(f);
                  }}
                />
                {csvBusy && <span>⏳ {language === 'es' ? 'Importando...' : 'Importing...'}</span>}
                {csvResult && (
                  <span>
                    ✅ {language === 'es' ? 'Insertados' : 'Inserted'}: {csvResult.inserted} · 💤 {language === 'es' ? 'Omitidos' : 'Skipped'}: {csvResult.skipped}
                    {typeof csvResult.emails_sent === 'number' && (
                      <> · ✉️ {language === 'es' ? 'Enviados' : 'Sent'}: {csvResult.emails_sent}</>
                    )}
                    {typeof csvResult.emails_attempted === 'number' && (
                      <> · 📤 {language === 'es' ? 'Intentados' : 'Attempted'}: {csvResult.emails_attempted}</>
                    )}
                    {typeof csvResult.emails_failed === 'number' && csvResult.emails_failed > 0 && (
                      <> · ⚠️ {language === 'es' ? 'Fallidos' : 'Failed'}: {csvResult.emails_failed}</>
                    )}
                    {csvResult.email_warning && (
                      <> · ⚠️ {csvResult.email_warning}</>
                    )}
                  </span>
                )}
                {csvError && (
                  <span style={{ color: '#ef4444' }}>⚠️ {csvError}</span>
                )}
                <div style={{ flex: 1 }} />
                <button
                  className="btn btn-primary"
                  onClick={handleStartEvent}
                  disabled={startingEvent}
                  title={language === 'es' ? 'Asigna números de badge 1..N y cambia el estado a Publicado' : 'Assign badge numbers 1..N and set status to Published'}
                >
                  {startingEvent ? (language === 'es' ? '⏳ Iniciando...' : '⏳ Starting...') : (language === 'es' ? '🚦 Iniciar Evento y Asignar Badges' : '🚦 Start Event & Assign Badges')}
                </button>
                {startMsg && <span style={{ color: '#10b981' }}>✅ {startMsg}</span>}
                {startError && <span style={{ color: '#ef4444' }}>⚠️ {startError}</span>}
              </div>
            </section>
          )}
          {/* Room Banner - Shown when in a room */}
          {currentRoom && (
            <div className="glass-effect" style={{ 
              padding: '1.5rem', 
              marginBottom: '2rem', 
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(168, 85, 247, 0.1))',
              border: '2px solid rgba(99, 102, 241, 0.3)',
              borderRadius: 'var(--radius-lg)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
                    <h3 style={{ margin: 0, fontSize: '1.5rem' }}>🚪 {currentRoom.name}</h3>
                    <span className="badge badge-primary" style={{ animation: 'pulse 2s infinite' }}>
                      {language === 'es' ? 'En la sala' : 'In room'}
                    </span>
                  </div>
                  <p style={{ margin: '0.5rem 0', color: 'var(--text-secondary)' }}>
                    <strong>{language === 'es' ? 'Tema:' : 'Topic:'}</strong> {currentRoom.topic}
                  </p>
                  <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                    <span>👥 {currentRoom.participants.length} {language === 'es' ? 'personas' : 'people'}</span>
                    <span>💬 {currentRoom.conversationTopics.length} {language === 'es' ? 'temas' : 'topics'}</span>
                  </div>
                </div>
                <button 
                  onClick={leaveRoom}
                  className="btn btn-outline"
                  style={{ whiteSpace: 'nowrap' }}
                >
                  ← {language === 'es' ? 'Salir de la Sala' : 'Leave Room'}
                </button>
              </div>
              
              {/* Participants in room */}
              <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius-md)' }}>
                <strong>{language === 'es' ? 'Participantes:' : 'Participants:'}</strong>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                  {currentRoom.participants.map((participant) => (
                    <span key={participant} className="badge badge-secondary">
                      👤 {participant}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Tabs Navigation */}
          <div className="event-tabs glass-effect">
            <button 
              className={`tab-btn ${activeTab === 'search' ? 'active' : ''}`}
              onClick={() => setActiveTab('search')}
            >
              🔍 {language === 'es' ? 'Buscar Match' : 'Find Match'}
            </button>
            <button 
              className={`tab-btn ${activeTab === 'rooms' ? 'active' : ''}`}
              onClick={() => { setActiveTab('rooms'); fetchRooms(); }}
            >
              🚪 {language === 'es' ? 'Salas de Networking' : 'Networking Rooms'}
            </button>
            <button 
              className={`tab-btn ${activeTab === 'questions' ? 'active' : ''}`}
              onClick={() => setActiveTab('questions')}
            >
              💬 {language === 'es' ? 'Iniciadores de Conversación' : 'Conversation Starters'}
            </button>
          </div>

          {/* Tab: Search Match */}
          {activeTab === 'search' && (
            <section className="tab-content">
              {/* Automatic match suggestion */}
              <div className="glass-effect" style={{ marginBottom: '1rem', padding: '1rem' }}>
                <div className="section-header">
                  <h2>{language === 'es' ? 'Sugerencia Automática de Match' : 'Automatic Match Suggestion'}</h2>
                  <p style={{ color: 'var(--text-secondary)' }}>
                    {language === 'es' ? 'Basado en tu sala actual te sugerimos hablar con:' : 'Based on your current room we suggest you talk to:'}
                  </p>
                </div>
                {autoLoading && <span>⏳ {language === 'es' ? 'Buscando...' : 'Searching...'}</span>}
                {!autoLoading && roomMates.length === 0 && (
                  <span>🕵️ {language === 'es' ? 'No hay compañeros de sala aún.' : 'No room mates yet.'}</span>
                )}
                {!autoLoading && roomMates.length > 0 && (
                  <div style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))' }}>
                    {roomMates.map(m => (
                      <div key={m.id} className="glass-effect" style={{ padding: '0.75rem', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', position: 'relative' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                          <span style={{ fontSize: '1.25rem' }}>👤</span>
                          <div style={{ flex: 1 }}>
                            <strong style={{ display: 'block' }}>{m.name}</strong>
                            {typeof m.badge === 'number' && (
                              <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>{language === 'es' ? 'Fotocheck' : 'Badge'} #{m.badge}</span>
                            )}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            onClick={() => toggleFoundForMate(m.badge, m.found)}
                            className={`btn ${m.found ? 'btn-success' : 'btn-outline'}`}
                            style={{ flex: 1 }}
                          >
                            {m.found ? (language === 'es' ? '✅ Encontrado' : '✅ Found') : (language === 'es' ? 'Marcar Encontrado' : 'Mark Found')}
                          </button>
                          {m.found && (
                            <button
                              onClick={() => toggleFoundForMate(m.badge, m.found)}
                              className="btn btn-danger"
                              style={{ flex: 1 }}
                            >
                              {language === 'es' ? '❌ Revertir' : '❌ Undo'}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="search-section glass-effect">
                <div className="section-header">
                  <h2>{language === 'es' ? 'Encuentra tu Match de Networking' : 'Find Your Networking Match'}</h2>
                  <p>{language === 'es' ? 'Ingresa el número de badge del fotocheck de alguien para conectar' : "Enter the badge number from someone's fotocheck to connect"}</p>
                </div>
                
                <div className="search-input-group">
                  <div className="input-group">
                    <input
                      type="text"
                      value={searchNumber}
                      onChange={(e) => setSearchNumber(e.target.value)}
                      placeholder={language === 'es' ? 'Número de badge (ej., 15)' : 'Badge number (e.g., 15)'}
                    />
                    <span className="input-icon">🎫</span>
                  </div>
                  <button onClick={handleSearchGuest} className="btn btn-primary btn-large">
                    {language === 'es' ? 'Buscar Match' : 'Search Match'}
                  </button>
                </div>

                {matchFound && matchedPerson && (
                  <div className="match-found glass-effect">
                    <div className="match-header">
                      <div className="match-icon">✅</div>
                      <h3>{language === 'es' ? '¡Match Encontrado!' : 'Match Found!'}</h3>
                    </div>
                    <div className="match-details">
                      <div className="match-person">
                        <div className="person-avatar">👤</div>
                        <div className="person-info">
                          <h4>{matchedPerson.name}</h4>
                          <p>{language === 'es' ? 'Fotocheck' : 'Badge'} #{matchedPerson.number}</p>
                        </div>
                      </div>
                      <div className="match-interests">
                        <h5>{language === 'es' ? 'Intereses:' : 'Interests:'}</h5>
                        <div className="interests-tags">
                          {matchedPerson.interests.map((interest) => (
                            <span key={interest} className="badge badge-secondary">{interest}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <p className="match-message">
                      {language === 'es' 
                        ? '¡Genial! Ahora puedes comenzar a hacer networking. ¡Revisa los iniciadores de conversación abajo!'
                        : 'Great! You can now start networking. Check the conversation starters below!'}
                    </p>
                    <button 
                      onClick={() => setActiveTab('questions')} 
                      className="btn btn-primary"
                    >
                      {language === 'es' ? 'Ver Iniciadores de Conversación →' : 'View Conversation Starters →'}
                    </button>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Tab: Networking Rooms */}
          {activeTab === 'rooms' && (
            <section className="tab-content">
              <div className="rooms-section">
                <div className="section-header">
                  <h2>{language === 'es' ? 'Salas de Networking' : 'Networking Rooms'}</h2>
                  <p>{language === 'es' 
                    ? 'Salas generadas por IA basadas en intereses de asistentes. ¡Únete a una sala para ver temas de conversación!'
                    : 'AI-generated rooms based on attendee interests. Join a room to see conversation topics!'}</p>
                </div>
                
                <div className="rooms-grid">
                  {rooms.length === 0 ? (
                    <div className="empty-state glass-effect">
                      <div className="empty-icon">🚪</div>
                      <h3>{language === 'es' ? 'Cargando Salas...' : 'Loading Rooms...'}</h3>
                      <p>{language === 'es' 
                        ? 'Generando salas óptimas de networking basadas en perfiles de asistentes'
                        : 'Generating optimal networking rooms based on attendee profiles'}</p>
                    </div>
                  ) : (
                    rooms.map((room, idx) => (
                      <div key={room.id} className="room-card glass-effect card-hover">
                        <div className="room-header">
                          <h3>{room.name}</h3>
                          <span className="badge badge-primary">
                            {room.participants.length} {language === 'es' ? 'asistiendo' : 'attending'}
                          </span>
                        </div>
                        <div className="room-body">
                          <p style={{ margin: '0 0 0.5rem 0', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                            {language === 'es'
                              ? `Sala ${idx + 1} -> ${room.participants.join(', ')} hablando de ${room.topic}`
                              : `Room ${idx + 1} -> ${room.participants.join(', ')} discussing ${room.topic}`}
                          </p>
                          <p className="room-topic">
                            <strong>{language === 'es' ? 'Tema Principal:' : 'Main Topic:'}</strong> {room.topic}
                          </p>
                          <div className="room-topics">
                            <strong>{language === 'es' ? 'Puntos de Discusión:' : 'Discussion Points:'}</strong>
                            <div className="topics-tags">
                              {room.conversationTopics.map((topic) => (
                                <span key={topic} className="topic-tag">{topic}</span>
                              ))}
                            </div>
                          </div>
                          <div className="room-participants">
                            <strong>{language === 'es' ? 'Participantes:' : 'Participants:'}</strong>
                            <p>{room.participants.join(', ')}</p>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                          <button 
                            className="btn btn-outline"
                            style={{ flex: '1' }}
                            onClick={() => {
                              const topicLabel = language === 'es' ? 'Tema' : 'Topic';
                              const participantsLabel = language === 'es' ? 'Participantes' : 'Participants';
                              const discussionLabel = language === 'es' ? 'Puntos de Discusión' : 'Discussion Points';
                              const topicsList = room.conversationTopics.map(t => `• ${t}`).join('\n');
                              const details = [
                                `🚪 ${room.name}`,
                                ``,
                                `📋 ${topicLabel}: ${room.topic}`,
                                ``,
                                `👥 ${participantsLabel}: ${room.participants.join(', ')}`,
                                ``,
                                `💬 ${discussionLabel}:`,
                                topicsList
                              ].join('\n');
                              alert(details);
                            }}
                          >
                            {language === 'es' ? 'Ver Detalles' : 'View Details'}
                          </button>
                          <button 
                            className="btn btn-primary"
                            style={{ flex: '1' }}
                            onClick={() => joinRoom(room)}
                          >
                            {language === 'es' ? '🚪 Unirse' : '🚪 Join Room'}
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>
          )}

          {/* Tab: Conversation Starters */}
          {activeTab === 'questions' && (
            <section className="tab-content">
              {/* Fullscreen Overlay for rapid-fire questions */}
              {showQsOverlay && (
                <div
                  onClick={generateOneQuestionOnClick}
                  style={{
                    position: 'fixed', inset: 0, zIndex: 9999,
                    background: 'rgba(10,10,14,0.96)', color: 'white',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    textAlign: 'center', padding: '2rem', cursor: 'pointer'
                  }}
                >
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowQsOverlay(false); }}
                    className="btn btn-outline"
                    style={{ position: 'absolute', top: 16, right: 16 }}
                    aria-label={language === 'es' ? 'Cerrar' : 'Close'}
                  >
                    ✕
                  </button>
                  <div style={{ maxWidth: 900 }}>
                    <div style={{ opacity: 0.85, marginBottom: '1rem', fontSize: '0.95rem' }}>
                      {overlayInfo || (language === 'es' ? 'Toca para generar una nueva pregunta' : 'Tap to generate a new question')}
                    </div>
                    <div style={{ fontSize: '2rem', lineHeight: 1.3, fontWeight: 700 }}>
                      {overlayLastQuestion?.text || (language === 'es' ? '¡Listo para romper el hielo! Toca para la primera pregunta.' : 'Ready to break the ice! Tap for the first question.')}
                    </div>
                    <div style={{ opacity: 0.7, marginTop: '1rem', fontSize: '0.9rem' }}>
                      {language === 'es' ? `Preguntas generadas: ${qsClickCount}` : `Questions generated: ${qsClickCount}`}
                    </div>
                  </div>
                </div>
              )}
              {/* Live Transcription - Only in room */}
              {currentRoom && (
                <div className="glass-effect" style={{ 
                  marginBottom: '2rem', 
                  padding: '2rem',
                  background: isListening ? 'rgba(16, 185, 129, 0.05)' : 'rgba(255,255,255,0.02)'
                }}>
                  <div className="section-header">
                    <h2>🎤 {language === 'es' ? 'Transcriptor en Vivo' : 'Live Transcription'}</h2>
                    <p>{language === 'es' 
                      ? 'El AI está escuchando y generará preguntas automáticamente'
                      : 'AI is listening and will generate questions automatically'}</p>
                  </div>

                  <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                    {isListening ? (
                      <button
                        onClick={stopLiveTranscription}
                        className="btn btn-outline btn-large"
                        style={{ flex: 1, animation: 'pulse 2s infinite' }}
                      >
                        ⏸️ {language === 'es' ? 'Detener Transcripción' : 'Stop Transcription'}
                      </button>
                    ) : (
                      <button
                        onClick={startLiveTranscription}
                        className="btn btn-primary btn-large"
                        style={{ flex: 1 }}
                      >
                        🎙️ {language === 'es' ? 'Iniciar Transcripción' : 'Start Transcription'}
                      </button>
                    )}
                  </div>

                  {/* Live Transcript Display */}
                  {liveTranscript.length > 0 && (
                    <div>
                      <div style={{ 
                        maxHeight: '300px', 
                        overflowY: 'auto', 
                        background: 'rgba(0,0,0,0.3)', 
                        padding: '1rem', 
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-light)',
                        marginBottom: '1rem'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                          <h4 style={{ margin: 0 }}>
                            {language === 'es' ? '📝 Transcripción:' : '📝 Transcript:'}
                          </h4>
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                            {liveTranscript.length} {language === 'es' ? 'mensajes' : 'messages'}
                          </span>
                        </div>
                        {liveTranscript.map((line, idx) => (
                          <div key={`${idx}-${line.slice(0, 12)}`} style={{ 
                            marginBottom: '0.5rem', 
                            padding: '0.5rem',
                            background: 'rgba(99, 102, 241, 0.1)',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: '0.9rem',
                            animation: 'fadeIn 0.3s ease-in'
                          }}>
                            {line}
                          </div>
                        ))}
                      </div>
                      
                      {/* Botón para regenerar preguntas de toda la transcripción */}
                      <button
                        onClick={() => {
                          const fullTranscript = liveTranscript.map(l => l.split('] ')[1] || l).join(' ');
                          generateQuestionFromTranscript(fullTranscript);
                          alert(language === 'es' 
                            ? '✨ Preguntas actualizadas basadas en toda la conversación!'
                            : '✨ Questions updated based on full conversation!');
                        }}
                        className="btn btn-secondary"
                        style={{ width: '100%' }}
                      >
                        ✨ {language === 'es' 
                          ? 'Regenerar Preguntas de Toda la Conversación' 
                          : 'Regenerate Questions from Full Conversation'}
                      </button>
                    </div>
                  )}

                  {isListening && (
                    <div style={{ 
                      textAlign: 'center', 
                      marginTop: '1rem', 
                      padding: '1rem',
                      background: 'rgba(16, 185, 129, 0.1)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid rgba(16, 185, 129, 0.3)'
                    }}>
                      <span style={{ fontSize: '2rem', animation: 'pulse 1s infinite' }}>🎤</span>
                      <p style={{ margin: '0.5rem 0 0 0', color: '#10b981', fontWeight: 'bold' }}>
                        {language === 'es' ? 'Escuchando... Habla ahora' : 'Listening... Speak now'}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Transcripción y Grabación */}
              <div className="recording-section glass-effect">
                <div className="section-header">
                  <h2>🎤 {language === 'es' ? 'Transcripción de Charla' : 'Talk Transcription'}</h2>
                  <p>{language === 'es' 
                    ? 'Graba tu conversación para generar preguntas personalizadas'
                    : 'Record your conversation to generate personalized questions'}</p>
                </div>
                
                {(() => {
                  const recordingLabel = isRecording
                    ? (language === 'es' ? '⏺️ Grabando...' : '⏺️ Recording...')
                    : (language === 'es' ? '🎙️ Iniciar Grabación' : '🎙️ Start Recording');
                  const recordingClass = isRecording ? 'btn-recording pulse' : 'btn-primary';
                  return (
                    <button
                      onClick={startRecording}
                      className={`btn btn-large ${recordingClass}`}
                    >
                      {recordingLabel}
                    </button>
                  );
                })()}

                {transcription && (
                  <div className="transcript glass-effect">
                    <h4>{language === 'es' ? 'Transcripción:' : 'Transcription:'}</h4>
                    <p>{transcription}</p>
                    <button 
                      onClick={() => generateQuestions(transcription)}
                      className="btn btn-secondary"
                    >
                      {language === 'es' 
                        ? 'Generar Preguntas de esta conversación'
                        : 'Generate Questions from this conversation'}
                    </button>
                  </div>
                )}
              </div>

              {/* Preguntas Generadas */}
              <div className="questions-section glass-effect">
                <div className="section-header">
                  <h2>💬 {language === 'es' ? 'Iniciadores de Conversación' : 'Conversation Starters'}</h2>
                  <p>{language === 'es' 
                    ? 'Preguntas generadas por IA adaptadas a tu conversación en tiempo real'
                    : 'AI-generated questions tailored to your conversation in real-time'}</p>
                  {currentRoom && (
                    <div style={{ 
                      padding: '0.75rem', 
                      background: 'rgba(16, 185, 129, 0.1)', 
                      borderRadius: 'var(--radius-md)',
                      marginTop: '0.5rem',
                      fontSize: '0.9rem',
                      border: '1px solid rgba(16, 185, 129, 0.3)'
                    }}>
                      ℹ️ {language === 'es'
                        ? 'Las preguntas se actualizan automáticamente mientras hablas. Las nuevas preguntas aparecen arriba con el icono 🤖'
                        : 'Questions update automatically as you speak. New questions appear at the top with 🤖 icon'}
                    </div>
                  )}
                  <button 
                    onClick={() => generateQuestions()}
                    className="btn btn-outline"
                    disabled={generatingQuestions}
                  >
                    {(() => {
                      if (generatingQuestions) {
                        return language === 'es' ? '⏳ Generando...' : '⏳ Generating...';
                      }
                      return language === 'es' ? '✨ Generar Nuevas Preguntas' : '✨ Generate New Questions';
                    })()}
                  </button>
                </div>

                {questions.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">💭</div>
                    <h3>{language === 'es' ? 'Aún no hay preguntas' : 'No questions yet'}</h3>
                    <p>{language === 'es' 
                      ? '¡Encuentra un match o graba una conversación para generar preguntas personalizadas!'
                      : 'Find a match or record a conversation to generate personalized questions!'}</p>
                  </div>
                ) : (
                  <div className="questions-list">
                    {questions.map((question) => (
                      <div key={question.id} className="question-card glass-effect">
                        <div className="question-content">
                          <span className="question-category badge badge-secondary">
                            {question.category}
                          </span>
                          <p className="question-text">{question.text}</p>
                        </div>
                        <div className="question-actions">
                          <button
                            onClick={() => speakText(question.text)}
                            className="btn btn-icon"
                            title="Speak this question"
                          >
                            🔊
                          </button>
                          <button
                            className="btn btn-icon"
                            title="Copy to clipboard"
                            onClick={() => navigator.clipboard.writeText(question.text)}
                          >
                            📋
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}

        </div>
      </div>
    </div>
  );
}