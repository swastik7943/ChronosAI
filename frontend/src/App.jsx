import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import MeetingRoom from './pages/MeetingRoom';
import SettingsModal from './components/Modals/SettingsModal';
import { Settings, Sun, Moon } from 'lucide-react';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
  
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };
  
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlToken = urlParams.get('token');
    if (urlToken) {
      localStorage.setItem('token', urlToken);
      setToken(urlToken);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);
  
  const handleLogin = (token) => {
    localStorage.setItem('token', token);
    setToken(token);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
  };

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-white flex flex-col font-sans transition-colors duration-200">
        <header className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center bg-white dark:bg-gray-900 shadow-sm z-10 flex-shrink-0 transition-colors duration-200">
          <div className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500 flex items-center gap-2 cursor-pointer" onClick={() => window.location.href='/'}>
            ChronosAI
          </div>
          <div className="flex gap-4 items-center">
            <button onClick={toggleTheme} className="p-2 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white transition-colors" title="Toggle Theme">
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            {token && (
              <button onClick={() => setIsSettingsOpen(true)} className="p-2 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white transition-colors" title="Settings">
                <Settings className="w-5 h-5" />
              </button>
            )}
            {token && (
              <button onClick={handleLogout} className="text-sm px-4 py-2 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20 transition-colors">
                Logout
              </button>
            )}
          </div>
        </header>
        
        <main className="flex-1 flex overflow-hidden">
          <Routes>
             <Route 
               path="/" 
               element={token ? <Dashboard token={token} /> : <Login onLogin={handleLogin} />} 
             />
             <Route 
               path="/meet/:roomId" 
               element={token ? <MeetingRoom /> : <Navigate to="/" />} 
             />
             <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
      </div>

      {isSettingsOpen && token && (
         <SettingsModal token={token} onClose={() => setIsSettingsOpen(false)} />
      )}
    </BrowserRouter>
  );
}

export default App;
