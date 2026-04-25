import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { User, Mail, Globe, Clock, Coffee, Timer, Save, Camera, Chrome, CalendarOff } from 'lucide-react';

const TIMEZONE_OPTIONS = [
  { value: 'UTC', label: 'UTC (Universal)' },
  { value: 'EST', label: 'EST (Eastern US)' },
  { value: 'CST', label: 'CST (Central US)' },
  { value: 'MST', label: 'MST (Mountain US)' },
  { value: 'PST', label: 'PST (Pacific US)' },
  { value: 'GMT', label: 'GMT (London)' },
  { value: 'IST', label: 'IST (India)' },
  { value: 'CET', label: 'CET (Central Europe)' },
  { value: 'JST', label: 'JST (Japan)' },
  { value: 'AEST', label: 'AEST (Australia)' },
];

const DAYS_OF_WEEK = [
  { value: 0, label: 'Su' },
  { value: 1, label: 'Mo' },
  { value: 2, label: 'Tu' },
  { value: 3, label: 'We' },
  { value: 4, label: 'Th' },
  { value: 5, label: 'Fr' },
  { value: 6, label: 'Sa' },
];

const TIME_OPTIONS = [];
for (let h = 0; h < 24; h++) {
  for (let m = 0; m < 60; m += 30) {
    const val = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    const label = m === 0 ? `${hour12} ${ampm}` : `${hour12}:${String(m).padStart(2, '0')} ${ampm}`;
    TIME_OPTIONS.push({ value: val, label });
  }
}

