import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import logoImage from '../assets/logo.png';
import { useLanguage } from '../lib/LanguageContext';
import { speakText as speakTextEdge, generateRooms as generateRoomsEdge, searchGuest as searchGuestEdge, generateQuestions as generateQuestionsEdge, transcribeTalk as transcribeTalkEdge, getEventByCode, getCurrentUser, importGuestsCsv, startEvent as startEventEdge, type Event as UiEvent } from '../lib/supabase';
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

interface VirtualPerson {
  id: string;
  name: string;
  avatar: string;
  greeting: string;
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
  const [virtualPerson, setVirtualPerson] = useState<VirtualPerson | null>(null);
  const [showVirtualAssistant, setShowVirtualAssistant] = useState(false);
  const [generatingQuestions, setGeneratingQuestions] = useState(false);
  const [activeTab, setActiveTab] = useState<'search' | 'rooms' | 'questions'>('search');
  const [currentRoom, setCurrentRoom] = useState<UiRoom | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState<string[]>([]);
  const [eventInfo, setEventInfo] = useState<UiEvent | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [csvBusy, setCsvBusy] = useState(false);
  const [csvResult, setCsvResult] = useState<{inserted: number; skipped: number} | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [startingEvent, setStartingEvent] = useState(false);
  const [startMsg, setStartMsg] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);

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
    if (!eventCode) return;
    try {
      const { data, error } = await generateRoomsEdge({ eventCode }, 5);
      if (error) throw error;
  const rawRooms = Array.isArray(data?.rooms) ? (data?.rooms as unknown[]) : [];
  const uiRooms: UiRoom[] = rawRooms.map((r, idx) => formatRoom(r as Record<string, unknown>, idx));
      setRooms(uiRooms);
    } catch (error) {
      console.error('Error fetching rooms:', error);
    }
  };

  function formatRoom(roomObj: Record<string, unknown>, idx: number): UiRoom {
  const topicsSource = roomObj.conversation_topics ?? roomObj.topics;
    let conversationTopics: string[] = [];
    if (Array.isArray(topicsSource)) {
      conversationTopics = topicsSource.filter((t): t is string => typeof t === 'string');
    } else if (typeof topicsSource === 'string') {
      conversationTopics = topicsSource.split(',').map(t => t.trim()).filter(Boolean);
    }
    const participantsRaw = roomObj.participants;
    const participants = Array.isArray(participantsRaw)
      ? participantsRaw.filter((p): p is string => typeof p === 'string')
      : [];
    return {
      id: (roomObj.id as string) || (roomObj.room_id as string) || `room-${idx}`,
      name: (roomObj.name as string) || (roomObj.title as string) || `Room ${idx + 1}`,
      topic: (roomObj.topic as string) || (roomObj.main_topic as string) || (roomObj.theme as string) || 'General',
      participants,
      conversationTopics
    };
  }

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

  const generateRooms = async () => {
    try {
      if (!eventCode) return;
      const { data, error } = await generateRoomsEdge({ eventCode }, 5);
      if (error) throw error;
      const rawRooms = data?.rooms || [];
      const uiRooms: UiRoom[] = rawRooms.map((r: unknown, idx: number) => {
        const roomObj = r as Record<string, unknown>;
        const topicsSource = roomObj.conversation_topics || roomObj.topics;
        let conversationTopics: string[] = [];
        if (Array.isArray(topicsSource)) {
          conversationTopics = topicsSource.filter((t: unknown): t is string => typeof t === 'string');
        } else if (typeof topicsSource === 'string') {
          conversationTopics = topicsSource.split(',').map((t) => t.trim()).filter(Boolean);
        }
        return {
          id: (roomObj.id as string) || (roomObj.room_id as string) || `room-${idx}`,
          name: (roomObj.name as string) || (roomObj.title as string) || `Room ${idx + 1}`,
          topic: (roomObj.topic as string) || (roomObj.main_topic as string) || (roomObj.theme as string) || 'General',
          participants: Array.isArray(roomObj.participants)
            ? (roomObj.participants as unknown[]).filter((p: unknown): p is string => typeof p === 'string')
            : [],
          conversationTopics
        };
      });
      setRooms(uiRooms);
    } catch (error) {
      console.error('Error generating rooms:', error);
    }
  };

  const createVirtualPerson = async () => {
    try {
      const greeting = language === 'es'
        ? '¡Hola! Soy Alex, tu asistente virtual. Estoy aquí para ayudarte a conectar con las personas ideales en este evento. ¿En qué puedo ayudarte?'
        : 'Hello! I\'m Alex, your virtual assistant. I\'m here to help you connect with the right people at this event. How can I help you?';
      
      setVirtualPerson({
        id: '1',
        name: 'Alex AI',
        avatar: '🤖',
        greeting: greeting
      });
      setShowVirtualAssistant(true);
    } catch (error) {
      console.error('Error creating virtual person:', error);
    }
  };

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
      setQuestions(mapped);
    } catch (error) {
      console.error('Error generating questions:', error);
    } finally {
      setGeneratingQuestions(false);
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

  type CsvImportResponse = { inserted?: number; skipped?: number; guests?: unknown[] } | null;
  async function handleCsvSelected(file: File) {
    if (!eventCode) return;
    setCsvBusy(true);
    setCsvError(null);
    setCsvResult(null);
    try {
      const text = await file.text();
      const { data, error } = await importGuestsCsv(eventCode, text);
      if (error) throw error;
      const typed: CsvImportResponse = data as CsvImportResponse;
      const inserted = typed?.inserted ?? 0;
      const skipped = typed?.skipped ?? 0;
      setCsvResult({ inserted, skipped });
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
      setStartMsg(`🎫 ${language === 'es' ? 'Badges' : 'Badges'}: ${assigned} · 🚪 ${language === 'es' ? 'Salas' : 'Rooms'}: ${roomsCreated} · 🤝 ${language === 'es' ? 'Pareos' : 'Pairs'}: ${pairs}`);
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
            <span className="badge badge-primary">Badge #{myBadgeNumber}</span>
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
              <button onClick={createVirtualPerson} className="btn btn-glass">
                <span>🤖</span> {language === 'es' ? 'Asistente Virtual' : 'Virtual Assistant'}
              </button>
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
              onClick={() => { setActiveTab('rooms'); generateRooms(); }}
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
                          <p>Badge #{matchedPerson.number}</p>
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
                    rooms.map((room) => (
                      <div key={room.id} className="room-card glass-effect card-hover">
                        <div className="room-header">
                          <h3>{room.name}</h3>
                          <span className="badge badge-primary">
                            {room.participants.length} {language === 'es' ? 'asistiendo' : 'attending'}
                          </span>
                        </div>
                        <div className="room-body">
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

          {/* Virtual Assistant Modal */}
          {showVirtualAssistant && virtualPerson && (
            <div
              className="modal-overlay"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') setShowVirtualAssistant(false) }}
              onClick={() => setShowVirtualAssistant(false)}
            >
              <div
                className="modal glass-effect"
                role="dialog"
                aria-modal="true"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="modal-header">
                  <h2>{language === 'es' ? 'Asistente Virtual' : 'Virtual Assistant'}</h2>
                  <button 
                    className="modal-close"
                    onClick={() => setShowVirtualAssistant(false)}
                  >
                    ✕
                  </button>
                </div>
                <div className="modal-body">
                  <div className="virtual-person">
                    <div className="avatar-large">{virtualPerson.avatar}</div>
                    <h3>{virtualPerson.name}</h3>
                    <p>{virtualPerson.greeting}</p>
                    <button 
                      onClick={() => speakText(virtualPerson.greeting)}
                      className="btn btn-primary"
                    >
                      🔊 {language === 'es' ? 'Escuchar Saludo' : 'Hear Greeting'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}