import { useState, useEffect } from 'react';
import axios from 'axios';
import { Calendar, Clock, Users, Video, Filter, ChevronDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import MeetingDetailsModal from '../components/Modals/MeetingDetailsModal';

const FILTERS = [
  { id: 'ended', label: 'Ended' },
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This Week' },
  { id: 'month', label: 'This Month' },
  { id: 'upcoming', label: 'All Upcoming' },
];

export default function MeetingsPage({ token }) {
  const [meetings, setMeetings] = useState([]);
  const [filter, setFilter] = useState('today');
  const [selectedMeeting, setSelectedMeeting] = useState(null);

  const fetchMeetings = async () => {
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await axios.get(`${API_URL}/api/meetings/all`);
      setMeetings(res.data || []);
    } catch (e) { console.error(e); }
  };

  useEffect(() => { fetchMeetings(); }, [token]);

  const now = new Date();
  const today = now.toISOString().split('T')[0];

  const getStartOfWeek = () => {
    const d = new Date(now);
    const day = d.getDay();
    d.setDate(d.getDate() - day);
    return d.toISOString().split('T')[0];
  };

  const getEndOfWeek = () => {
    const d = new Date(now);
    const day = d.getDay();
    d.setDate(d.getDate() + (6 - day));
    return d.toISOString().split('T')[0];
  };

  const getEndOfMonth = () => {
    const d = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return d.toISOString().split('T')[0];
  };

  const filteredMeetings = meetings.filter(m => {
    const mDate = m.date;
    const mDateTime = new Date(`${m.date}T${m.startTime}`);
    const mEndTime = new Date(mDateTime.getTime() + m.duration * 60000);
    
    if (filter === 'ended') return mEndTime < now && m.status !== 'canceled';
    if (filter === 'today') return mDate === today && m.status !== 'canceled';
    if (filter === 'week') return mDate >= getStartOfWeek() && mDate <= getEndOfWeek() && m.status !== 'canceled';
    if (filter === 'month') return mDate >= today.slice(0, 7) + '-01' && mDate <= getEndOfMonth() && m.status !== 'canceled';
    if (filter === 'upcoming') return mDate >= today && m.status !== 'canceled';
    return true;
  }).sort((a, b) => {
    if (filter === 'ended') return b.date.localeCompare(a.date) || b.startTime.localeCompare(a.startTime);
    return a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime);
  });

  const formatTime = (t) => {
    if (!t) return '';
    const [h, m] = t.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hr = h % 12 || 12;
    return m === 0 ? `${hr} ${ampm}` : `${hr}:${String(m).padStart(2, '0')} ${ampm}`;
  };

  const statusColor = (m) => {
    if (m.status === 'canceled') return 'bg-red-500/10 text-red-400 border-red-500/20';
    const mEnd = new Date(new Date(`${m.date}T${m.startTime}`).getTime() + m.duration * 60000);
    if (mEnd < now) return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    return 'bg-green-500/10 text-green-400 border-green-500/20';
  };

  const statusLabel = (m) => {
    if (m.status === 'canceled') return 'Canceled';
    const mEnd = new Date(new Date(`${m.date}T${m.startTime}`).getTime() + m.duration * 60000);
    if (mEnd < now) return 'Ended';
    const diffMin = (new Date(`${m.date}T${m.startTime}`) - now) / 60000;
    if (diffMin <= 60 && diffMin > 0) return 'Starting Soon';
    return 'Scheduled';
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Meetings</h1>
          <p className="text-sm text-gray-500 mt-0.5">{filteredMeetings.length} meeting{filteredMeetings.length !== 1 ? 's' : ''}</p>
        </div>

        {/* Filters */}
        <div className="flex gap-2 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
          {FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                filter === f.id
                  ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Meeting list */}
      {filteredMeetings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <Calendar className="w-12 h-12 mb-3 opacity-30" />
          <p className="text-sm">No meetings for this filter</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredMeetings.map(m => {
            const isPast = (() => {
              if (!m.date || !m.startTime) return false;
              const dateObj = new Date(`${m.date}T${m.startTime}`);
              if (isNaN(dateObj.getTime())) return false;
              return new Date() > new Date(dateObj.getTime() + (m.duration * 60000));
            })();
            
            return (
              <div key={m._id} onClick={() => setSelectedMeeting(m)} className={`group cursor-pointer bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:border-indigo-500/30 rounded-xl p-4 shadow-sm hover:shadow-md transition-all flex items-center gap-4 ${isPast ? 'opacity-60' : ''}`}>
                {/* Date badge */}
                <div className={`w-14 h-14 rounded-xl flex flex-col items-center justify-center flex-shrink-0 ${isPast ? 'bg-gray-500/10' : 'bg-indigo-500/10'}`}>
                  <span className={`text-xs font-medium ${isPast ? 'text-gray-400' : 'text-indigo-400'}`}>{new Date(m.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short' })}</span>
                  <span className={`text-lg font-bold ${isPast ? 'text-gray-500' : 'text-indigo-500'}`}>{new Date(m.date + 'T00:00:00').getDate()}</span>
                </div>
  
                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-gray-900 dark:text-white truncate">{m.title}</h3>
                    <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full border ${m.isOrganizer ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' : 'bg-purple-500/10 text-purple-500 border-purple-500/20'}`}>
                      {m.isOrganizer ? 'Organized' : 'Invited'}
                    </span>
                    <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full border ${isPast && m.status === 'scheduled' ? 'bg-gray-500/10 text-gray-400 border-gray-500/20' : statusColor(m)}`}>
                      {isPast && m.status === 'scheduled' ? 'ENDED' : statusLabel(m)}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {formatTime(m.startTime)} · {m.duration} min</span>
                    {m.participants?.length > 0 && (
                      <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {m.participants.length} participant{m.participants.length > 1 ? 's' : ''}</span>
                    )}
                  </div>
                </div>
  
                {/* Join button */}
                {m.jitsiRoom && m.status === 'scheduled' && !isPast && (
                  <Link to={`/meet/${m.jitsiRoom}`} onClick={e => e.stopPropagation()} className="px-3 py-1.5 bg-indigo-500 text-white text-xs font-medium rounded-lg hover:bg-indigo-600 transition-colors flex items-center gap-1 shadow-md">
                    <Video className="w-3 h-3" /> Join
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      )}

      {selectedMeeting && (
        <MeetingDetailsModal meeting={selectedMeeting} onClose={() => setSelectedMeeting(null)} onMeetingCanceled={fetchMeetings} />
      )}
    </div>
  );
}