export default function ProfilePage({ token }) {
  const [profile, setProfile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [timezone, setTimezone] = useState('UTC');
  const [bufferTime, setBufferTime] = useState(0);
  const [workingHoursStart, setWorkingHoursStart] = useState('09:00');
  const [workingHoursEnd, setWorkingHoursEnd] = useState('18:00');
  const [breakStart, setBreakStart] = useState('13:00');
  const [breakEnd, setBreakEnd] = useState('14:00');
  const [offDays, setOffDays] = useState([0]);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const fileRef = useRef(null);
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    const load = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/users/settings`, { headers });
        const d = res.data;
        setProfile(d);
        setDisplayName(d.name || '');
        setEmail(d.email || '');
        setTimezone(d.timezone || 'UTC');
        setBufferTime(d.bufferTime || 0);
        setWorkingHoursStart(d.workingHoursStart || '09:00');
        setWorkingHoursEnd(d.workingHoursEnd || '18:00');
        setBreakStart(d.breakStart || '13:00');
        setBreakEnd(d.breakEnd || '14:00');
        setOffDays(d.offDays || [0]);
        if (d.avatar) setAvatarPreview(d.avatar);
      } catch (e) { console.error(e); }
      setLoading(false);
    };
    load();
  }, [token]);

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setAvatarPreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    try {
      await axios.put(`${API_URL}/api/users/settings`, {
        name: displayName,
        timezone,
        bufferTime: Number(bufferTime),
        workingHoursStart,
        workingHoursEnd,
        breakStart,
        breakEnd,
        offDays,
        ...(avatarPreview && { avatar: avatarPreview })
      }, { headers });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) { alert('Failed to save'); }
  };

  const handleConnectGoogle = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/auth/google/url`);
      window.location.href = res.data.url;
    } catch (e) {
      console.error(e);
      alert('Failed to initiate Google connection');
    }
  };

  const handleDisconnectGoogle = async () => {
    if (!window.confirm('Are you sure you want to disconnect Google Calendar? Meetings will no longer sync.')) return;
    try {
      await axios.post(`${API_URL}/api/users/google-disconnect`, {}, { headers });
      setProfile({ ...profile, googleId: null });
      alert('Google Calendar disconnected successfully');
    } catch (e) {
      console.error(e);
      alert('Failed to disconnect');
    }
  };

  if (loading) {
    return <div className="flex-1 flex items-center justify-center"><div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full"></div></div>;
  }

  const initials = displayName ? displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '?';

  return (
    <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">User Profile</h1>

        {/* Avatar & Name Section */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm mb-4">
          <div className="flex items-center gap-5">
            <div className="relative group">
              <div className="w-20 h-20 rounded-2xl overflow-hidden bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                {avatarPreview ? <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" /> : initials}
              </div>
              <button onClick={() => fileRef.current?.click()} className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-indigo-500 text-white flex items-center justify-center shadow-lg hover:bg-indigo-600 transition-colors">
                <Camera className="w-3.5 h-3.5" />
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            </div>
            <div className="flex-1">
              <label className="text-xs text-gray-400 font-medium uppercase">Display Name</label>
              <input value={displayName} onChange={e => setDisplayName(e.target.value)} className="w-full mt-1 text-lg font-semibold bg-transparent border-b-2 border-gray-200 dark:border-gray-700 focus:border-indigo-500 text-gray-900 dark:text-white outline-none pb-1 transition-colors" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-sm text-gray-400">
            <Mail className="w-4 h-4" />
            <span>{email}</span>
            {profile?.googleId && <span className="ml-2 text-xs bg-green-500/10 text-green-400 px-2 py-0.5 rounded-full">Google Connected</span>}
          </div>
        </div>

        {/* Settings Section */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm mb-4 space-y-5">
          {/* Timezone */}
          <div>
            <label className="flex items-center gap-1.5 text-xs text-gray-400 font-medium uppercase mb-2">
              <Globe className="w-3.5 h-3.5" /> Timezone
            </label>
            <select value={timezone} onChange={e => setTimezone(e.target.value)} className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg py-2.5 px-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40">
              {TIMEZONE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {/* Working Hours */}
          <div>
            <label className="flex items-center gap-1.5 text-xs text-gray-400 font-medium uppercase mb-2">
              <Clock className="w-3.5 h-3.5" /> Working Hours
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-xs text-gray-500 mb-1 block">Start</span>
                <select value={workingHoursStart} onChange={e => setWorkingHoursStart(e.target.value)} className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg py-2 px-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40">
                  {TIME_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <span className="text-xs text-gray-500 mb-1 block">End</span>
                <select value={workingHoursEnd} onChange={e => setWorkingHoursEnd(e.target.value)} className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg py-2 px-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40">
                  {TIME_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Break Time */}
          <div>
            <label className="flex items-center gap-1.5 text-xs text-gray-400 font-medium uppercase mb-2">
              <Coffee className="w-3.5 h-3.5" /> Break Time
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-xs text-gray-500 mb-1 block">Start</span>
                <select value={breakStart} onChange={e => setBreakStart(e.target.value)} className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg py-2 px-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40">
                  {TIME_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <span className="text-xs text-gray-500 mb-1 block">End</span>
                <select value={breakEnd} onChange={e => setBreakEnd(e.target.value)} className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg py-2 px-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40">
                  {TIME_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Day Off */}
          <div>
            <label className="flex items-center gap-1.5 text-xs text-gray-400 font-medium uppercase mb-2">
              <CalendarOff className="w-3.5 h-3.5" /> Day Off
            </label>
            <div className="flex justify-between items-center bg-gray-100 dark:bg-gray-800 py-2 px-3 rounded-lg border border-gray-200 dark:border-gray-700">
              {DAYS_OF_WEEK.map(day => {
                const isOff = offDays.includes(day.value);
                return (
                  <button
                    key={day.value}
                    onClick={() => {
                      if (isOff) setOffDays(offDays.filter(d => d !== day.value));
                      else setOffDays([...offDays, day.value]);
                    }}
                    className={`w-8 h-8 rounded-full text-xs font-medium flex items-center justify-center transition-colors ${
                      isOff 
                        ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20' 
                        : 'bg-gray-200 text-gray-600 dark:bg-gray-900 dark:text-gray-400 hover:text-gray-900 hover:bg-gray-300 dark:hover:text-gray-200 dark:hover:bg-gray-700'
                    }`}
                    title={isOff ? 'Remove Day Off' : 'Set as Day Off'}
                  >
                    {day.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Buffer */}
          <div>
            <label className="flex items-center gap-1.5 text-xs text-gray-400 font-medium uppercase mb-2">
              <Timer className="w-3.5 h-3.5" /> Post-Meeting Buffer
            </label>
            <div className="flex items-center gap-3">
              <input type="range" min="0" max="60" step="5" value={bufferTime} onChange={e => setBufferTime(e.target.value)} className="flex-1 accent-indigo-500 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer" />
              <span className="text-sm font-semibold text-indigo-400 w-12 text-right">{bufferTime} min</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">Buffer applied <strong>after</strong> each meeting</p>
          </div>
        </div>

        {/* Integrations */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm mb-4">
          <h3 className="text-xs text-gray-400 font-medium uppercase mb-3">Integrations</h3>
          {profile?.googleId ? (
            <div className="flex flex-col gap-3">
              <div className="w-full py-3 bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 text-sm font-medium rounded-xl text-green-600 dark:text-green-400 flex items-center justify-center gap-3">
                <Chrome className="w-4 h-4" />
                Google Calendar Connected ✓
              </div>
              <button 
                onClick={handleDisconnectGoogle}
                className="text-xs text-red-400 hover:text-red-500 font-medium transition-colors"
              >
                Disconnect Google Calendar
              </button>
            </div>
          ) : (
            <button 
              onClick={handleConnectGoogle} 
              className="w-full py-3 bg-blue-50 dark:bg-[#4285F4]/10 hover:bg-blue-100 dark:hover:bg-[#4285F4]/20 border border-blue-200 dark:border-[#4285F4]/30 text-sm font-medium rounded-xl text-[#4285F4] transition-colors flex items-center justify-center gap-3 shadow-sm hover:shadow-md"
            >
              <Chrome className="w-4 h-4" />
              Connect Google Calendar
            </button>
          )}
        </div>

        {/* Save */}
        <button onClick={handleSave} className={`w-full py-3 font-medium rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg ${
          saved ? 'bg-green-500 text-white shadow-green-500/20' : 'bg-indigo-500 hover:bg-indigo-600 text-white shadow-indigo-500/20'
        }`}>
          <Save className="w-4 h-4" />
          {saved ? '✓ Saved!' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
