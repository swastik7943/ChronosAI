import { useState, useEffect } from 'react';
import axios from 'axios';
import ChatWidget from '../components/Chat/ChatWidget';
import CalendarWidget from '../components/Calendar/CalendarWidget';
import MeetingDetailsModal from '../components/Modals/MeetingDetailsModal';
import { Calendar, Clock, Users, Video } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Dashboard({ token }) {
  const [meetings, setMeetings] = useState([]);
  const [todayMeetings, setTodayMeetings] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedMeeting, setSelectedMeeting] = useState(null);

  const handleConnectGoogle = async () => {
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await axios.get(`${API_URL}/api/auth/google/url`);
      window.location.href = res.data.url;
    } catch (error) {
      console.error('Failed to get Google Auth URL', error);
    }
  };

  const fetchMeetings = async () => {
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const [allRes, todayRes] = await Promise.all([
        axios.get(`${API_URL}/api/meetings/all`),
        axios.get(`${API_URL}/api/meetings/date/${selectedDate}`)
      ]);
      setMeetings(allRes.data);
      // Filter out canceled ones if necessary, though backend should do it.
      const validMeetings = todayRes.data.filter(m => m.status !== 'canceled');
      setTodayMeetings(validMeetings.sort((a,b) => a.startTime.localeCompare(b.startTime)));
    } catch (error) {
      console.error('Failed to fetch meetings', error);
    }
  };

  useEffect(() => {
    fetchMeetings();
  }, [selectedDate, token]);

  const formatTime = (timeStr, duration) => {
    if (!timeStr) return '';
    const start = new Date(`2000-01-01T${timeStr}`);
    const timeFormat = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: 'numeric', hour12: true });
    
    let endStr = '';
    if (duration) {
      const end = new Date(start.getTime() + duration * 60000);
      endStr = ` - ${timeFormat.format(end)}`;
    }
    
    return `${timeFormat.format(start)}${endStr}`;
  };

  return (
    <div className="flex-1 flex overflow-hidden bg-gray-50 dark:bg-gray-950 p-4 gap-6 max-w-screen-2xl mx-auto w-full transition-colors duration-200">
      
      {/* Left Column: Chat & Context Panel */}
      <div className="w-[400px] flex flex-col gap-6 overflow-hidden h-full flex-shrink-0">
        
        {/* Context Panel (Meetings for the selected day) */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-xl flex flex-col h-[40%] flex-shrink-0 transition-colors duration-200">
          <div className="flex items-center gap-3 mb-4 text-gray-800 dark:text-gray-200 border-b border-gray-200 dark:border-gray-800 pb-3">
             <div className="p-2 bg-indigo-500/10 rounded-lg">
               <Calendar className="w-5 h-5 text-indigo-400" />
             </div>
             <h2 className="text-lg font-semibold tracking-wide">
               {selectedDate === new Date().toISOString().split('T')[0] ? "Today's Agenda" : `Agenda for ${selectedDate}`}
             </h2>
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-3">
            {todayMeetings.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <div className="w-16 h-16 bg-gray-800/50 rounded-full flex items-center justify-center mb-3">
                   <Calendar className="w-6 h-6 text-gray-600" />
                </div>
                <p className="text-sm italic">Clear schedule</p>
              </div>
            ) : (
              todayMeetings.map(m => {
                const isPast = (() => {
                  if (!m.date || !m.startTime) return false;
                  const dateObj = new Date(`${m.date}T${m.startTime}`);
                  if (isNaN(dateObj.getTime())) return false;
                  return new Date() > new Date(dateObj.getTime() + (m.duration * 60000));
                })();
                
                return (
                  <div key={m._id} onClick={() => setSelectedMeeting(m)} className={`group cursor-pointer bg-gray-50 dark:bg-gray-800/40 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200 border border-gray-200 dark:border-gray-700/50 hover:border-indigo-500/30 p-4 rounded-xl shadow-sm relative overflow-hidden text-sm ${isPast ? 'opacity-60' : ''}`}>
                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${isPast ? 'bg-gray-500/50' : 'bg-indigo-500/70 group-hover:bg-indigo-400'} transition-colors`}></div>
                    <div className="font-semibold text-gray-900 dark:text-gray-100 mb-2 truncate flex justify-between items-start">
                       {m.title}
                       {isPast && <span className="text-[10px] bg-gray-500/10 text-gray-400 px-1.5 py-0.5 rounded leading-none">ENDED</span>}
                    </div>
                    <div className="flex flex-col gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                      <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-blue-400" /> 
                        {formatTime(m.startTime, m.duration)}
                      </div>
                      {m.participants?.length > 0 && (
                        <div className="flex items-center gap-2">
                          <Users className="w-3.5 h-3.5 text-purple-400" /> 
                          <span className="truncate">{m.participants.join(', ')}</span>
                        </div>
                      )}
                      {m.jitsiRoom && !isPast && (
                        <Link onClick={(e) => e.stopPropagation()} to={`/meet/${m.jitsiRoom}`} className="mt-1 flex items-center justify-center gap-1.5 w-full py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 rounded-lg transition-colors border border-indigo-500/20">
                          <Video className="w-3.5 h-3.5" />
                          Join Video
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <div className="pt-4 mt-auto border-t border-gray-200 dark:border-gray-800">
            <button
               onClick={handleConnectGoogle}
               className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700 text-sm font-medium rounded-lg dark:text-gray-300 transition-colors flex items-center justify-center gap-2"
            >
               Connect Google Calendar
            </button>
          </div>
        </div>

        {/* Chat Widget Platform */}
        <div className="flex-1 overflow-hidden min-h-[300px]">
           <ChatWidget onMeetingsChange={fetchMeetings} />
        </div>
      </div>

      {/* Right Column: Calendar View */}
      <div className="flex-1 min-w-[500px] h-full">
         <CalendarWidget 
           meetings={meetings} 
           onDateClick={(date) => setSelectedDate(date)} 
           onEventClick={(m) => setSelectedMeeting(m)}
         />
      </div>

      {selectedMeeting && (
        <MeetingDetailsModal 
           meeting={selectedMeeting} 
           onClose={() => setSelectedMeeting(null)} 
           
           onMeetingCanceled={fetchMeetings} 
        />
      )}
    </div>
  );
}
