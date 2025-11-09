import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLanguage } from '../lib/LanguageContext';
import { updateGuestProfile, createVirtualPerson } from '../lib/supabase';

export function JoinEventPage() {
  const { eventCode } = useParams();
  const navigate = useNavigate();
  const { language } = useLanguage();

  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [motivations, setMotivations] = useState('');
  const [goals, setGoals] = useState('');
  const [expectations, setExpectations] = useState('');
  const [interests, setInterests] = useState('');
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const t = (es: string, en: string) => (language === 'es' ? es : en);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!eventCode) return;
    if (!(email ?? '').includes('@')) {
      setError(t('Ingresa un email válido', 'Enter a valid email'));
      return;
    }
    setCreating(true);
    setError(null);
    setMessage(null);
    try {
      const profile = { full_name: fullName, motivations, goals, expectations, interests };
      const { error: upErr } = await updateGuestProfile(eventCode, email, profile);
      if (upErr) throw upErr;

      // Crear una persona virtual de forma opcional si hay nombre
      if (fullName.trim()) {
        await createVirtualPerson({ eventCode }, fullName.trim());
      }
      setMessage(t('¡Registro enviado! Revisa tu evento.', 'Registration saved! Check your event.'));
      setTimeout(() => navigate(`/event/${eventCode}`), 1200);
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      setError(err.message || t('Error al enviar', 'Failed to submit'));
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="app-container" style={{ padding: '2rem' }}>
      <div className="container">
        <div className="glass-effect" style={{ maxWidth: 720, margin: '0 auto', padding: '2rem' }}>
          <h1 style={{ marginTop: 0 }}>{t('Únete al Evento', 'Join the Event')} {eventCode ? `— ${eventCode}` : ''}</h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            {t('Cuéntanos más de ti para mejorar tu experiencia de networking.', 'Tell us about you to improve your networking experience.')}
          </p>
          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '1rem' }}>
            <label>
              <span>Email</span>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@example.com" />
            </label>
            <label>
              <span>{t('Nombre completo', 'Full name')}</span>
              <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} placeholder={t('Tu nombre', 'Your name')} />
            </label>
            <label>
              <span>{t('Motivaciones', 'Motivations')}</span>
              <textarea value={motivations} onChange={e => setMotivations(e.target.value)} rows={3} />
            </label>
            <label>
              <span>{t('Objetivos', 'Goals')}</span>
              <textarea value={goals} onChange={e => setGoals(e.target.value)} rows={3} />
            </label>
            <label>
              <span>{t('Expectativas', 'Expectations')}</span>
              <textarea value={expectations} onChange={e => setExpectations(e.target.value)} rows={3} />
            </label>
            <label>
              <span>{t('Intereses (separados por coma)', 'Interests (comma-separated)')}</span>
              <input type="text" value={interests} onChange={e => setInterests(e.target.value)} placeholder={t('AI, Startups, Web3', 'AI, Startups, Web3')} />
            </label>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button type="submit" className="btn btn-primary" disabled={creating}>
                {creating ? t('Enviando...', 'Submitting...') : t('Enviar', 'Submit')}
              </button>
              <button type="button" className="btn btn-outline" onClick={() => navigate(`/event/${eventCode}`)}>
                {t('Ir al evento', 'Go to event')}
              </button>
            </div>
          </form>
          {message && <p style={{ color: '#10b981', marginTop: '1rem' }}>{message}</p>}
          {error && <p style={{ color: '#ef4444', marginTop: '1rem' }}>{error}</p>}
        </div>
      </div>
    </div>
  );
}
