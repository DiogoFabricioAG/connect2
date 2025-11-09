import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import logoImage from '../assets/logo.png';
import { signIn, signUp, getCurrentUser, notifyGuest } from '../lib/supabase';
import { useLanguage } from '../lib/LanguageContext';
import { translations } from '../lib/i18n';

const AVAILABLE_INTERESTS = [
  'Inteligencia Artificial', 'Machine Learning', 'Blockchain', 'Startups',
  'Networking', 'Inversión', 'Marketing', 'Tecnología', 'Innovación',
  'Emprendimiento', 'Desarrollo Web', 'Diseño UX/UI', 'Data Science',
  'Ciberseguridad', 'Cloud Computing', 'IoT', 'Realidad Virtual'
];

export function LoginPage() {
  const { language, toggleLanguage } = useLanguage();
  const t = translations[language];
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showInterestsForm, setShowInterestsForm] = useState(false);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user is already logged in
    getCurrentUser().then(({ user }) => {
      if (user) {
        navigate('/events');
      }
    });
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isSignup) {
        // Sign up new user
        const { data, error: signUpError } = await signUp(email, password, { 
          name,
          full_name: name 
        });
        
        if (signUpError) {
          // Check if it's a duplicate email error
          if (signUpError.message.includes('already registered') || signUpError.message.includes('User already registered')) {
            throw new Error(language === 'es' 
              ? 'Este email ya está registrado. Por favor inicia sesión.'
              : 'This email is already registered. Please sign in.');
          }
          throw signUpError;
        }
        
        if (data.user) {
          // Check if email confirmation is required
          if (data.session) {
            // User can login immediately (email confirmation disabled)
            setShowInterestsForm(true);
            setError('');
          } else {
            // Email confirmation required
            setError(language === 'es' 
              ? '✅ Cuenta creada! Por ahora, puedes continuar sin confirmar el email.'
              : '✅ Account created! For now, you can continue without confirming email.');
            // Still show interests form
            setShowInterestsForm(true);
          }
        }
      } else {
        // Sign in existing user
        const { data, error: signInError } = await signIn(email, password);
        
        if (signInError) {
          // Provide more helpful error messages
          if (signInError.message.includes('Invalid login credentials')) {
            throw new Error(language === 'es' 
              ? 'Email o contraseña incorrectos'
              : 'Invalid email or password');
          }
          if (signInError.message.includes('Email not confirmed')) {
            throw new Error(language === 'es' 
              ? 'Por favor confirma tu email antes de iniciar sesión'
              : 'Please confirm your email before signing in');
          }
          throw signInError;
        }
        
        if (data.user) {
          navigate('/events');
        }
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      setError(err.message || (language === 'es' ? 'Ocurrió un error. Por favor intenta de nuevo.' : 'An error occurred. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const handleInterestsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (selectedInterests.length < 3) {
      setError(language === 'es' ? 'Debes seleccionar al menos 3 intereses' : 'You must select at least 3 interests');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { user } = await getCurrentUser();
      
      if (!user) {
        console.log('No user found, but proceeding anyway...');
      }

      const preferences = {
        linkedin: linkedinUrl,
        company,
        role,
        interests: selectedInterests,
        completedOnboarding: true,
        email: email
      };

      // Store in localStorage for now (will be saved to DB when joining an event)
      localStorage.setItem('userPreferences', JSON.stringify(preferences));
      console.log('Preferences saved:', preferences);

      // Send welcome email with preferences form
      try {
        await notifyGuest(email, 'WELCOME', 'welcome');
      } catch (emailError) {
        console.error('Email notification error:', emailError);
        // Don't block the flow if email fails
      }

      console.log('Navigating to /events...');
      navigate('/events');
    } catch (err: any) {
      console.error('Interests error:', err);
      setError(err.message || 'Error al guardar preferencias');
    } finally {
      setLoading(false);
    }
  };

  const toggleInterest = (interest: string) => {
    setSelectedInterests(prev =>
      prev.includes(interest)
        ? prev.filter(i => i !== interest)
        : [...prev, interest]
    );
  };

  if (showInterestsForm) {
    return (
      <div className="app-container">
        <button 
          className="language-toggle"
          onClick={toggleLanguage}
          title={language === 'es' ? 'Change to English' : 'Cambiar a Español'}
        >
          {language === 'es' ? '🇺🇸 EN' : '🇪🇸 ES'}
        </button>

        <div className="login-container">
          <div className="interests-card glass-effect">
            <div className="login-header">
              <img src={logoImage} alt="Connect2" className="login-logo" />
              <h1>{t.welcomeToConnect2}</h1>
              <p>{t.tellUsAboutYou}</p>
            </div>

            <form onSubmit={handleInterestsSubmit} className="interests-form">
              <div className="form-section">
                <h3>{t.yourInterests}</h3>
                <p className="form-help">{t.selectInterests}</p>
                <div className="interests-grid">
                  {AVAILABLE_INTERESTS.map(interest => (
                    <button
                      key={interest}
                      type="button"
                      className={`interest-tag ${selectedInterests.includes(interest) ? 'selected' : ''}`}
                      onClick={() => toggleInterest(interest)}
                    >
                      {interest}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-section">
                <h3>{t.professionalInfo}</h3>
                
                <div className="form-group">
                  <label>{t.company}</label>
                  <input
                    type="text"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder={t.companyPlaceholder}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>{t.role}</label>
                  <input
                    type="text"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    placeholder={t.rolePlaceholder}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>{t.linkedin}</label>
                  <input
                    type="url"
                    value={linkedinUrl}
                    onChange={(e) => setLinkedinUrl(e.target.value)}
                    placeholder={t.linkedinPlaceholder}
                  />
                </div>
              </div>

              {error && (
                <div className="error-message">
                  ⚠️ {error}
                </div>
              )}

              {/* Contador de intereses seleccionados */}
              <div className="interests-counter">
                <div className="counter-badge">
                  <span className="counter-number">{selectedInterests.length}</span>
                  <span className="counter-text">/ 3 {language === 'es' ? 'mínimo' : 'minimum'}</span>
                </div>
                {selectedInterests.length < 3 && (
                  <p className="counter-warning">
                    ⚠️ {language === 'es' 
                      ? `Selecciona ${3 - selectedInterests.length} más` 
                      : `Select ${3 - selectedInterests.length} more`}
                  </p>
                )}
                {selectedInterests.length >= 3 && (
                  <p className="counter-success">
                    ✓ {language === 'es' ? '¡Listo para continuar!' : 'Ready to continue!'}
                  </p>
                )}
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  onClick={() => setShowInterestsForm(false)}
                  className="btn btn-outline btn-large"
                  disabled={loading}
                >
                  ← {language === 'es' ? 'Volver' : 'Back'}
                </button>
                
                <button
                  type="submit"
                  className={`btn btn-primary btn-large ${selectedInterests.length < 3 ? 'btn-disabled' : ''}`}
                  disabled={loading || selectedInterests.length < 3}
                >
                  {loading ? t.saving : t.continueToEvents}
                </button>
              </div>

              {selectedInterests.length < 3 && (
                <p className="form-help" style={{ textAlign: 'center', marginTop: '0.5rem', color: 'var(--text-secondary)' }}>
                  {t.selectMinimum}
                </p>
              )}
            </form>
          </div>
        </div>
      </div>
    );
  }

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

      <div className="login-container">
        <div className="login-card glass-effect">
          <div className="login-header">
            <img src={logoImage} alt="Connect2" className="login-logo" />
            <h1>{isSignup ? t.createAccount : t.welcomeBack}</h1>
            <p>{isSignup ? t.signUpDescription : t.signInDescription}</p>
          </div>

          <form onSubmit={handleSubmit} className="login-form">
            {isSignup && (
              <div className="form-group">
                <label>{t.fullName}</label>
                <div className="input-group">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={language === 'es' ? 'Juan Pérez' : 'John Doe'}
                    required
                  />
                  <span className="input-icon">👤</span>
                </div>
              </div>
            )}

            <div className="form-group">
              <label>{t.email}</label>
              <div className="input-group">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={language === 'es' ? 'tu@email.com' : 'you@email.com'}
                  required
                />
                <span className="input-icon">✉️</span>
              </div>
            </div>

            <div className="form-group">
              <label>{t.password}</label>
              <div className="input-group">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
                <span className="input-icon">🔒</span>
              </div>
              {isSignup && (
                <p className="form-help">{t.minCharacters}</p>
              )}
            </div>

            {error && (
              <div className={error.includes('✅') ? 'success-message' : 'error-message'}>
                {error}
              </div>
            )}

            {!isSignup && (
              <p className="form-help" style={{ fontSize: '0.85rem', textAlign: 'center', marginBottom: '1rem' }}>
                💡 {language === 'es' 
                  ? 'Si acabas de registrarte, tu cuenta ya está lista para usar'
                  : 'If you just signed up, your account is ready to use'}
              </p>
            )}

            <button
              type="submit"
              className="btn btn-primary btn-large"
              disabled={loading}
            >
              {loading ? t.loading : (isSignup ? t.signUp : t.signIn)}
            </button>
          </form>

          <div className="login-footer">
            <p>
              {isSignup ? t.alreadyHaveAccount : t.dontHaveAccount}
              {' '}
              <button 
                className="link-button"
                onClick={() => {
                  setIsSignup(!isSignup);
                  setError('');
                }}
              >
                {isSignup ? t.signIn : t.signUp}
              </button>
            </p>
          </div>

          <div className="divider">
            <span>{language === 'es' ? 'o' : 'or'}</span>
          </div>

          <a href="/" className="btn btn-outline btn-large">
            ← {t.backToHome}
          </a>

          {/* Info box for new users */}
          {!isSignup && (
            <div style={{ 
              marginTop: '1.5rem', 
              padding: '1rem', 
              background: 'rgba(99, 102, 241, 0.1)', 
              border: '1px solid rgba(99, 102, 241, 0.3)', 
              borderRadius: 'var(--radius-md)',
              fontSize: '0.85rem',
              color: 'var(--text-secondary)',
              lineHeight: '1.6'
            }}>
              <div style={{ color: 'var(--primary-color)', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                {language === 'es' ? '📝 ¿Usuario nuevo?' : '📝 New user?'}
              </div>
              {language === 'es' ? (
                <>
                  1. Haz clic en "Crear Cuenta" arriba<br />
                  2. Completa el formulario<br />
                  3. Llena tus intereses<br />
                  4. ¡Listo! Vuelve aquí e inicia sesión
                </>
              ) : (
                <>
                  1. Click "Sign Up" above<br />
                  2. Fill the form<br />
                  3. Complete your interests<br />
                  4. Done! Come back and sign in
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
