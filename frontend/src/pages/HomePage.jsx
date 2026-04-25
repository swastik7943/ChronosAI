import { useState, useEffect } from 'react';
import axios from 'axios';
import ChatWidget from '../components/Chat/ChatWidget';
import CalendarWidget from '../components/Calendar/CalendarWidget';
import MeetingDetailsModal from '../components/Modals/MeetingDetailsModal';
import { Calendar, Clock, Users, Video } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function HomePage({ token }) {
  const [meetings, setMeetings] = useState([]);
  const [todayMeetings, setTodayMeetings] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedMeeting, setSelectedMeeting] = useState(null);

  const fetchMeetings = async () => {
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const [allRes, todayRes] = await Promise.all([
        axios.get(`${API_URL}/api/meetings/all`),
        axios.get(`${API_URL}/api/meetings/date/${selectedDate}`)
      ]);
      setMeetings(allRes.data);
      const validMeetings = todayRes.data.filter(m => m.status !== 'canceled');
      setTodayMeetings(validMeetings.sort((a, b) => a.startTime.localeCompare(b.startTime)));
    } catch (error) {
      console.error('Failed to fetch meetings', error);
    }
  };

  useEffect(() => { fetchMeetings(); }, [selectedDate, token]);

  const formatTime = (timeStr, duration) => {
    if (!timeStr) return '';
    const start = new Date(`2000-01-01T${timeStr}`);
    const fmt = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: 'numeric', hour12: true });
    let endStr = '';
    if (duration) {
      const end = new Date(start.getTime() + duration * 60000);
      endStr = ` - ${fmt.format(end)}`;
    }
    return `${fmt.format(start)}${endStr}`;
  };

  return (
    <div className="flex-1 flex overflow-hidden p-4 gap-4 w-full">
      {/* Left: Agenda + Chat */}
      <div className="w-[380px] flex flex-col gap-4 overflow-hidden flex-shrink-0">
        {/* Agenda */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 shadow-lg flex flex-col h-[38%] flex-shrink-0 transition-colors">
          <div className="flex items-center gap-2 mb-3 text-gray-800 dark:text-gray-200 border-b border-gray-200 dark:border-gray-800 pb-2">
            <div className="p-1.5 bg-indigo-500/10 rounded-lg"><Calendar className="w-4 h-4 text-indigo-400" /></div>
            <h2 className="text-sm font-semibold tracking-wide">
              {selectedDate === new Date().toISOString().split('T')[0] ? "Today's Agenda" : `Agenda for ${selectedDate}`}
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-2">
            {todayMeetings.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <Calendar className="w-8 h-8 mb-2 opacity-30" />
                <p className="text-xs italic">Clear schedule</p>
              </div>
            ) : (
              todayMeetings.map(m => {
                const isPast = (() => {
                  if (!m.date || !m.startTime) return false;
                  const dateObj = new Date(`${m.date}T${m.startTime}`);
                  if (isNaN(dateObj.getTime())) return false;
                  const dur = m.duration || 30;
                  return new Date() > new Date(dateObj.getTime() + (dur * 60000));
                })();
                
                return (
                  <div key={m._id} onClick={() => setSelectedMeeting(m)} className={`group cursor-pointer bg-gray-50 dark:bg-gray-800/40 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700/50 hover:border-indigo-500/30 p-3 rounded-xl shadow-sm relative overflow-hidden text-xs transition-all ${isPast ? 'opacity-60' : ''}`}>
                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${isPast ? 'bg-gray-500/50' : 'bg-indigo-500/70 group-hover:bg-indigo-400'}`}></div>
                    <div className="font-semibold text-gray-900 dark:text-gray-100 mb-1.5 truncate flex justify-between items-start">
                       {m.title}
                       {isPast && <span className="text-[9px] bg-gray-500/10 text-gray-400 px-1 py-0.5 rounded leading-none">ENDED</span>}
                    </div>
                    <div className="flex flex-col gap-1 text-gray-600 dark:text-gray-400">
                      <div className="flex items-center gap-1.5"><Clock className="w-3 h-3 text-blue-400" /> {formatTime(m.startTime, m.duration)}</div>
                      {m.participants?.length > 0 && (
                        <div className="flex items-center gap-1.5"><Users className="w-3 h-3 text-purple-400" /> <span className="truncate">{m.participants.join(', ')}</span></div>
                      )}
                      {m.jitsiRoom && !isPast && (
                        <Link onClick={(e) => e.stopPropagation()} to={`/meet/${m.jitsiRoom}`} className="mt-1 flex items-center justify-center gap-1 w-full py-1 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 rounded-lg border border-indigo-500/20 text-[11px]">
                          <Video className="w-3 h-3" /> Join Video
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
        {/* Chat */}
        <div className="flex-1 overflow-hidden min-h-[280px]">
          <ChatWidget onMeetingsChange={fetchMeetings} />
        </div>
      </div>

      {/* Right: Calendar */}
      <div className="flex-1 min-w-[400px] h-full">
        <CalendarWidget meetings={meetings} onDateClick={setSelectedDate} onEventClick={setSelectedMeeting} />
      </div>

      {selectedMeeting && (
        <MeetingDetailsModal meeting={selectedMeeting} onClose={() => setSelectedMeeting(null)} onMeetingCanceled={fetchMeetings} />
      )}
    </div>
  );
}
