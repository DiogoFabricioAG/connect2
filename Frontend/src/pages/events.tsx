import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import logoImage from '../assets/logo.png';
import { getEvents, getCurrentUser, signOut, type Event, assignBadges, generateRooms as generateRoomsEdge } from '../lib/supabase';
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
    // Wrap in IIFE to satisfy dependency lint without recreating functions
    (async () => {
      await checkAuth();
      await fetchEvents();
    })();
    // We intentionally omit functions from deps; they are stable (defined once)
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const handleAssignBadges = async (eventId: string) => {
    try {
      const { data, error } = await assignBadges(eventId);
      if (error) throw error;
      const count = (data && (data as unknown as { assigned?: number }).assigned) || 0;
      alert(language === 'es' ? `🎫 Badges asignados: ${count}` : `🎫 Badges assigned: ${count}`);
    } catch (err) {
      console.error('assign badges error', err);
      alert(language === 'es' ? 'Error asignando badges' : 'Error assigning badges');
    }
  };

  const handleGenerateRooms = async (eventCode: string) => {
    try {
      const { data, error } = await generateRoomsEdge({ eventCode }, 5);
      if (error) throw error;
      const rooms = (data && (data as unknown as { rooms?: unknown[] }).rooms) || [];
      alert(language === 'es' ? `🚪 Salas generadas: ${rooms.length}` : `🚪 Rooms generated: ${rooms.length}`);
    } catch (err) {
      console.error('generate rooms error', err);
      alert(language === 'es' ? 'Error generando salas' : 'Error generating rooms');
    }
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
            <button onClick={() => navigate('/create-event')} className="btn btn-primary" title={language === 'es' ? 'Crear nuevo evento' : 'Create new event'}>
              ➕ {language === 'es' ? 'Crear Evento' : 'Create Event'}
            </button>
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
        {(() => {
          if (loading) {
            return (
              <div className="loading-state">
                <div className="loader"></div>
                <p>{t.loadingEvents}</p>
              </div>
            );
          }
          if (filteredEvents.length === 0) {
            return (
              <div className="empty-state">
                <div className="empty-icon">🎪</div>
                <h3>{t.noEventsFound}</h3>
                <p>{t.tryDifferentSearch}</p>
              </div>
            );
          }
          return (
            <div className="events-grid">
              {filteredEvents.map((ev) => {
                return (
                  <div key={ev.id} className="event-card glass-effect">
                    <div className="event-badge badge-gradient">{ev.code}</div>

                    <div className="event-header">
                      <h3>{ev.name}</h3>
                      <p className="event-description">{ev.description}</p>
                    </div>

                    <div className="event-meta">
                      <div className="meta-item">
                        <span className="meta-icon">📅</span>
                        <span>{formatDate(ev.date)}</span>
                      </div>
                      <div className="meta-item">
                        <span className="meta-icon">📍</span>
                        <span>{ev.location || (language === 'es' ? 'Por anunciar' : 'TBA')}</span>
                      </div>
                      <div className="meta-item">
                        <span className="meta-icon">✨</span>
                        <span className="status-badge status-published">
                          {ev.status === 'published' ? t.available : ev.status}
                        </span>
                      </div>
                    </div>

                    <div className="card-actions-row">
                      <button
                        onClick={() => handleJoinEvent(ev.code)}
                        className="btn btn-primary"
                      >
                        {t.joinEventButton}
                      </button>
                      <button
                        onClick={() => handleAssignBadges(ev.id)}
                        className="btn btn-outline"
                        title={language === 'es' ? 'Asignar badges' : 'Assign badges'}
                      >
                        🎫 Badges
                      </button>
                      <button
                        onClick={() => handleGenerateRooms(ev.code)}
                        className="btn btn-outline"
                        title={language === 'es' ? 'Generar salas' : 'Generate rooms'}
                      >
                        🚪 {language === 'es' ? 'Salas' : 'Rooms'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
