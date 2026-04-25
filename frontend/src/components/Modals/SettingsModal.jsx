import { useState, useEffect } from 'react';
import axios from 'axios';
import { X, Save, Chrome, Clock, Coffee, CalendarOff } from 'lucide-react';

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

export default function SettingsModal({ onClose, token }) {
  const [bufferTime, setBufferTime] = useState(0);
  const [timezone, setTimezone] = useState('UTC');
  const [workingHoursStart, setWorkingHoursStart] = useState('09:00');
  const [workingHoursEnd, setWorkingHoursEnd] = useState('18:00');
  const [breakStart, setBreakStart] = useState('13:00');
  const [breakEnd, setBreakEnd] = useState('14:00');
  const [offDays, setOffDays] = useState([0]);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [isGoogleConnected, setIsGoogleConnected] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
        const res = await axios.get(`${API_URL}/api/users/settings`);
        setBufferTime(res.data.bufferTime || 0);
        setTimezone(res.data.timezone || 'UTC');
        setWorkingHoursStart(res.data.workingHoursStart || '09:00');
        setWorkingHoursEnd(res.data.workingHoursEnd || '18:00');
        setBreakStart(res.data.breakStart || '13:00');
        setBreakEnd(res.data.breakEnd || '14:00');
        setOffDays(res.data.offDays || [0]);
        setIsGoogleConnected(!!res.data.googleId);
      } catch (error) {
        console.error("Failed to load settings", error);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, [token]);

  const handleSave = async () => {
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      await axios.put(`${API_URL}/api/users/settings`, 
        { bufferTime: Number(bufferTime), timezone, workingHoursStart, workingHoursEnd, breakStart, breakEnd, offDays }
      );
      setSaved(true);
      setTimeout(() => { setSaved(false); onClose(); }, 1000);
    } catch (error) {
      console.error("Failed to save settings", error);
    }
  };

  const handleConnectGoogle = async () => {
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await axios.get(`${API_URL}/api/auth/google/url`);
      window.location.href = res.data.url;
    } catch (error) {
      console.error('Failed to get Google Auth URL', error);
    }
  };

  const handleDisconnectGoogle = async () => {
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      await axios.post(`${API_URL}/api/users/google-disconnect`, {});
      setIsGoogleConnected(false);
    } catch (error) {
      console.error('Failed to disconnect Google', error);
    }
  };

  const SelectField = ({ label, icon: Icon, value, onChange, options }) => (
    <div className="space-y-1.5">
      <label className="text-sm text-gray-300 flex items-center gap-1.5">
        {Icon && <Icon className="w-3.5 h-3.5 text-gray-500" />}
        {label}
      </label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-colors"
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm transition-opacity">
      <div className="w-[420px] h-full bg-gray-900 border-l border-gray-800 shadow-2xl flex flex-col transform transition-transform animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-5 border-b border-gray-800 flex justify-between items-center bg-gray-900/50">
          <h2 className="text-lg font-semibold text-white">⚙️ Settings</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-lg text-gray-400 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 p-6 space-y-6 overflow-y-auto custom-scrollbar">
          {loading ? (
            <div className="animate-pulse space-y-4">
              <div className="h-3 bg-gray-700 rounded w-3/4"></div>
              <div className="h-10 bg-gray-700 rounded"></div>
              <div className="h-3 bg-gray-700 rounded w-1/2"></div>
              <div className="h-10 bg-gray-700 rounded"></div>
            </div>
          ) : (
            <>
              {/* Timezone */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">🌍 Timezone</h3>
                <SelectField label="Your Timezone" value={timezone} onChange={setTimezone} options={TIMEZONE_OPTIONS} />
              </div>

              <hr className="border-gray-800" />

              {/* Working Hours */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" /> Working Hours
                </h3>
                <p className="text-xs text-gray-500">Meetings cannot be scheduled outside these hours.</p>
                <div className="grid grid-cols-2 gap-3">
                  <SelectField label="Start" value={workingHoursStart} onChange={setWorkingHoursStart} options={TIME_OPTIONS} />
                  <SelectField label="End" value={workingHoursEnd} onChange={setWorkingHoursEnd} options={TIME_OPTIONS} />
                </div>
                <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-lg px-3 py-2">
                  <p className="text-xs text-indigo-300">
                    📌 Meetings will only be allowed between <strong>{TIME_OPTIONS.find(t => t.value === workingHoursStart)?.label}</strong> and <strong>{TIME_OPTIONS.find(t => t.value === workingHoursEnd)?.label}</strong>
                  </p>
                </div>
              </div>

              <hr className="border-gray-800" />

              {/* Break Time */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Coffee className="w-3.5 h-3.5" /> Break Time
                </h3>
                <p className="text-xs text-gray-500">No meetings will be scheduled during your break.</p>
                <div className="grid grid-cols-2 gap-3">
                  <SelectField label="Break Start" value={breakStart} onChange={setBreakStart} options={TIME_OPTIONS} />
                  <SelectField label="Break End" value={breakEnd} onChange={setBreakEnd} options={TIME_OPTIONS} />
                </div>
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                  <p className="text-xs text-amber-300">
                    ☕ Your break from <strong>{TIME_OPTIONS.find(t => t.value === breakStart)?.label}</strong> to <strong>{TIME_OPTIONS.find(t => t.value === breakEnd)?.label}</strong> is protected
                  </p>
                </div>
              </div>

              <hr className="border-gray-800" />

              {/* Day Off */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                  <CalendarOff className="w-3.5 h-3.5" /> Day Off
                </h3>
                <p className="text-xs text-gray-500">Meetings cannot be scheduled on your days off.</p>
                <div className="flex justify-between items-center bg-gray-800 py-2 px-3 rounded-lg border border-gray-700 mt-2">
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
                            : 'bg-gray-900 text-gray-400 hover:text-gray-200 hover:bg-gray-700'
                        }`}
                        title={isOff ? 'Remove Day Off' : 'Set as Day Off'}
                      >
                        {day.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <hr className="border-gray-800" />

              {/* Buffer Time */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">⏱ Post-Meeting Buffer</h3>
                <div className="flex justify-between items-center">
                  <label className="text-sm text-gray-300">Gap after each meeting</label>
                  <span className="text-indigo-400 font-semibold text-sm">{bufferTime} min</span>
                </div>
                <input 
                  type="range" 
                  min="0" max="60" step="5" 
                  value={bufferTime}
                  onChange={e => setBufferTime(e.target.value)}
                  className="w-full accent-indigo-500 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                />
                <p className="text-xs text-gray-500">Buffer is applied <strong>after</strong> each meeting ends. No meetings will be scheduled during this gap.</p>
              </div>

              <hr className="border-gray-800" />

              {/* Google Integration */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">🔗 Integrations</h3>
                {isGoogleConnected ? (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 px-3 py-2 bg-green-500/10 border border-green-500/20 rounded-xl">
                       <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                       <span className="text-sm font-medium text-green-400">Google Workspace Connected</span>
                    </div>
                    <button
                      onClick={handleDisconnectGoogle}
                      className="w-full py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-sm font-medium rounded-xl text-red-400 transition-colors"
                    >
                      Disconnect / Unbind
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleConnectGoogle}
                    className="w-full py-3 bg-[#4285F4]/10 hover:bg-[#4285F4]/20 border border-[#4285F4]/30 text-sm font-medium rounded-xl text-[#4285F4] transition-colors flex items-center justify-center gap-3"
                  >
                    <Chrome className="w-4 h-4" />
                    Bind Google Workspace
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {/* Save Button */}
        <div className="p-5 border-t border-gray-800 bg-gray-900/50">
          <button 
            onClick={handleSave}
            disabled={loading}
            className={`w-full py-2.5 font-medium rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 ${
              saved 
                ? 'bg-green-500 text-white shadow-green-500/20' 
                : 'bg-indigo-500 hover:bg-indigo-600 text-white shadow-indigo-500/20'
            }`}
          >
            <Save className="w-4 h-4" />
            {saved ? '✓ Saved!' : 'Save Preferences'}
          </button>
        </div>
      </div>
    </div>
  );
}
