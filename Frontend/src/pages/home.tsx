import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import logoImage from '../assets/logo.png';
import { useLanguage } from '../lib/LanguageContext';
import { translations } from '../lib/i18n';

export function HomePage() {
  const { language, toggleLanguage } = useLanguage();
  const t = translations[language];
  const [eventCode, setEventCode] = useState('');
  const [userType, setUserType] = useState<'guest' | 'organizer'>('guest');
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(`/event/${eventCode}`);
  };

  return (
    <div className="app-container">
      {/* Language Toggle Button */}
      <button 
        className="language-toggle"
        onClick={toggleLanguage}
        title={language === 'es' ? 'Change to English' : 'Cambiar a Español'}
      >
        {language === 'es' ? '🇺🇸 EN' : '🇪🇸 ES'}
      </button>

      {/* Navbar Minimalista */}
      <nav className="navbar-home">
        <div className="nav-content">
          <div className="nav-logo">
            <img src={logoImage} alt="Connect2" className="logo-img-small" />
          </div>
        </div>
      </nav>

      {/* Hero Section Mejorado */}
      <div className="hero-new">
        <div className="hero-background-gradient"></div>
        <div className="hero-content-center">
          <div className="logo-showcase">
            <img src={logoImage} alt="Connect2" className="hero-logo-large" />
          </div>
          <h1 className="hero-title-new">
            {language === 'es' ? t.heroTitle : 'Connect with People Who Matter'}
          </h1>
          <p className="hero-subtitle-new">
            {language === 'es' ? t.heroSubtitle : 'AI-powered smart networking for unforgettable events'}
          </p>
        </div>
      </div>

      {/* Tabs de Usuario más Visuales */}
      <div className="container">
        <div className="user-type-section">
          <h2 className="section-subtitle">
            {language === 'es' ? '¿Cómo quieres ingresar?' : 'How do you want to join?'}
          </h2>
          
          <div className="user-type-cards">
            {/* Card de Invitado */}
            <div 
              className={`user-type-card glass-effect ${userType === 'guest' ? 'active' : ''}`}
              onClick={() => setUserType('guest')}
            >
              <div className="card-icon-large">🎫</div>
              <h3>{language === 'es' ? 'Soy Invitado' : "I'm a Guest"}</h3>
              <p>{language === 'es' ? 'Tengo un código de evento' : 'I have an event code'}</p>
              {userType === 'guest' && (
                <div className="card-active-indicator">✓</div>
              )}
            </div>

            {/* Card de Organizador */}
            <div 
              className={`user-type-card glass-effect ${userType === 'organizer' ? 'active' : ''}`}
              onClick={() => setUserType('organizer')}
            >
              <div className="card-icon-large">👔</div>
              <h3>{language === 'es' ? 'Soy Organizador' : "I'm an Organizer"}</h3>
              <p>{language === 'es' ? 'Quiero crear eventos' : 'I want to create events'}</p>
              {userType === 'organizer' && (
                <div className="card-active-indicator">✓</div>
              )}
            </div>
          </div>
        </div>

        {/* Formulario para Invitado */}
        {userType === 'guest' && (
          <div className="action-section">
            <div className="event-form-new glass-effect">
              <h3>{language === 'es' ? 'Ingresa el Código del Evento' : 'Enter Your Event Code'}</h3>
              <form onSubmit={handleSubmit} className="form-inline">
                <div className="input-group-large">
                  <input
                    type="text"
                    value={eventCode}
                    onChange={(e) => setEventCode(e.target.value.toUpperCase())}
                    required
                    placeholder={language === 'es' ? 'Ej: TECH2025' : 'Ex: TECH2025'}
                    className="input-large"
                  />
                  <button type="submit" className="btn btn-primary btn-xl">
                    {language === 'es' ? 'Unirse →' : 'Join →'}
                  </button>
                </div>
              </form>
              <p className="form-help-text">
                {language === 'es' 
                  ? '¿No tienes cuenta? Primero ' 
                  : "Don't have an account? First "}
                <button 
                  className="link-button-inline"
                  onClick={() => navigate('/login')}
                >
                  {language === 'es' ? 'regístrate aquí' : 'sign up here'}
                </button>
              </p>
            </div>
          </div>
        )}

        {/* Opciones para Organizador */}
        {userType === 'organizer' && (
          <div className="action-section">
            <div className="organizer-cta glass-effect">
              <div className="pricing-highlight">
                <span className="price-tag">$5</span>
                <span className="price-period">/mes</span>
              </div>
              <h3>{language === 'es' ? 'Crea Eventos Profesionales' : 'Create Professional Events'}</h3>
              <ul className="features-compact">
                <li>✓ {language === 'es' ? 'Matching por IA' : 'AI Matching'}</li>
                <li>✓ {language === 'es' ? 'Asistente con voz' : 'Voice Assistant'}</li>
                <li>✓ {language === 'es' ? 'Integración LUMA' : 'LUMA Integration'}</li>
                <li>✓ {language === 'es' ? 'Transcripción en tiempo real' : 'Real-time Transcription'}</li>
              </ul>
              <div className="cta-buttons-stacked">
                <button 
                  onClick={() => navigate('/organizer-signup')}
                  className="btn btn-primary btn-xl"
                >
                  {language === 'es' ? 'Comenzar Prueba Gratis' : 'Start Free Trial'}
                </button>
                <button 
                  onClick={() => navigate('/login')}
                  className="btn btn-outline btn-large"
                >
                  {language === 'es' ? 'Ya tengo cuenta' : 'I have an account'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Features Section */}
        <div className="features-section">
          <h2 className="section-title text-gradient">
            {language === 'es' ? '¿Por Qué Elegir Connect2?' : 'Why Choose Connect2?'}
          </h2>
          <div className="features">
            <div className="feature card-hover glass-effect">
              <div className="feature-icon">🤖</div>
              <h3>{language === 'es' ? 'Matching Impulsado por IA' : 'AI-Powered Matching'}</h3>
              <p>{language === 'es' 
                ? 'Nuestro algoritmo inteligente empareja asistentes basado en intereses, objetivos y preferencias para conexiones significativas'
                : 'Our intelligent algorithm matches attendees based on interests, goals, and preferences for meaningful connections'}</p>
            </div>

            <div className="feature card-hover glass-effect">
              <div className="feature-icon">🎙️</div>
              <h3>{language === 'es' ? 'Asistente de Voz Virtual' : 'Virtual Voice Assistant'}</h3>
              <p>{language === 'es'
                ? 'Asistente de voz potenciado por ElevenLabs proporciona iniciadores de conversación y ayuda a romper el hielo'
                : 'ElevenLabs-powered voice assistant provides conversation starters and helps break the ice'}</p>
            </div>

            <div className="feature card-hover glass-effect">
              <div className="feature-icon">🔗</div>
              <h3>{language === 'es' ? 'Integración Perfecta' : 'Seamless Integration'}</h3>
              <p>{language === 'es'
                ? 'Sincronización automática con LUMA y otras plataformas de eventos. Solo comparte el link de tu evento y nosotros hacemos el resto'
                : 'Automatic sync with LUMA and other event platforms. Just share your event link and we handle the rest'}</p>
            </div>

            <div className="feature card-hover glass-effect">
              <div className="feature-icon">💬</div>
              <h3>{language === 'es' ? 'Conversaciones Inteligentes' : 'Smart Conversations'}</h3>
              <p>{language === 'es'
                ? 'Transcripción en tiempo real y preguntas generadas por IA adaptadas a cada interacción'
                : 'Real-time transcription and AI-generated questions tailored to each interaction'}</p>
            </div>

            <div className="feature card-hover glass-effect">
              <div className="feature-icon">🎯</div>
              <h3>{language === 'es' ? 'Emparejamiento por Badge' : 'Badge Matching'}</h3>
              <p>{language === 'es'
                ? 'Los números de badge físicos se conectan a perfiles digitales para networking presencial fácil'
                : 'Physical badge numbers connect to digital profiles for easy in-person networking'}</p>
            </div>

            <div className="feature card-hover glass-effect">
              <div className="feature-icon">📊</div>
              <h3>{language === 'es' ? 'Panel de Analíticas' : 'Analytics Dashboard'}</h3>
              <p>{language === 'es'
                ? 'Rastrea conexiones, métricas de engagement y éxito del evento en tiempo real'
                : 'Track connections, engagement metrics, and event success in real-time'}</p>
            </div>
          </div>
        </div>

        {/* How It Works */}
        <div className="how-it-works">
          <h2 className="section-title text-gradient">
            {language === 'es' ? 'Cómo Funciona' : 'How It Works'}
          </h2>
          <div className="steps">
            <div className="step glass-effect">
              <div className="step-number">1</div>
              <h3>{language === 'es' ? 'Crea Tu Evento' : 'Create Your Event'}</h3>
              <p>{language === 'es'
                ? 'Configura tu evento en minutos. Conecta tu página de LUMA y personaliza tus preferencias de networking'
                : 'Set up your event in minutes. Connect your LUMA page and customize your networking preferences'}</p>
            </div>
            <div className="step glass-effect">
              <div className="step-number">2</div>
              <h3>{language === 'es' ? 'Los Asistentes se Registran' : 'Attendees Register'}</h3>
              <p>{language === 'es'
                ? 'Los invitados reciben un email con un formulario de registro potenciado por nuestro asistente virtual de IA'
                : 'Guests receive an email with a registration form powered by our AI virtual assistant'}</p>
            </div>
            <div className="step glass-effect">
              <div className="step-number">3</div>
              <h3>{language === 'es' ? 'La IA Genera Matches' : 'AI Generates Matches'}</h3>
              <p>{language === 'es'
                ? 'Nuestro algoritmo analiza intereses y crea salas de networking óptimas y sugerencias'
                : 'Our algorithm analyzes interests and creates optimal networking rooms and suggestions'}</p>
            </div>
            <div className="step glass-effect">
              <div className="step-number">4</div>
              <h3>{language === 'es' ? 'Haz Networking Sin Esfuerzo' : 'Network Effortlessly'}</h3>
              <p>{language === 'es'
                ? 'Usa números de badge para encontrar matches, obtén iniciadores de conversación y haz conexiones significativas'
                : 'Use badge numbers to find matches, get conversation starters, and make meaningful connections'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="footer">
        <div className="container">
          <div className="footer-content">
            <div className="footer-logo">
              <span className="text-gradient">Connect2</span>
            </div>
            <p>© 2025 Connect2. {language === 'es' ? 'Haciendo el networking significativo.' : 'Making networking meaningful.'}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}