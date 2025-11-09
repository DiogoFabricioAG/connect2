import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import logoImage from '../assets/logo.png';
import { getEvents, getCurrentUser, signOut, type Event } from '../lib/supabase';
import { useLanguage } from '../lib/LanguageContext';
import { translations } from '../lib/i18n';

export function EventsPage() {
  const { language, toggleLanguage } = useLanguage();
  const t = translations[language];
  const [events, setEvents] = useState<Event[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    checkAuth();
    fetchEvents();
  }, []);

  const checkAuth = async () => {
    const { user } = await getCurrentUser();
    if (!user) {
      navigate('/login');
      return;
    }
    setUserName(user.user_metadata?.name || user.email || 'Usuario');
  };

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const { data, error } = await getEvents();
      
      if (error) {
        console.error('Error fetching events:', error);
        // Fall back to mock data if no events in DB yet
        setEvents([{
          id: '1',
          code: 'TECH2025',
          name: 'Tech Summit 2025',
          description: 'Conferencia anual de tecnología reuniendo innovadores y líderes de la industria',
          date: '2025-11-15T09:00:00',
          location: 'San Francisco, CA',
          status: 'published',
          luma_event_id: 'evt-abc123',
          speaker_info: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: '2',
          code: 'STARTUP',
          name: 'Startup Networking Night',
          description: 'Conecta con emprendedores e inversores en una noche de networking',
          date: '2025-11-20T18:00:00',
          location: 'New York, NY',
          status: 'published',
          luma_event_id: 'evt-def456',
          speaker_info: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: '3',
          code: 'DESIGN',
          name: 'Design Thinking Workshop',
          description: 'Aprende metodología de design thinking de expertos de la industria',
          date: '2025-11-25T10:00:00',
          location: 'Los Angeles, CA',
          status: 'published',
          luma_event_id: 'evt-ghi789',
          speaker_info: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }]);
      } else {
        setEvents(data || []);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  const handleJoinEvent = (eventCode: string) => {
    navigate(`/event/${eventCode}`);
  };

  const filteredEvents = events.filter(event => {
    const matchesSearch = event.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         event.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all';
    return matchesSearch && matchesCategory;
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="app-container">
      {/* Language Toggle */}
      <button 
        className="language-toggle"
        onClick={toggleLanguage}
        title={language === 'es' ? 'Change to English' : 'Cambiar a Español'}
      >
        {language === 'es' ? '🇺🇸 EN' : '🇪🇸 ES'}
      </button>

      {/* Navbar */}
      <nav className="navbar glass-effect">
        <div className="nav-content">
          <div className="nav-logo">
            <img src={logoImage} alt="Connect2 Logo" className="logo-img" />
          </div>
          <div className="nav-actions">
            <button className="btn btn-glass">
              <span>👤</span> {userName}
            </button>
            <button onClick={handleLogout} className="btn btn-outline">
              {t.logout}
            </button>
          </div>
        </div>
      </nav>

      <div className="container">
        {/* Header */}
        <div className="page-header">
          <h1 className="text-gradient">{t.discoverEvents}</h1>
          <p>{t.findPerfectEvent}</p>
        </div>

        {/* Search and Filters */}
        <div className="search-section glass-effect">
          <div className="search-bar">
            <input
              type="text"
              placeholder={t.searchEvents}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
            <span className="search-icon">🔍</span>
          </div>

          <div className="filter-tabs">
            <button
              className={`filter-tab ${selectedCategory === 'all' ? 'active' : ''}`}
              onClick={() => setSelectedCategory('all')}
            >
              {t.all}
            </button>
            <button
              className={`filter-tab ${selectedCategory === 'technology' ? 'active' : ''}`}
              onClick={() => setSelectedCategory('technology')}
            >
              {t.technology}
            </button>
            <button
              className={`filter-tab ${selectedCategory === 'business' ? 'active' : ''}`}
              onClick={() => setSelectedCategory('business')}
            >
              {t.business}
            </button>
            <button
              className={`filter-tab ${selectedCategory === 'design' ? 'active' : ''}`}
              onClick={() => setSelectedCategory('design')}
            >
              {t.design}
            </button>
          </div>
        </div>

        {/* Events Grid */}
        {loading ? (
          <div className="loading-state">
            <div className="loader"></div>
            <p>{t.loadingEvents}</p>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🎪</div>
            <h3>{t.noEventsFound}</h3>
            <p>{t.tryDifferentSearch}</p>
          </div>
        ) : (
          <div className="events-grid">
            {filteredEvents.map((event) => (
              <div key={event.id} className="event-card glass-effect">
                <div className="event-badge badge-gradient">{event.code}</div>
                
                <div className="event-header">
                  <h3>{event.name}</h3>
                  <p className="event-description">{event.description}</p>
                </div>

                <div className="event-meta">
                  <div className="meta-item">
                    <span className="meta-icon">📅</span>
                    <span>{formatDate(event.date)}</span>
                  </div>
                  <div className="meta-item">
                    <span className="meta-icon">📍</span>
                    <span>{event.location || (language === 'es' ? 'Por anunciar' : 'TBA')}</span>
                  </div>
                  <div className="meta-item">
                    <span className="meta-icon">✨</span>
                    <span className="status-badge status-published">
                      {event.status === 'published' ? t.available : event.status}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => handleJoinEvent(event.code)}
                  className="btn btn-primary btn-block"
                >
                  {t.joinEventButton}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
