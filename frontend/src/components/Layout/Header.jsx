import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Search, Bell, Sun, Moon, Settings, LogOut, X, Calendar, Users, Briefcase } from 'lucide-react';

export default function Header({ theme, onToggleTheme, onOpenSettings, onLogout }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [showSearch, setShowSearch] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const searchRef = useRef(null);
  const notifRef = useRef(null);
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) setShowSearch(false);
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotifs(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Fetch notifications (recent meetings: scheduled, canceled, upcoming)
  useEffect(() => {
    const fetchNotifs = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/meetings/all`);
        const meetings = res.data || [];
        const now = new Date();
        const notifs = meetings.slice(0, 20).map(m => {
          const mDate = new Date(`${m.date}T${m.startTime}`);
          const diffMin = (mDate - now) / 60000;
          let type = 'scheduled';
          if (m.status === 'canceled') type = 'canceled';
          else if (m.isRescheduled) type = 'rescheduled';
          else if (diffMin > 0 && diffMin <= 60) type = 'upcoming';
          else if (diffMin <= 0) type = 'ended';
          return { ...m, notifType: type };
        });
        setNotifications(notifs);
      } catch (e) { /* silent */ }
    };
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 60000);
    return () => clearInterval(interval);
  }, []);

  // Search handler
  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults(null); return; }
    const timeout = setTimeout(async () => {
      try {
        const [contactsRes, meetingsRes, teamsRes] = await Promise.all([
          axios.get(`${API_URL}/api/contacts/search?q=${searchQuery}`).catch(() => ({ data: [] })),
          axios.get(`${API_URL}/api/meetings/all`).catch(() => ({ data: [] })),
          axios.get(`${API_URL}/api/teams`).catch(() => ({ data: [] }))
        ]);
        const q = searchQuery.toLowerCase();
        const filteredMeetings = (meetingsRes.data || []).filter(m =>
          m.title?.toLowerCase().includes(q) || m.date?.includes(q)
        ).slice(0, 5);
        const filteredTeams = (teamsRes.data || []).filter(t =>
          t.name?.toLowerCase().includes(q)
        ).slice(0, 3);
        setSearchResults({
          contacts: (contactsRes.data || []).slice(0, 5),
          meetings: filteredMeetings,
          teams: filteredTeams
        });
        setShowSearch(true);
      } catch (e) { /* silent */ }
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  const formatTime = (t) => {
    if (!t) return '';
    const [h, m] = t.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hr = h % 12 || 12;
    return m === 0 ? `${hr} ${ampm}` : `${hr}:${String(m).padStart(2, '0')} ${ampm}`;
  };

  const notifIcon = (type) => {
    if (type === 'canceled') return '❌';
    if (type === 'rescheduled') return '🔄';
    if (type === 'upcoming') return '⏰';
    if (type === 'ended') return '✅';
    return '📅';
  };

  const upcomingCount = notifications.filter(n => n.notifType === 'upcoming').length;

  return (
    <header className="h-[60px] px-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-white dark:bg-gray-900 flex-shrink-0 z-30 transition-colors gap-4">
      
      {/* Logo area */}
      <div className="flex items-center gap-3 w-[180px] flex-shrink-0">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-lg shadow-indigo-500/20">
          C
        </div>
        <span className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500 whitespace-nowrap">
          ChronosAI
        </span>
      </div>
      
      {/* Search */}
      <div className="flex-1 flex justify-center px-4">
        <div ref={searchRef} className="relative w-full max-w-2xl">
          <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search contacts, meetings, workspaces..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onFocus={() => searchQuery && setShowSearch(true)}
            className="w-full pl-10 pr-4 py-2 text-sm rounded-xl bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all"
          />
          {searchQuery && (
            <button onClick={() => { setSearchQuery(''); setShowSearch(false); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        
        {/* Search dropdown */}
        {showSearch && searchResults && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl max-h-[400px] overflow-y-auto z-50">
            {searchResults.contacts.length > 0 && (
              <div className="p-2">
                <p className="text-xs font-semibold text-gray-400 px-2 py-1 uppercase">Contacts</p>
                {searchResults.contacts.map(c => (
                  <div key={c._id} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg cursor-pointer text-sm">
                    <Users className="w-4 h-4 text-purple-400" />
                    <span className="text-gray-800 dark:text-gray-200">{c.contactUser?.name}</span>
                    <span className="text-xs text-gray-400 ml-auto">{c.contactUser?.email}</span>
                  </div>
                ))}
              </div>
            )}
            {searchResults.meetings.length > 0 && (
              <div className="p-2 border-t border-gray-100 dark:border-gray-800">
                <p className="text-xs font-semibold text-gray-400 px-2 py-1 uppercase">Meetings</p>
                {searchResults.meetings.map(m => (
                  <div key={m._id} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg cursor-pointer text-sm">
                    <Calendar className="w-4 h-4 text-indigo-400" />
                    <span className="text-gray-800 dark:text-gray-200">{m.title}</span>
                    <span className="text-xs text-gray-400 ml-auto">{m.date} · {formatTime(m.startTime)}</span>
                  </div>
                ))}
              </div>
            )}
            {searchResults.teams.length > 0 && (
              <div className="p-2 border-t border-gray-100 dark:border-gray-800">
                <p className="text-xs font-semibold text-gray-400 px-2 py-1 uppercase">Workspaces</p>
                {searchResults.teams.map(t => (
                  <div key={t._id} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg cursor-pointer text-sm">
                    <Briefcase className="w-4 h-4 text-emerald-400" />
                    <span className="text-gray-800 dark:text-gray-200">{t.name}</span>
                    <span className="text-xs text-gray-400 ml-auto">{t.members?.length} members</span>
                  </div>
                ))}
              </div>
            )}
            {searchResults.contacts.length === 0 && searchResults.meetings.length === 0 && searchResults.teams.length === 0 && (
              <div className="p-6 text-center text-sm text-gray-400">No results found</div>
            )}
          </div>
        )}
        </div>
      </div>

      {/* Right side controls */}
      <div className="flex items-center justify-end gap-2 w-[180px] flex-shrink-0">
        {/* Notification bell */}
        <div ref={notifRef} className="relative">
          <button onClick={() => setShowNotifs(!showNotifs)} className="relative p-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
            <Bell className="w-5 h-5" />
            {upcomingCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                {upcomingCount}
              </span>
            )}
          </button>
          {showNotifs && (
            <div className="absolute right-0 top-full mt-1 w-[360px] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl max-h-[450px] overflow-y-auto z-50">
              <div className="p-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-800 dark:text-white">Notifications</h3>
                <span className="text-xs text-gray-400">{notifications.length} total</span>
              </div>
              {notifications.length === 0 ? (
                <div className="p-6 text-center text-sm text-gray-400">No notifications</div>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                  {notifications.slice(0, 15).map(n => (
                    <div key={n._id} className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                      <div className="flex items-start gap-2">
                        <span className="text-base mt-0.5">{notifIcon(n.notifType)}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{n.title}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{n.date} · {formatTime(n.startTime)} · {n.duration} min</p>
                          <span className={`text-[10px] font-semibold uppercase mt-1 inline-block px-1.5 py-0.5 rounded ${
                            n.notifType === 'canceled' ? 'bg-red-500/10 text-red-500 font-bold' :
                            n.notifType === 'rescheduled' ? 'bg-amber-500/10 text-amber-500 font-bold' :
                            n.notifType === 'upcoming' ? 'bg-indigo-500/10 text-indigo-500 font-bold' :
                            n.notifType === 'ended' ? 'bg-gray-500/10 text-gray-500 font-bold' :
                            'bg-green-500/10 text-green-500 font-bold'
                          }`}>{n.notifType}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Theme toggle */}
        <button onClick={onToggleTheme} className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors" title="Toggle Theme">
          {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
        
        {/* Settings */}
        <button onClick={onOpenSettings} className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors" title="Settings">
          <Settings className="w-5 h-5" />
        </button>
        
        {/* Logout */}
        <button onClick={onLogout} className="p-2 rounded-lg bg-red-50 dark:bg-red-500/10 text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors" title="Logout">
          <LogOut className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
}
