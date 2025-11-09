// Internationalization system
export type Language = 'es' | 'en';

export const translations = {
  es: {
    // Navbar
    profile: 'Perfil',
    logout: 'Cerrar Sesión',
    login: 'Iniciar Sesión',
    
    // Home
    heroTitle: 'Conecta con Personas que Importan',
    heroSubtitle: 'Networking inteligente impulsado por IA para eventos inolvidables',
    guestTab: 'Soy Invitado',
    organizerTab: 'Soy Organizador',
    eventCodeLabel: 'Código del Evento',
    eventCodePlaceholder: 'Ingresa tu código',
    joinEvent: 'Unirse al Evento',
    createEvent: 'Crear Evento',
    organizerSignup: 'Registrarse como Organizador',
    
    // Login
    createAccount: 'Crear Cuenta',
    welcomeBack: 'Bienvenido de Vuelta',
    signUpDescription: 'Únete a Connect2 y descubre eventos increíbles',
    signInDescription: 'Inicia sesión en tu cuenta',
    fullName: 'Nombre Completo',
    email: 'Correo Electrónico',
    password: 'Contraseña',
    minCharacters: 'Mínimo 6 caracteres',
    signIn: 'Iniciar Sesión',
    signUp: 'Registrarse',
    alreadyHaveAccount: '¿Ya tienes cuenta?',
    dontHaveAccount: '¿No tienes cuenta?',
    backToHome: 'Volver al Inicio',
    loading: 'Cargando...',
    
    // Interests Form
    welcomeToConnect2: '¡Bienvenido a Connect2! 🎉',
    tellUsAboutYou: 'Cuéntanos sobre ti para personalizar tu experiencia',
    yourInterests: '📌 Tus Intereses',
    selectInterests: 'Selecciona los temas que te apasionan (mínimo 3)',
    professionalInfo: '💼 Información Profesional',
    company: 'Empresa / Organización',
    companyPlaceholder: 'Ej: TechCorp, Freelancer, Estudiante',
    role: 'Rol / Posición',
    rolePlaceholder: 'Ej: CEO, Desarrollador, Estudiante',
    linkedin: 'LinkedIn (opcional)',
    linkedinPlaceholder: 'https://linkedin.com/in/tu-perfil',
    continueToEvents: 'Continuar a Eventos →',
    selectMinimum: 'Selecciona al menos 3 intereses para continuar',
    saving: 'Guardando...',
    
    // Events
    discoverEvents: 'Descubre Eventos',
    findPerfectEvent: 'Encuentra el evento perfecto para ti y comienza a hacer networking',
    searchEvents: 'Buscar eventos...',
    all: 'Todos',
    technology: 'Tecnología',
    business: 'Negocios',
    design: 'Diseño',
    loadingEvents: 'Cargando eventos...',
    noEventsFound: 'No se encontraron eventos',
    tryDifferentSearch: 'Intenta con otros términos de búsqueda',
    available: 'Disponible',
    joinEventButton: 'Unirse al Evento →',
    
    // Event Page
    searchMatch: 'Buscar Match',
    rooms: 'Salas',
    questions: 'Preguntas',
    searchByBadge: 'Buscar por Número de Badge',
    badgeNumber: 'Número de Badge',
    search: 'Buscar',
    matchFound: '¡Match Encontrado! 🎉',
    matchDescription: 'Tienes intereses en común con',
    commonInterests: 'Intereses en Común',
    generatingQuestions: 'Generando preguntas personalizadas...',
    networkingRooms: 'Salas de Networking',
    roomDescription: 'Explora diferentes salas de conversación',
    participants: 'Participantes',
    conversationTopics: 'Temas de Conversación',
    aiQuestions: 'Preguntas de IA',
    transcription: 'Transcripción',
    startRecording: '🎤 Iniciar Grabación',
    stopRecording: '⏹️ Detener Grabación',
    recording: 'Grabando...',
    virtualAssistant: 'Asistente Virtual',
    speakQuestion: '🔊 Escuchar',
    copyQuestion: '📋 Copiar',
    copied: '¡Copiado!',
    close: 'Cerrar',
    
    // Errors
    errorOccurred: 'Ocurrió un error. Por favor intenta de nuevo.',
  },
  en: {
    // Navbar
    profile: 'Profile',
    logout: 'Logout',
    login: 'Login',
    
    // Home
    heroTitle: 'Connect with People Who Matter',
    heroSubtitle: 'AI-powered smart networking for unforgettable events',
    guestTab: "I'm a Guest",
    organizerTab: "I'm an Organizer",
    eventCodeLabel: 'Event Code',
    eventCodePlaceholder: 'Enter your code',
    joinEvent: 'Join Event',
    createEvent: 'Create Event',
    organizerSignup: 'Sign Up as Organizer',
    
    // Login
    createAccount: 'Create Account',
    welcomeBack: 'Welcome Back',
    signUpDescription: 'Join Connect2 to discover amazing events',
    signInDescription: 'Sign in to your account',
    fullName: 'Full Name',
    email: 'Email Address',
    password: 'Password',
    minCharacters: 'Minimum 6 characters',
    signIn: 'Sign In',
    signUp: 'Sign Up',
    alreadyHaveAccount: 'Already have an account?',
    dontHaveAccount: "Don't have an account?",
    backToHome: 'Back to Home',
    loading: 'Loading...',
    
    // Interests Form
    welcomeToConnect2: 'Welcome to Connect2! 🎉',
    tellUsAboutYou: 'Tell us about yourself to personalize your experience',
    yourInterests: '📌 Your Interests',
    selectInterests: 'Select topics you are passionate about (minimum 3)',
    professionalInfo: '💼 Professional Information',
    company: 'Company / Organization',
    companyPlaceholder: 'Ex: TechCorp, Freelancer, Student',
    role: 'Role / Position',
    rolePlaceholder: 'Ex: CEO, Developer, Student',
    linkedin: 'LinkedIn (optional)',
    linkedinPlaceholder: 'https://linkedin.com/in/your-profile',
    continueToEvents: 'Continue to Events →',
    selectMinimum: 'Select at least 3 interests to continue',
    saving: 'Saving...',
    
    // Events
    discoverEvents: 'Discover Events',
    findPerfectEvent: 'Find the perfect event for you and start networking',
    searchEvents: 'Search events...',
    all: 'All',
    technology: 'Technology',
    business: 'Business',
    design: 'Design',
    loadingEvents: 'Loading events...',
    noEventsFound: 'No events found',
    tryDifferentSearch: 'Try different search terms',
    available: 'Available',
    joinEventButton: 'Join Event →',
    
    // Event Page
    searchMatch: 'Search Match',
    rooms: 'Rooms',
    questions: 'Questions',
    searchByBadge: 'Search by Badge Number',
    badgeNumber: 'Badge Number',
    search: 'Search',
    matchFound: 'Match Found! 🎉',
    matchDescription: 'You have common interests with',
    commonInterests: 'Common Interests',
    generatingQuestions: 'Generating personalized questions...',
    networkingRooms: 'Networking Rooms',
    roomDescription: 'Explore different conversation rooms',
    participants: 'Participants',
    conversationTopics: 'Conversation Topics',
    aiQuestions: 'AI Questions',
    transcription: 'Transcription',
    startRecording: '🎤 Start Recording',
    stopRecording: '⏹️ Stop Recording',
    recording: 'Recording...',
    virtualAssistant: 'Virtual Assistant',
    speakQuestion: '🔊 Listen',
    copyQuestion: '📋 Copy',
    copied: 'Copied!',
    close: 'Close',
    
    // Errors
    errorOccurred: 'An error occurred. Please try again.',
  }
};

export const useTranslation = (lang: Language = 'es') => {
  return {
    t: (key: keyof typeof translations.es) => translations[lang][key] || key,
    lang
  };
};
