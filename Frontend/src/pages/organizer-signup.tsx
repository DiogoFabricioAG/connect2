import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../lib/LanguageContext';
import { signUp } from '../lib/supabase';

interface SignupFormData {
  name: string;
  email: string;
  password: string;
  company: string;
  plan: 'monthly' | 'yearly';
}

export function OrganizerSignupPage() {
  const { language, toggleLanguage } = useLanguage();
  const [formData, setFormData] = useState<SignupFormData>({
    name: '',
    email: '',
    password: '',
    company: '',
    plan: 'monthly'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Register with Supabase Auth
      const { data, error: signUpError } = await signUp(formData.email, formData.password, {
        name: formData.name,
        full_name: formData.name,
        company: formData.company,
        user_type: 'organizer',
        plan: formData.plan
      });

      if (signUpError) {
        throw signUpError;
      }

      if (data.user) {
        // Save organizer preferences
        localStorage.setItem('organizerData', JSON.stringify({
          company: formData.company,
          plan: formData.plan
        }));

        console.log('Organizer registered successfully:', data.user);
        
        // Redirect to create event page
        navigate('/create-event');
      }
    } catch (err: any) {
      console.error('Error signing up:', err);
      setError(err.message || (language === 'es' ? 'Error al crear cuenta' : 'Error creating account'));
    } finally {
      setLoading(false);
    }
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

      <div className="auth-container">
        <div className="auth-content">
          <h1>{language === 'es' ? 'Crea tu Cuenta de Organizador' : 'Create Your Organizer Account'}</h1>
          <p className="auth-subtitle">
            {language === 'es' 
              ? 'Comienza a crear eventos de networking increíbles' 
              : 'Start creating amazing networking events'}
          </p>

          <div className="pricing-cards">
            <div className={`pricing-card ${formData.plan === 'monthly' ? 'featured' : ''}`}
                 onClick={() => setFormData({ ...formData, plan: 'monthly' })}>
              <h3>Monthly Plan</h3>
              <div className="price">$5<span className="price-period">/mo</span></div>
              <ul className="features-list">
                <li>Unlimited events</li>
                <li>AI-powered matching</li>
                <li>Virtual assistant</li>
                <li>Voice features (ElevenLabs)</li>
                <li>Advanced analytics</li>
              </ul>
            </div>

            <div className={`pricing-card ${formData.plan === 'yearly' ? 'featured' : ''}`}
                 onClick={() => setFormData({ ...formData, plan: 'yearly' })}>
              <h3>Yearly Plan</h3>
              <div className="price">$50<span className="price-period">/year</span></div>
              <ul className="features-list">
                <li>Everything in Monthly</li>
                <li>2 months free</li>
                <li>Priority support</li>
                <li>Custom branding</li>
                <li>API access</li>
              </ul>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label>{language === 'es' ? 'Nombre Completo' : 'Full Name'}</label>
              <div className="input-group">
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  placeholder={language === 'es' ? 'Juan Pérez' : 'John Doe'}
                />
                <span className="input-icon">👤</span>
              </div>
            </div>

            <div className="form-group">
              <label>{language === 'es' ? 'Correo Electrónico' : 'Email'}</label>
              <div className="input-group">
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  placeholder={language === 'es' ? 'tu@empresa.com' : 'you@company.com'}
                />
                <span className="input-icon">✉️</span>
              </div>
            </div>

            <div className="form-group">
              <label>{language === 'es' ? 'Contraseña' : 'Password'}</label>
              <div className="input-group">
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  minLength={6}
                  placeholder="••••••••"
                />
                <span className="input-icon">🔒</span>
              </div>
            </div>

            <div className="form-group">
              <label>{language === 'es' ? 'Nombre de la Empresa' : 'Company Name'}</label>
              <div className="input-group">
                <input
                  type="text"
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  required
                  placeholder={language === 'es' ? 'Mi Empresa S.A.' : 'My Company Inc.'}
                />
                <span className="input-icon">🏢</span>
              </div>
            </div>

            {error && (
              <div className="error-message">
                ⚠️ {error}
              </div>
            )}

            <div className="form-actions">
              <button 
                type="button"
                onClick={() => navigate('/')}
                className="btn btn-outline btn-large"
                disabled={loading}
              >
                ← {language === 'es' ? 'Volver' : 'Back'}
              </button>

              <button 
                type="submit" 
                className="btn btn-primary btn-large"
                disabled={loading}
              >
                {loading 
                  ? (language === 'es' ? 'Creando...' : 'Creating...') 
                  : (language === 'es' ? 'Crear Cuenta' : 'Create Account')}
              </button>
            </div>
          </form>

          <p className="auth-footer">
            Already have an account? <a href="/login">Sign In</a>
          </p>
        </div>
      </div>
    </div>
  );
}