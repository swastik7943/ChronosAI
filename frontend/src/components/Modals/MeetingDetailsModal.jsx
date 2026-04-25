import { X, Trash2, Video, Calendar, Clock, Users, Crown } from 'lucide-react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

export default function MeetingDetailsModal({ meeting, onClose, token, onMeetingCanceled }) {
  const navigate = useNavigate();

  if (!meeting) return null;

  const isPast = (() => {
    if (!meeting.date || !meeting.startTime) return false;
    const dateObj = new Date(`${meeting.date}T${meeting.startTime}`);
    if (isNaN(dateObj.getTime())) return false;
    const endTime = new Date(dateObj.getTime() + (meeting.duration * 60000));
    return new Date() > endTime;
  })();

  const handleCancel = async () => {
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      await axios.delete(`${API_URL}/api/meetings/cancel/${meeting._id}`);
      onMeetingCanceled();
      onClose();
    } catch (error) {
      console.error("Failed to cancel meeting", error);
    }
  };

  const handleJoinVideo = () => {
      onClose();
      navigate(`/meet/${meeting.jitsiRoom}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-[450px] bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl flex flex-col transform transition-all scale-100">
        <div className="p-5 border-b border-gray-800 flex justify-between items-start bg-gray-800/20">
          <div>
              <h2 className="text-xl font-bold text-white mb-1">{meeting.title}</h2>
              <div className="flex items-center gap-2 text-sm text-gray-400">
                  <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${isPast ? 'bg-gray-500/10 text-gray-400' : (meeting.status === 'scheduled' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400')}`}>
                     {isPast ? 'ENDED' : meeting.status.toUpperCase()}
                  </span>
              </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-800 rounded-lg text-gray-400 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
           <div className="flex items-center gap-3 text-gray-300">
              <div className="w-10 h-10 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                  <Calendar className="w-5 h-5" />
              </div>
              <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wide font-medium">Date</div>
                  <div className="font-medium text-gray-200">{meeting.date}</div>
              </div>
           </div>

           <div className="flex items-center gap-3 text-gray-300">
              <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-400">
                  <Crown className="w-5 h-5" />
              </div>
              <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wide font-medium">Organizer</div>
                  <div className="font-medium text-gray-200">{meeting.organizerDetails || 'Unknown'}</div>
              </div>
           </div>

           <div className="flex items-center gap-3 text-gray-300">
              <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400">
                  <Clock className="w-5 h-5" />
              </div>
              <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wide font-medium">Time & Duration</div>
                  <div className="font-medium text-gray-200">{meeting.startTime} ({meeting.duration} min)</div>
              </div>
           </div>

           {meeting.participants && meeting.participants.length > 0 && (
             <div className="flex items-start gap-4 text-gray-300">
                <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-400 shrink-0">
                    <Users className="w-5 h-5" />
                </div>
                <div className="flex-1">
                    <div className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">Participants</div>
                    <div className="font-medium text-gray-200 flex flex-wrap gap-2">
                       {meeting.participants.map((p, i) => (
                           <span key={i} className="px-2 py-1 bg-gray-800 border border-gray-700 rounded-md text-sm">{p}</span>
                       ))}
                    </div>
                </div>
             </div>
           )}
        </div>

        {!isPast && (
          <div className="p-5 border-t border-gray-800 bg-gray-800/10 flex gap-3">
             {meeting.isOrganizer && (
               <button 
                 onClick={handleCancel}
                 className="flex-1 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
               >
                 <Trash2 className="w-4 h-4" />
                 Cancel Meeting
               </button>
             )}
             
             {meeting.jitsiRoom && meeting.status === 'scheduled' && (
                 <button 
                   onClick={handleJoinVideo}
                   className="flex-1 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20"
                 >
                   <Video className="w-4 h-4" />
                   Join Video
                 </button>
             )}
          </div>
        )}
      </div>
    </div>
  );
}
