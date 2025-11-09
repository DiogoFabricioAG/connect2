import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { LanguageProvider } from './lib/LanguageContext';
import { HomePage } from './pages/home';
import { EventPage } from './pages/event';
import { CreateEventPage } from './pages/create-event';
import { LoginPage } from './pages/login';
import { EventsPage } from './pages/events';
import { OrganizerSignupPage } from './pages/organizer-signup';

function App() {
  return (
    <LanguageProvider>
      <Router>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/events" element={<EventsPage />} />
          <Route path="/event/:eventCode" element={<EventPage />} />
          <Route path="/create-event" element={<CreateEventPage />} />
          <Route path="/organizer-signup" element={<OrganizerSignupPage />} />
        </Routes>
      </Router>
    </LanguageProvider>
  );
}

export default App;
