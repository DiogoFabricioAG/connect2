import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import logoImage from '../assets/logo.png';
import { useLanguage } from '../lib/LanguageContext';

interface Room {
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
  const [rooms, setRooms] = useState<Room[]>([]);
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
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState<string[]>([]);

  useEffect(() => {
    // Cargar salas existentes al montar el componente
    fetchRooms();
  }, [eventCode]);

  const fetchRooms = async () => {
    try {
      const response = await fetch(`/api/generate-rooms/${eventCode}`);
      const data = await response.json();
      setRooms(data.rooms);
    } catch (error) {
      console.error('Error fetching rooms:', error);
    }
  };

  const handleSearchGuest = async () => {
    try {
      const response = await fetch(`/api/search-guest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          eventCode,
          searchNumber,
        }),
      });
      const data = await response.json();
      setMatchFound(data.found);
      
      if (data.found) {
        setMatchedPerson({
          number: parseInt(searchNumber),
          name: data.name || `Person #${searchNumber}`,
          interests: data.interests || ['Networking', 'Tech'],
          matched: true
        });
        // Generar preguntas automáticamente al encontrar match
        await generateQuestions(data.context || '');
      }
    } catch (error) {
      console.error('Error searching for guest:', error);
      // Mock para demostración
      setMatchFound(true);
      setMatchedPerson({
        number: parseInt(searchNumber),
        name: `Sarah Johnson`,
        interests: ['AI', 'Startups', 'Innovation'],
        matched: true
      });
      // Generar preguntas mock
      setQuestions([
        { id: '1', text: '¿Qué aspecto de la inteligencia artificial te apasiona más?', category: 'AI' },
        { id: '2', text: '¿En qué startup o proyecto estás trabajando actualmente?', category: 'Startups' },
        { id: '3', text: '¿Cuál crees que será la próxima gran innovación en tech?', category: 'Innovation' }
      ]);
    }
  };

  const generateRooms = async () => {
    try {
      const response = await fetch(`/api/generate-rooms/${eventCode}`);
      const data = await response.json();
      setRooms(data.rooms);
    } catch (error) {
      console.error('Error generating rooms:', error);
      // Mock data
      setRooms([
        {
          id: '1',
          name: 'AI & Machine Learning',
          topic: 'Latest trends in AI development',
          participants: ['Alice', 'Bob', 'Charlie'],
          conversationTopics: ['GPT-4', 'Neural Networks', 'AutoML']
        },
        {
          id: '2',
          name: 'Startup Ecosystem',
          topic: 'Building successful startups',
          participants: ['David', 'Emma'],
          conversationTopics: ['Fundraising', 'Product-Market Fit', 'Scaling']
        },
        {
          id: '3',
          name: 'Web3 & Blockchain',
          topic: 'Decentralized future',
          participants: ['Frank', 'Grace', 'Henry', 'Ivy'],
          conversationTopics: ['DeFi', 'NFTs', 'Smart Contracts']
        }
      ]);
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
      const response = await fetch(`/api/transcribe-talk/${eventCode}`, {
        method: 'POST',
      });
      const data = await response.json();
      setTranscription(data.text);
      await generateQuestions(data.text);
    } catch (error) {
      console.error('Error recording:', error);
    } finally {
      setIsRecording(false);
    }
  };

  const generateQuestions = async (context: string = '') => {
    setGeneratingQuestions(true);
    try {
      const response = await fetch(`/api/generate-questions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          eventCode,
          context: context || transcription,
        }),
      });
      const data = await response.json();
      setQuestions(data.questions);
    } catch (error) {
      console.error('Error generating questions:', error);
    } finally {
      setGeneratingQuestions(false);
    }
  };

  const joinRoom = (room: Room) => {
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

  const generateRoomQuestions = (room: Room) => {
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
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert(language === 'es' 
        ? '⚠️ Tu navegador no soporta reconocimiento de voz. Usa Chrome o Edge.'
        : '⚠️ Your browser doesn\'t support speech recognition. Use Chrome or Edge.');
      return;
    }

    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = language === 'es' ? 'es-ES' : 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
      console.log('🎤 Listening...');
    };

    recognition.onresult = (event: any) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' ';
        } else {
          interimTranscript += transcript;
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

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
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
      // Llamar directamente a ElevenLabs API
      const ELEVENLABS_API_KEY = 'sk_156d850d871c3711ec6a4c492f687830866e1535d1a125b8';
      const VOICE_ID = '21m00Tcm4TlvDq8ikWAM'; // Rachel voice
      
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`, {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': ELEVENLABS_API_KEY
        },
        body: JSON.stringify({
          text: text,
          model_id: 'eleven_monolingual_v1',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.5
          }
        })
      });
      
      if (!response.ok) {
        throw new Error(`ElevenLabs API error: ${response.status}`);
      }
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      
      audio.onended = () => {
        URL.revokeObjectURL(url);
      };
      
      audio.play();
      
      console.log('🔊 Playing audio...');
    } catch (error) {
      console.error('Error speaking text:', error);
      alert(language === 'es' 
        ? '⚠️ Error al reproducir audio. Por favor intenta de nuevo.'
        : '⚠️ Error playing audio. Please try again.');
    }
  };

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
            <h1>🎉 {eventCode} - {language === 'es' ? 'Networking en Vivo' : 'Live Networking'}</h1>
            <div className="event-meta-bar">
              <div className="event-status">
                <span className="status-dot status-online"></span>
                <span>{language === 'es' ? 'En Vivo Ahora' : 'Live Now'}</span>
              </div>
              <button onClick={createVirtualPerson} className="btn btn-glass">
                <span>🤖</span> {language === 'es' ? 'Asistente Virtual' : 'Virtual Assistant'}
              </button>
            </div>
          </div>
        </div>

        <div className="container">
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
                  {currentRoom.participants.map((participant, idx) => (
                    <span key={idx} className="badge badge-secondary">
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
                          {matchedPerson.interests.map((interest, idx) => (
                            <span key={idx} className="badge badge-secondary">{interest}</span>
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
                              {room.conversationTopics.map((topic, idx) => (
                                <span key={idx} className="topic-tag">{topic}</span>
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
                              alert(`🚪 ${room.name}\n\n📋 ${topicLabel}: ${room.topic}\n\n👥 ${participantsLabel}: ${room.participants.join(', ')}\n\n💬 ${discussionLabel}:\n${room.conversationTopics.map(t => `• ${t}`).join('\n')}`);
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
                    {!isListening ? (
                      <button
                        onClick={startLiveTranscription}
                        className="btn btn-primary btn-large"
                        style={{ flex: 1 }}
                      >
                        🎙️ {language === 'es' ? 'Iniciar Transcripción' : 'Start Transcription'}
                      </button>
                    ) : (
                      <button
                        onClick={stopLiveTranscription}
                        className="btn btn-outline btn-large"
                        style={{ flex: 1, animation: 'pulse 2s infinite' }}
                      >
                        ⏸️ {language === 'es' ? 'Detener Transcripción' : 'Stop Transcription'}
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
                          <div key={idx} style={{ 
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
                
                <button
                  onClick={startRecording}
                  className={`btn btn-large ${isRecording ? 'btn-recording pulse' : 'btn-primary'}`}
                >
                  {isRecording 
                    ? (language === 'es' ? '⏺️ Grabando...' : '⏺️ Recording...') 
                    : (language === 'es' ? '🎙️ Iniciar Grabación' : '🎙️ Start Recording')}
                </button>

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
                    {generatingQuestions 
                      ? (language === 'es' ? '⏳ Generando...' : '⏳ Generating...') 
                      : (language === 'es' ? '✨ Generar Nuevas Preguntas' : '✨ Generate New Questions')}
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
            <div className="modal-overlay" onClick={() => setShowVirtualAssistant(false)}>
              <div className="modal glass-effect" onClick={(e) => e.stopPropagation()}>
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