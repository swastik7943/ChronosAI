import { useParams, useNavigate } from 'react-router-dom';
import { JitsiMeeting } from '@jitsi/react-sdk';
import { ArrowLeft } from 'lucide-react';

export default function MeetingRoom() {
  const { roomId } = useParams();
  const navigate = useNavigate();

  return (
    <div className="w-full h-screen bg-gray-950 flex flex-col pt-2 pb-6 px-6">
      
      <button 
        onClick={() => navigate('/')}
        className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-4 w-fit px-2 py-1 rounded-lg hover:bg-gray-800"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Dashboard
      </button>

      <div className="w-full h-full flex-1 rounded-2xl overflow-hidden border border-gray-800 shadow-2xl relative bg-black">
          <JitsiMeeting
              domain={import.meta.env.VITE_JITSI_DOMAIN || "meet.jit.si"}
              roomName={roomId}
              configOverwrite={{
                  startWithAudioMuted: true,
                  startWithVideoMuted: true,
                  disableModeratorIndicator: true,
                  enableEmailInStats: false
              }}
              interfaceConfigOverwrite={{
                  DISABLE_JOIN_LEAVE_NOTIFICATIONS: true
              }}
              userInfo={{
                  displayName: 'ChronosAI User'
              }}
              getIFrameRef={(iframeRef) => { 
                iframeRef.style.height = '100%'; 
                iframeRef.style.width = '100%'; 
                iframeRef.style.border = 'none';
              }}
              spinner={() => (
                <div className="flex h-full w-full items-center justify-center text-gray-400">
                   Initializing secure video connection...
                </div>
              )}
          />
      </div>
    </div>
  );
}
