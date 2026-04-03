import { useState, useEffect } from 'react';
import axios from 'axios';
import { X, Save, Chrome } from 'lucide-react';

export default function SettingsModal({ onClose, token }) {
  const [bufferTime, setBufferTime] = useState(0);
  const [timezone, setTimezone] = useState('UTC');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
        const res = await axios.get(`${API_URL}/api/users/settings`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setBufferTime(res.data.bufferTime || 0);
        setTimezone(res.data.timezone || 'UTC');
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
        { bufferTime: Number(bufferTime), timezone },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      onClose();
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

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm transition-opacity">
      <div className="w-[400px] h-full bg-gray-900 border-l border-gray-800 shadow-2xl flex flex-col transform transition-transform animate-in slide-in-from-right duration-200">
        <div className="p-5 border-b border-gray-800 flex justify-between items-center bg-gray-900/50">
          <h2 className="text-lg font-semibold text-white">Profile & Settings</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-lg text-gray-400 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 p-6 space-y-8 overflow-y-auto custom-scrollbar">
           {loading ? (
              <div className="animate-pulse flex space-x-4">
                  <div className="flex-1 space-y-6 py-1">
                      <div className="h-2 bg-gray-700 rounded w-3/4"></div>
                      <div className="space-y-3">
                         <div className="h-2 bg-gray-700 rounded"></div>
                         <div className="h-2 bg-gray-700 rounded w-5/6"></div>
                      </div>
                  </div>
              </div>
           ) : (
              <>
                 <div className="space-y-4">
                    <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">Calendar Engine</h3>
                    
                    <div className="space-y-2">
                       <label className="text-sm text-gray-300">Default Timezone</label>
                       <select 
                          value={timezone} 
                          onChange={e => setTimezone(e.target.value)}
                          className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg py-2.5 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                       >
                          <option value="UTC">UTC (Universal)</option>
                          <option value="EST">EST (Eastern)</option>
                          <option value="CST">CST (Central)</option>
                          <option value="MST">MST (Mountain)</option>
                          <option value="PST">PST (Pacific)</option>
                          <option value="GMT">GMT</option>
                       </select>
                    </div>

                    <div className="space-y-2 pt-2">
                       <label className="text-sm text-gray-300 flex justify-between">
                          <span>Meeting Buffer Time</span>
                          <span className="text-indigo-400 font-medium">{bufferTime} min GAP</span>
                       </label>
                       <input 
                         type="range" 
                         min="0" max="60" step="15" 
                         value={bufferTime}
                         onChange={e => setBufferTime(e.target.value)}
                         className="w-full accent-indigo-500 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                       />
                       <p className="text-xs text-gray-500">ChronosAI will strictly enforce this gap between consecutive meetings.</p>
                    </div>
                 </div>

                 <div className="space-y-4 pt-6 border-t border-gray-800">
                    <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">Integrations</h3>
                    
                    <button
                       onClick={handleConnectGoogle}
                       className="w-full py-3 bg-[#4285F4]/10 hover:bg-[#4285F4]/20 border border-[#4285F4]/30 text-sm font-medium rounded-xl text-[#4285F4] transition-colors flex items-center justify-center gap-3"
                    >
                       <Chrome className="w-4 h-4" />
                       Bind Google Workspace
                    </button>
                 </div>
              </>
           )}
        </div>

        <div className="p-5 border-t border-gray-800 bg-gray-900/50">
           <button 
             onClick={handleSave}
             disabled={loading}
             className="w-full py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 disabled:opacity-50"
           >
             <Save className="w-4 h-4" />
             Save Preferences
           </button>
        </div>
      </div>
    </div>
  );
}
