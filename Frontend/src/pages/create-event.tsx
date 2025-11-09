import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createEvent, getCurrentUser } from '../lib/supabase';
import { useLanguage } from '../lib/LanguageContext';

interface EventFormData {
  title: string;
  description: string;
  date: string;
  lumaId: string;
  speakerInfo: string;
}

// Generar código único de 6 caracteres
const generateEventCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

export function CreateEventPage() {
  const navigate = useNavigate();
  const { language, toggleLanguage } = useLanguage();
  
  const [formData, setFormData] = useState<EventFormData>({
    title: '',
    description: '',
    date: '',
    lumaId: '',
    speakerInfo: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successCode, setSuccessCode] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      // Verificar que el usuario esté autenticado
      const { user } = await getCurrentUser();
      if (!user) {
        setError(language === 'es' ? 'Debes iniciar sesión para crear un evento' : 'You must be logged in to create an event');
        setLoading(false);
        return;
      }

      // Generar código único para el evento
      const eventCode = generateEventCode();
      
      // Crear evento en Supabase
      const eventData = {
        code: eventCode,
        name: formData.title,
        description: formData.description,
        date: formData.date,
        luma_event_id: formData.lumaId,
        speaker_info: {
          bio: formData.speakerInfo,
          topics: []
        },
        status: 'published' as const,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { error: createError } = await createEvent(eventData);
      
      if (createError) {
        throw createError;
      }

      // Mostrar código del evento
      setSuccessCode(eventCode);
      
      // Redirigir a eventos después de 3 segundos
      setTimeout(() => {
        navigate('/events');
      }, 3000);
      
    } catch (err: any) {
      console.error('Error creating event:', err);
      setError(language === 'es' 
        ? 'Error al crear el evento. Por favor intenta de nuevo.' 
        : 'Error creating event. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  return (
    <div className="app-container center-page">
      <button onClick={toggleLanguage} className="language-toggle">
        {language === 'es' ? '🇺🇸 EN' : '🇪🇸 ES'}
      </button>
      
      <div className="container centered stack-md">
        <div className="page-header centered">
          <h1 className="text-gradient">
            {language === 'es' ? 'Crear Nuevo Evento' : 'Create New Event'}
          </h1>
          <p className="page-subtitle">
            {language === 'es' 
              ? 'Configura tu evento de networking con funciones impulsadas por IA'
              : 'Set up your networking event with AI-powered features'}
          </p>
        </div>

        {successCode && (
          <div className="glass-effect" style={{ padding: '2rem', textAlign: 'center', marginBottom: '2rem', background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(5, 150, 105, 0.1))', border: '2px solid #10b981' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
            <h2 style={{ color: '#10b981', marginBottom: '1rem' }}>
              {language === 'es' ? '¡Evento Creado Exitosamente!' : 'Event Created Successfully!'}
            </h2>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
              {successCode}
            </div>
            <p style={{ color: 'var(--text-secondary)' }}>
              {language === 'es' 
                ? 'Guarda este código - los invitados lo necesitarán para unirse'
                : 'Save this code - guests will need it to join'}
            </p>
            <p style={{ color: 'var(--text-secondary)', marginTop: '1rem' }}>
              {language === 'es' 
                ? 'Redirigiendo a eventos...'
                : 'Redirecting to events...'}
            </p>
          </div>
        )}

        {error && (
          <div className="error-message" style={{ marginBottom: '2rem' }}>
            ⚠️ {error}
          </div>
        )}

        <div className="create-event-container centered">
          <form onSubmit={handleSubmit} className="glass-effect event-form">
            <div className="form-section">
              <h3>{language === 'es' ? 'Detalles del Evento' : 'Event Details'}</h3>
              
              <div className="form-group">
                <label>{language === 'es' ? 'Título del Evento' : 'Event Title'}</label>
                <div className="input-group">
                  <input
                    type="text"
                    name="title"
                    value={formData.title}
                    onChange={handleChange}
                    placeholder={language === 'es' ? 'Cumbre de Networking Tecnológico 2025' : 'Tech Networking Summit 2025'}
                    required
                    disabled={loading}
                  />
                  <span className="input-icon">📅</span>
                </div>
              </div>

              <div className="form-group">
                <label>{language === 'es' ? 'Descripción' : 'Description'}</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows={4}
                  placeholder={language === 'es' 
                    ? 'Describe tu evento y qué pueden esperar los asistentes...'
                    : 'Describe your event and what attendees can expect...'}
                  required
                  disabled={loading}
                />
              </div>

              <div className="form-group">
                <label>{language === 'es' ? 'Fecha y Hora del Evento' : 'Event Date & Time'}</label>
                <div className="input-group">
                  <input
                    type="datetime-local"
                    name="date"
                    value={formData.date}
                    onChange={handleChange}
                    required
                    disabled={loading}
                  />
                  <span className="input-icon">🕐</span>
                </div>
              </div>
            </div>

            <div className="form-section">
              <h3>{language === 'es' ? 'Integración' : 'Integration'}</h3>
              
              <div className="form-group">
                <label>
                  {language === 'es' ? 'ID de Evento Luma' : 'Luma Event ID'}
                  <span className="label-hint">
                    {language === 'es' 
                      ? 'Sincronizaremos automáticamente con tu evento LUMA'
                      : "We'll automatically sync with your LUMA event"}
                  </span>
                </label>
                <div className="input-group">
                  <input
                    type="text"
                    name="lumaId"
                    value={formData.lumaId}
                    onChange={handleChange}
                    placeholder="evt-xxxxxxxxxx"
                    required
                    disabled={loading}
                  />
                  <span className="input-icon">🔗</span>
                </div>
              </div>
            </div>

            <div className="form-section">
              <h3>{language === 'es' ? 'Información del Ponente' : 'Speaker Information'}</h3>
              
              <div className="form-group">
                <label>
                  {language === 'es' ? 'Bio y Temas del Ponente' : 'Speaker Bio & Topics'}
                  <span className="label-hint">
                    {language === 'es'
                      ? 'La IA usará esto para generar iniciadores de conversación relevantes'
                      : 'AI will use this to generate relevant conversation starters'}
                  </span>
                </label>
                <textarea
                  name="speakerInfo"
                  value={formData.speakerInfo}
                  onChange={handleChange}
                  rows={6}
                  placeholder={language === 'es'
                    ? 'Ingresa la bio del ponente, temas y puntos clave de discusión...'
                    : 'Enter speaker bio, topics, and key discussion points...'}
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <div className="form-actions">
              <button 
                type="button" 
                className="btn btn-outline" 
                onClick={() => navigate('/events')}
                disabled={loading}
              >
                ← {language === 'es' ? 'Cancelar' : 'Cancel'}
              </button>
              <button 
                type="submit" 
                className="btn btn-primary btn-large"
                disabled={loading}
              >
                {loading 
                  ? (language === 'es' ? 'Creando...' : 'Creating...') 
                  : (language === 'es' ? 'Crear Evento 🚀' : 'Create Event 🚀')
                }
              </button>
            </div>
          </form>

          <div className="event-features glass-effect">
            <h3>{language === 'es' ? 'Tu Evento Incluirá:' : 'Your Event Will Include:'}</h3>
            <ul className="features-list">
              <li>✓ {language === 'es' ? 'Integración automática con LUMA' : 'Automatic LUMA integration'}</li>
              <li>✓ {language === 'es' ? 'Emparejamiento de asistentes con IA' : 'AI-powered attendee matching'}</li>
              <li>✓ {language === 'es' ? 'Asistente virtual con voz de ElevenLabs' : 'Virtual assistant with ElevenLabs voice'}</li>
              <li>✓ {language === 'es' ? 'Asignación de números de badge' : 'Badge number assignment'}</li>
              <li>✓ {language === 'es' ? 'Iniciadores de conversación en tiempo real' : 'Real-time conversation starters'}</li>
              <li>✓ {language === 'es' ? 'Transcripción de voz' : 'Speech transcription'}</li>
              <li>✓ {language === 'es' ? 'Salas de networking inteligentes' : 'Smart networking rooms'}</li>
              <li>✓ {language === 'es' ? 'Notificaciones por email' : 'Email notifications'}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}