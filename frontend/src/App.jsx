import { useState, useEffect } from 'react';
import axios from 'axios';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import MeetingRoom from './pages/MeetingRoom';
import SettingsModal from './components/Modals/SettingsModal';
import Sidebar from './components/Layout/Sidebar';
import Header from './components/Layout/Header';

// Pages
import HomePage from './pages/HomePage';
import MeetingsPage from './pages/MeetingsPage';
import ContactsPage from './pages/ContactsPage';
import ChatPage from './pages/ChatPage';
import DashboardPage from './pages/DashboardPage';
import ProfilePage from './pages/ProfilePage';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
  const [activeView, setActiveView] = useState('home');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(theme === 'light' ? 'dark' : 'light');

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
        await axios.get(`${API_URL}/api/auth/me`);
        setIsAuthenticated(true);
      } catch (err) {
        setIsAuthenticated(false);
      } finally {
        setIsCheckingAuth(false);
      }
    };
    checkAuth();
  }, []);

  const handleLogin = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = async () => {
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      await axios.post(`${API_URL}/api/auth/logout`);
    } catch(err) {}
    setIsAuthenticated(false);
    setActiveView('home');
  };

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  const renderView = () => {
    switch (activeView) {
      case 'home': return <HomePage />;
      case 'meetings': return <MeetingsPage />;
      case 'contacts': return <ContactsPage />;
      case 'chat': return <ChatPage />;
      case 'dashboard': return <DashboardPage />;
      case 'profile': return <ProfilePage />;
      default: return <HomePage />;
    }
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/meet/:roomId" element={isAuthenticated ? <MeetingRoom /> : <Navigate to="/" />} />
        <Route path="*" element={
          !isAuthenticated ? (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors">
              <Login onLogin={handleLogin} theme={theme} onToggleTheme={toggleTheme} />
            </div>
          ) : (
            <div className="h-screen flex flex-col bg-gray-100 dark:bg-gray-950 text-gray-900 dark:text-white font-sans transition-colors overflow-hidden">
              {/* Fixed Header */}
              <Header
                theme={theme}
                onToggleTheme={toggleTheme}
                onOpenSettings={() => setIsSettingsOpen(true)}
                onLogout={handleLogout}
              />

              {/* Sidebar + Content */}
              <div className="flex-1 flex overflow-hidden">
                <Sidebar
                  activeView={activeView}
                  onViewChange={setActiveView}
                  collapsed={sidebarCollapsed}
                  onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
                />

                {/* Main Content Area */}
                <main className="flex-1 flex overflow-hidden bg-gray-50 dark:bg-gray-950 transition-colors">
                  {renderView()}
                </main>
              </div>
            </div>
          )
        } />
      </Routes>

      {isSettingsOpen && isAuthenticated && (
        <SettingsModal onClose={() => setIsSettingsOpen(false)} />
      )}
    </BrowserRouter>
  );
}

export default App;
